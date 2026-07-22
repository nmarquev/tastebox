import express from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { detectImportSource, getAuthorFromSourceUrl } from '../utils/importSource';
import { getSourceFromUrl } from '../utils/sourceUtils';
import { getRecipeTags } from '../utils/recipeTags';
import { normalizeInstructionDescription, normalizeRecipeTitle } from '../utils/recipeText';
import { ImageService } from '../services/imageService';
import { sanitizeSuggestionText } from '../utils/suggestions';
import { mentionsGlutenFree } from '../utils/dietaryFeatures';

const router = express.Router();
const prisma = new PrismaClient();
const imageService = new ImageService();

const normalizeDifficulty = (value: unknown) => {
  if (typeof value !== 'string') return value;
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .trim();
  if (normalized === 'facil') return 'Fácil';
  if (normalized === 'medio') return 'Medio';
  if (normalized === 'dificil') return 'Difícil';
  return value;
};

const difficultySchema = z.preprocess(
  normalizeDifficulty,
  z.enum(['Fácil', 'Medio', 'Difícil']).optional().nullable()
);

// Validation schemas
const createRecipeSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  suggestions: z.string().nullable().optional(),
  prepTime: z.number().optional().nullable(),
  cookTime: z.number().optional().nullable(),
  servings: z.number().optional().nullable(),
  difficulty: difficultySchema,
  recipeType: z.string().optional().nullable(),
  dishType: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  language: z.string().optional().nullable(),
  sourceUrl: z.string().optional(),
  source: z.string().nullable().optional(),
  author: z.string().nullable().optional(),
  createdAt: z.coerce.date().optional(),
  importedFrom: z.string().trim().min(1).optional(),
  thermomix: z.boolean().optional(),
  airFryer: z.boolean().optional(),
  glutenFree: z.boolean().optional(),
  sugarFree: z.boolean().optional(),
  keto: z.boolean().optional(),
  lowCarb: z.boolean().optional(),
  vegetarian: z.boolean().optional(),
  proteica: z.boolean().optional(),
  sweet: z.boolean().optional(),
  savory: z.boolean().optional(),

  // Nutritional information (optional)
  calories: z.number().optional().nullable(),
  protein: z.number().optional().nullable(),
  carbohydrates: z.number().optional().nullable(),
  fat: z.number().optional().nullable(),
  saturatedFat: z.number().optional().nullable(),
  fiber: z.number().optional().nullable(),
  sugar: z.number().optional().nullable(),
  sodium: z.number().optional().nullable(),

  images: z.array(z.object({
    url: z.string(),
    localPath: z.string().optional().nullable(),
    order: z.number(),
    altText: z.string().nullable().optional()
  })).max(3),
  ingredients: z.array(z.object({
    name: z.string().min(1),
    amount: z.string(),  // Allow empty amounts for "al gusto" ingredients
    unit: z.string().nullable().optional().transform(val => val ?? ''),
    section: z.string().nullable().optional().transform(val => val ?? undefined), // Section for multi-part recipes
    order: z.number()
  })),
  instructions: z.array(z.object({
    step: z.number(),
    description: z.string().min(1),
    time: z.string().nullable().optional().transform(val => val ?? ''),
    temperature: z.string().nullable().optional().transform(val => val ?? ''),
    speed: z.string().nullable().optional().transform(val => val ?? ''),
    section: z.string().nullable().optional().transform(val => val ?? undefined) // Section for multi-part recipes
  })),
  tags: z.array(z.string()),
  autoTags: z.boolean().optional(), // false = no autogenerar etiquetas desde ingredientes
  featured: z.boolean().optional(),
  cooked: z.boolean().optional(),
  locution: z.string().optional().nullable()
});

// Update recipe schema (more flexible for updates)
const updateRecipeSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  suggestions: z.string().nullable().optional(),
  prepTime: z.number().optional().nullable(),
  cookTime: z.number().optional().nullable(),
  servings: z.number().optional().nullable(),
  difficulty: difficultySchema,
  recipeType: z.string().optional().nullable(),
  dishType: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  language: z.string().optional().nullable(),
  sourceUrl: z.string().optional(),
  source: z.string().nullable().optional(),
  author: z.string().nullable().optional(),
  createdAt: z.coerce.date().optional(),
  importedFrom: z.string().trim().min(1).optional(),
  thermomix: z.boolean().optional(),
  airFryer: z.boolean().optional(),
  glutenFree: z.boolean().optional(),
  sugarFree: z.boolean().optional(),
  keto: z.boolean().optional(),
  lowCarb: z.boolean().optional(),
  vegetarian: z.boolean().optional(),
  proteica: z.boolean().optional(),
  sweet: z.boolean().optional(),
  savory: z.boolean().optional(),

  // Nutritional information (optional)
  calories: z.number().optional().nullable(),
  protein: z.number().optional().nullable(),
  carbohydrates: z.number().optional().nullable(),
  fat: z.number().optional().nullable(),
  saturatedFat: z.number().optional().nullable(),
  fiber: z.number().optional().nullable(),
  sugar: z.number().optional().nullable(),
  sodium: z.number().optional().nullable(),

  images: z.array(z.object({
    url: z.string(),
    localPath: z.string().optional().nullable(),
    order: z.number(),
    altText: z.string().nullable().optional()
  })).max(3),
  ingredients: z.array(z.object({
    name: z.string().min(1),
    amount: z.string(),  // Allow empty amounts for "al gusto" ingredients
    unit: z.string().nullable().optional().transform(val => val ?? ''),
    section: z.string().nullable().optional().transform(val => val ?? undefined), // Section for multi-part recipes
    order: z.number()
  })),
  instructions: z.array(z.object({
    step: z.number(),
    description: z.string().min(1),
    time: z.string().nullable().optional().transform(val => val ?? ''),
    temperature: z.string().nullable().optional().transform(val => val ?? ''),
    speed: z.string().nullable().optional().transform(val => val ?? ''),
    section: z.string().nullable().optional().transform(val => val ?? undefined) // Section for multi-part recipes
  })),
  tags: z.array(z.union([
    z.string(),
    z.object({
      tag: z.string(),
      tagId: z.string().optional()
    })
  ])),
  featured: z.boolean().optional(),
  cooked: z.boolean().optional(),
  locution: z.string().optional().nullable()
});

// Get all recipes for user
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const recipes = await prisma.recipe.findMany({
      where: { userId: req.user!.id },
      include: {
        images: {
          orderBy: { order: 'asc' }
        },
        ingredients: {
          orderBy: { order: 'asc' }
        },
        instructions: {
          orderBy: { step: 'asc' }
        },
        tags: {
          orderBy: { order: 'asc' },
          include: {
            tag: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Transform the data to match frontend interface
    const transformedRecipes = recipes.map(recipe => ({
      ...recipe,
      tags: recipe.tags.map(rt => rt.tag.name),
      ingredients: recipe.ingredients.map(ing => {
        const { section, ...rest } = ing;
        return section ? { ...rest, section } : rest;
      }),
      instructions: recipe.instructions.map(instruction => {
        const { section, ...rest } = instruction;
        const base = section ? { ...rest, section } : rest;
        return {
          ...base,
          thermomixSettings: {
            time: instruction.time,
            temperature: instruction.temperature,
            speed: instruction.speed
          }
        };
      })
    }));

    res.json(transformedRecipes);
  } catch (error) {
    console.error('Get recipes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Normaliza una URL para comparar duplicados (ignora protocolo http/https, "www.",
// barra final, hash y parámetros de tracking comunes).
function normalizeUrlForCompare(url: string): string {
  try {
    const u = new URL(url.trim());
    u.hash = '';
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'igshid'].forEach(p => u.searchParams.delete(p));
    const host = u.host.replace(/^www\./i, '').toLowerCase();
    const path = u.pathname.replace(/\/+$/, '');
    const query = u.searchParams.toString();
    return `${host}${path}${query ? `?${query}` : ''}`.toLowerCase();
  } catch {
    return (url || '').trim().replace(/\/+$/, '').toLowerCase();
  }
}

// Chequea si el usuario ya tiene una receta con esa URL (para evitar duplicados al importar).
router.get('/check-url', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const url = String(req.query.url || '').trim();
    if (!url) return res.json({ exists: false });
    const target = normalizeUrlForCompare(url);
    const recipes = await prisma.recipe.findMany({
      where: { userId: req.user!.id, NOT: { sourceUrl: null } },
      select: { id: true, title: true, sourceUrl: true },
    });
    const match = recipes.find(r => r.sourceUrl && normalizeUrlForCompare(r.sourceUrl) === target);
    if (match) {
      return res.json({ exists: true, recipe: { id: match.id, title: match.title } });
    }
    res.json({ exists: false });
  } catch (error) {
    console.error('check-url error:', error);
    res.json({ exists: false });
  }
});

// Get single recipe
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const recipe = await prisma.recipe.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id
      },
      include: {
        images: {
          orderBy: { order: 'asc' }
        },
        ingredients: {
          orderBy: { order: 'asc' }
        },
        instructions: {
          orderBy: { step: 'asc' }
        },
        tags: {
          orderBy: { order: 'asc' },
          include: {
            tag: true
          }
        }
      }
    });

    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    // Transform the data
    const transformedRecipe = {
      ...recipe,
      tags: recipe.tags.map(rt => rt.tag.name),
      ingredients: recipe.ingredients.map(ing => {
        const { section, ...rest } = ing;
        return section ? { ...rest, section } : rest;
      }),
      instructions: recipe.instructions.map(instruction => {
        const { section, ...rest } = instruction;
        const base = section ? { ...rest, section } : rest;
        return {
          ...base,
          thermomixSettings: {
            time: instruction.time,
            temperature: instruction.temperature,
            speed: instruction.speed
          }
        };
      })
    };

    res.json(transformedRecipe);
  } catch (error) {
    console.error('Get recipe error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create recipe
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    console.log('🔍 DEBUG: Incoming recipe data:');
    console.log('📝 Ingredients type and sample:', typeof req.body.ingredients, Array.isArray(req.body.ingredients), req.body.ingredients?.slice(0, 2));
    console.log('📝 Instructions type and sample:', typeof req.body.instructions, Array.isArray(req.body.instructions), req.body.instructions?.slice(0, 2));

    const data = createRecipeSchema.parse(req.body);
    const glutenFree = data.glutenFree === true || mentionsGlutenFree(data);
    // Si autoTags es false, no autogeneramos etiquetas desde los ingredientes
    // (pasamos ingredientes vacíos): solo se usan las etiquetas provistas.
    const recipeTags = getRecipeTags(
      data.tags,
      data.autoTags === false ? [] : data.ingredients,
      data.title,
      {
        glutenFree,
        lowCarb: data.lowCarb,
        keto: data.keto,
        vegetarian: data.vegetarian,
        proteica: data.proteica,
      }
    );
    let recipeImages = data.images;
    if (recipeImages.length === 0 && data.importedFrom) {
      const fallbackImage = await imageService.findAndStoreRecipeImage(data.title);
      if (fallbackImage) recipeImages = [fallbackImage];
    }
    // Nunca persistir imágenes base64 en la DB: convertir cualquier data: URI a archivo en uploads/.
    recipeImages = await imageService.normalizeImagesForStorage(recipeImages);

    // Create recipe with related data
    const recipe = await prisma.recipe.create({
      data: {
        title: normalizeRecipeTitle(data.title),
        description: data.description,
        suggestions: sanitizeSuggestionText(data.suggestions),
        prepTime: data.prepTime,
        cookTime: data.cookTime,
        servings: data.servings,
        difficulty: data.difficulty,
        recipeType: data.recipeType,
        dishType: data.dishType,
        country: data.country,
        language: data.language?.trim() || null,
        sourceUrl: data.sourceUrl,
        // Si no se indicó fuente, derivarla de la URL (primera palabra del dominio); si no hay URL, queda null.
        source: data.source?.trim()
          || (data.sourceUrl && /^https?:\/\//i.test(data.sourceUrl) ? getSourceFromUrl(data.sourceUrl) : null),
        author: data.author?.trim() || getAuthorFromSourceUrl(data.sourceUrl),
        createdAt: data.createdAt,
        importedFrom: data.importedFrom ?? detectImportSource(data.sourceUrl),
        featured: data.featured,
        cooked: data.cooked,
        thermomix: data.thermomix,
        airFryer: data.airFryer,
        glutenFree,
        sugarFree: data.sugarFree,
        keto: data.keto,
        lowCarb: data.lowCarb,
        vegetarian: data.vegetarian,
        proteica: data.proteica,
        sweet: data.sweet,
        savory: data.savory,
        locution: data.locution,

        // Nutritional information
        calories: data.calories,
        protein: data.protein,
        carbohydrates: data.carbohydrates,
        fat: data.fat,
        saturatedFat: data.saturatedFat,
        fiber: data.fiber,
        sugar: data.sugar,
        sodium: data.sodium,

        userId: req.user!.id,
        images: {
          create: recipeImages.map(img => ({
            url: img.url,
            localPath: img.localPath,
            order: img.order,
            altText: img.altText
          }))
        },
        ingredients: {
          create: data.ingredients.map((ing, index) => ({
            name: ing.name,
            amount: ing.amount,
            unit: ing.unit,
            section: (ing as any).section || undefined,
            order: (ing as any).order || index + 1
          }))
        },
        instructions: {
          create: data.instructions.map(inst => ({
            step: inst.step,
            description: normalizeInstructionDescription(inst.description),
            time: inst.time,
            temperature: inst.temperature,
            speed: inst.speed,
            section: (inst as any).section || undefined
          }))
        },
        tags: {
          create: recipeTags.map((tagName, index) => ({
            order: index + 1,
            tag: {
              connectOrCreate: {
                where: { name: tagName },
                create: { name: tagName }
              }
            }
          }))
        }
      },
      include: {
        images: true,
        ingredients: true,
        instructions: true,
        tags: {
          orderBy: { order: 'asc' },
          include: {
            tag: true
          }
        }
      }
    });

    // Transform the data to match frontend interface
    const transformedRecipe = {
      ...recipe,
      tags: recipe.tags.map(rt => rt.tag.name),
      instructions: recipe.instructions.map(instruction => ({
        ...instruction,
        thermomixSettings: {
          time: instruction.time,
          temperature: instruction.temperature,
          speed: instruction.speed
        }
      }))
    };

    res.status(201).json(transformedRecipe);
  } catch (error) {
    console.error('Create recipe error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Edición masiva: actualiza SOLO los campos provistos en varias recetas a la vez
// (no toca ingredientes/instrucciones/imágenes). Las etiquetas se reemplazan solo si se envían.
router.patch('/bulk', authenticateToken, async (req: AuthRequest, res) => {
  const bulkSchema = z.object({
    recipeIds: z.array(z.string()).min(1),
    fields: z.object({
      source: z.string().optional().nullable(),
      importedFrom: z.string().trim().min(1).optional(),
      difficulty: difficultySchema,
      language: z.string().optional().nullable(),
      country: z.string().optional().nullable(),
      createdAt: z.string().optional(),
      dishType: z.string().optional().nullable(),
      recipeType: z.string().optional().nullable(),
      tags: z.array(z.string()).optional(),
      featured: z.boolean().optional(),
      cooked: z.boolean().optional(),
      thermomix: z.boolean().optional(),
      airFryer: z.boolean().optional(),
      glutenFree: z.boolean().optional(),
      sugarFree: z.boolean().optional(),
      keto: z.boolean().optional(),
      lowCarb: z.boolean().optional(),
      vegetarian: z.boolean().optional(),
      proteica: z.boolean().optional(),
      sweet: z.boolean().optional(),
      savory: z.boolean().optional(),
    }),
  });

  try {
    const { recipeIds, fields } = bulkSchema.parse(req.body);

    // Solo recetas del usuario autenticado.
    const owned = await prisma.recipe.findMany({
      where: { id: { in: recipeIds }, userId: req.user!.id },
      select: { id: true },
    });
    const ownedIds = owned.map(r => r.id);

    // Datos escalares (solo los campos provistos).
    const data: any = {};
    if (fields.source !== undefined) data.source = fields.source?.trim() || null;
    if (fields.importedFrom !== undefined) data.importedFrom = fields.importedFrom;
    if (fields.difficulty !== undefined) data.difficulty = fields.difficulty;
    if (fields.language !== undefined) data.language = fields.language?.trim() || null;
    if (fields.country !== undefined) data.country = fields.country?.trim() || null;
    if (fields.createdAt !== undefined) data.createdAt = new Date(fields.createdAt);
    if (fields.dishType !== undefined) data.dishType = fields.dishType?.trim() || null;
    if (fields.recipeType !== undefined) data.recipeType = fields.recipeType?.trim() || null;
    (['featured', 'cooked', 'thermomix', 'airFryer', 'glutenFree', 'sugarFree', 'keto', 'lowCarb', 'vegetarian', 'proteica', 'sweet', 'savory'] as const)
      .forEach(f => { if (fields[f] !== undefined) data[f] = fields[f]; });

    const hasScalar = Object.keys(data).length > 0;
    const tagsToAdd = fields.tags; // si viene, se AGREGAN a las existentes (no reemplazan)

    for (const id of ownedIds) {
      if (hasScalar) {
        await prisma.recipe.update({ where: { id }, data });
      }
      if (tagsToAdd !== undefined && tagsToAdd.length > 0) {
        // Unir con las etiquetas existentes (sin duplicar) y conservar el orden.
        const current = await prisma.recipe.findUnique({
          where: { id },
          select: { tags: { orderBy: { order: 'asc' }, include: { tag: true } } },
        });
        const existingNames = (current?.tags || []).map(rt => rt.tag.name);
        const merged = [...existingNames];
        tagsToAdd.forEach(name => { if (name && !merged.includes(name)) merged.push(name); });
        if (merged.length !== existingNames.length) {
          await prisma.recipe.update({
            where: { id },
            data: {
              tags: {
                deleteMany: {},
                create: merged.map((tagName, index) => ({
                  order: index + 1,
                  tag: { connectOrCreate: { where: { name: tagName }, create: { name: tagName } } },
                })),
              },
            },
          });
        }
      }
    }

    res.json({ updated: ownedIds.length });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Bulk update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Actualizar solo las imágenes sin reescribir ingredientes, pasos ni otros datos.
router.patch('/:id/images', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const images = z.array(z.object({
      url: z.string(),
      localPath: z.string().optional().nullable(),
      order: z.number(),
      altText: z.string().nullable().optional()
    })).max(3).parse(req.body?.images);

    const existingRecipe = await prisma.recipe.findFirst({
      where: { id: req.params.id, userId: req.user!.id }
    });
    if (!existingRecipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    const normalizedImages = await imageService.normalizeImagesForStorage(images);
    const recipe = await prisma.recipe.update({
      where: { id: req.params.id },
      data: {
        images: {
          deleteMany: {},
          create: normalizedImages.map(image => ({
            url: image.url,
            localPath: image.localPath,
            order: image.order,
            altText: image.altText
          }))
        }
      },
      include: {
        images: { orderBy: { order: 'asc' } },
        ingredients: { orderBy: { order: 'asc' } },
        instructions: { orderBy: { step: 'asc' } },
        tags: {
          orderBy: { order: 'asc' },
          include: { tag: true }
        }
      }
    });

    res.json({
      ...recipe,
      tags: recipe.tags.map(recipeTag => recipeTag.tag.name),
      instructions: recipe.instructions.map(instruction => ({
        ...instruction,
        thermomixSettings: {
          time: instruction.time,
          temperature: instruction.temperature,
          speed: instruction.speed
        }
      }))
    });
  } catch (error) {
    console.error('Update recipe images error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update recipe
router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    console.log('📝 Update recipe request received for ID:', req.params.id);
    console.log('📝 Request body keys:', Object.keys(req.body));
    console.log('📝 Ingredients count:', req.body.ingredients?.length);
    console.log('📝 Instructions count:', req.body.instructions?.length);
    console.log('📝 Has nutrition data:', {
      calories: req.body.calories !== undefined,
      protein: req.body.protein !== undefined,
      carbohydrates: req.body.carbohydrates !== undefined,
      fat: req.body.fat !== undefined
    });

    console.log('📝 Validating request body...');
    const data = updateRecipeSchema.parse(req.body);
    const glutenFree = data.glutenFree === true || mentionsGlutenFree(data);
    const requestedTags = data.tags.map(tag =>
      typeof tag === 'string' ? tag : tag.tag
    );
    const recipeTags = getRecipeTags(requestedTags, data.ingredients, data.title, {
      glutenFree,
      lowCarb: data.lowCarb,
      keto: data.keto,
      vegetarian: data.vegetarian,
      proteica: data.proteica,
    });
    console.log('📝 Validation successful!');

    // Check if recipe belongs to user
    const existingRecipe = await prisma.recipe.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id
      }
    });

    if (!existingRecipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    // Nunca persistir imágenes base64 en la DB: convertir cualquier data: URI a archivo en uploads/.
    const updateImages = await imageService.normalizeImagesForStorage(data.images);

    // Update recipe (this is a simplified version - in production you'd want more granular updates)
    const recipe = await prisma.recipe.update({
      where: { id: req.params.id },
      data: {
        title: normalizeRecipeTitle(data.title),
        description: data.description,
        suggestions: sanitizeSuggestionText(data.suggestions),
        prepTime: data.prepTime,
        cookTime: data.cookTime,
        servings: data.servings,
        difficulty: data.difficulty,
        recipeType: data.recipeType,
        dishType: data.dishType,
        country: data.country,
        // '' → null; si no se envió el campo, queda undefined (no se modifica).
        language: data.language !== undefined ? (data.language?.trim() || null) : undefined,
        sourceUrl: data.sourceUrl,
        source: data.source !== undefined ? (data.source?.trim() || null) : undefined,
        author: data.author?.trim()
          || existingRecipe.author
          || getAuthorFromSourceUrl(data.sourceUrl ?? existingRecipe.sourceUrl),
        createdAt: data.createdAt,
        importedFrom: data.importedFrom
          ?? (data.sourceUrl ? detectImportSource(data.sourceUrl) : undefined),
        featured: data.featured,
        cooked: data.cooked,
        thermomix: data.thermomix,
        airFryer: data.airFryer,
        glutenFree,
        sugarFree: data.sugarFree,
        keto: data.keto,
        lowCarb: data.lowCarb,
        vegetarian: data.vegetarian,
        proteica: data.proteica,
        sweet: data.sweet,
        savory: data.savory,
        locution: data.locution,

        // Nutritional information
        calories: data.calories,
        protein: data.protein,
        carbohydrates: data.carbohydrates,
        fat: data.fat,
        saturatedFat: data.saturatedFat,
        fiber: data.fiber,
        sugar: data.sugar,
        sodium: data.sodium,
        // For simplicity, we'll replace all related data
        images: {
          deleteMany: {},
          create: updateImages.map(img => ({
            url: img.url,
            localPath: img.localPath,
            order: img.order,
            altText: img.altText
          }))
        },
        ingredients: {
          deleteMany: {},
          create: data.ingredients.map((ing, index) => ({
            name: ing.name,
            amount: ing.amount,
            unit: ing.unit,
            section: (ing as any).section || undefined, // Include section for multi-part recipes
            order: (ing as any).order || index + 1
          }))
        },
        instructions: {
          deleteMany: {},
          create: data.instructions.map(inst => ({
            step: inst.step,
            description: normalizeInstructionDescription(inst.description),
            time: inst.time,
            temperature: inst.temperature,
            speed: inst.speed,
            section: (inst as any).section || undefined // Include section for multi-part recipes
          }))
        },
        tags: {
          deleteMany: {},
          create: recipeTags.map((tagName, index) => {
            return {
              order: index + 1,
              tag: {
                connectOrCreate: {
                  where: { name: tagName },
                  create: { name: tagName }
                }
              }
            };
          })
        }
      },
      include: {
        images: true,
        ingredients: true,
        instructions: true,
        tags: {
          orderBy: { order: 'asc' },
          include: {
            tag: true
          }
        }
      }
    });

    // Transform the data to match frontend interface
    const transformedRecipe = {
      ...recipe,
      tags: recipe.tags.map(rt => rt.tag.name),
      instructions: recipe.instructions.map(instruction => ({
        ...instruction,
        thermomixSettings: {
          time: instruction.time,
          temperature: instruction.temperature,
          speed: instruction.speed
        }
      }))
    };

    res.json(transformedRecipe);
  } catch (error) {
    console.error('Update recipe error:', error);
    if (error instanceof z.ZodError) {
      console.error('🔍 Update recipe validation error details:', JSON.stringify(error.errors, null, 2));
      console.error('🔍 Failed fields:');
      error.errors.forEach(err => {
        console.error(`  Path: ${err.path.join('.')} - Code: ${err.code} - Message: ${err.message}`);
      });
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Quitar una etiqueta solamente de una receta, sin eliminarla de otras recetas ni de la lista global.
router.delete('/:id/tags/:tagName', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const recipe = await prisma.recipe.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
      select: { id: true },
    });

    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    const tagName = decodeURIComponent(req.params.tagName).trim().toLocaleLowerCase('es');
    if (!tagName) {
      return res.status(400).json({ error: 'Nombre de etiqueta inválido' });
    }

    const recipeTags = await prisma.recipeTag.findMany({
      where: { recipeId: recipe.id },
      include: { tag: true },
    });
    const tagIds = recipeTags
      .filter(item => item.tag.name.trim().toLocaleLowerCase('es') === tagName)
      .map(item => item.tagId);

    if (tagIds.length > 0) {
      await prisma.recipeTag.deleteMany({
        where: { recipeId: recipe.id, tagId: { in: tagIds } },
      });
    }

    const updatedRecipe = await prisma.recipe.findUnique({
      where: { id: recipe.id },
      include: {
        images: true,
        ingredients: true,
        instructions: true,
        tags: { orderBy: { order: 'asc' }, include: { tag: true } },
      },
    });

    if (!updatedRecipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    res.json({
      ...updatedRecipe,
      tags: updatedRecipe.tags.map(item => item.tag.name),
      instructions: updatedRecipe.instructions.map(instruction => ({
        ...instruction,
        thermomixSettings: {
          time: instruction.time,
          temperature: instruction.temperature,
          speed: instruction.speed,
        },
      })),
    });
  } catch (error) {
    console.error('Remove recipe tag error:', error);
    res.status(500).json({ error: 'No se pudo quitar la etiqueta de la receta' });
  }
});

// Delete recipe
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const recipe = await prisma.recipe.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id
      }
    });

    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    await prisma.recipe.delete({
      where: { id: req.params.id }
    });

    res.json({ message: 'Recipe deleted successfully' });
  } catch (error) {
    console.error('Delete recipe error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
