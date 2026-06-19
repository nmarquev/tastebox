import express from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { detectImportSource, getAuthorFromSourceUrl, importSources } from '../utils/importSource';
import { getRecipeTags } from '../utils/recipeTags';
import { normalizeInstructionDescription, normalizeRecipeTitle } from '../utils/recipeText';
import { ImageService } from '../services/imageService';
import { sanitizeSuggestionText } from '../utils/suggestions';
import { mentionsGlutenFree } from '../utils/dietaryFeatures';

const router = express.Router();
const prisma = new PrismaClient();
const imageService = new ImageService();

// Validation schemas
const createRecipeSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  suggestions: z.string().nullable().optional(),
  prepTime: z.number().optional().nullable(),
  cookTime: z.number().optional().nullable(),
  servings: z.number().optional().nullable(),
  difficulty: z.enum(['Fácil', 'Medio', 'Difícil']).optional().nullable(),
  recipeType: z.string().optional().nullable(),
  dishType: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  language: z.string().optional().nullable(),
  sourceUrl: z.string().optional(),
  source: z.string().nullable().optional(),
  author: z.string().nullable().optional(),
  createdAt: z.coerce.date().optional(),
  importedFrom: z.enum(importSources).optional(),
  thermomix: z.boolean().optional(),
  airFryer: z.boolean().optional(),
  glutenFree: z.boolean().optional(),
  keto: z.boolean().optional(),
  lowCarb: z.boolean().optional(),
  vegetarian: z.boolean().optional(),

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
  difficulty: z.enum(['Fácil', 'Medio', 'Difícil']).optional().nullable(),
  recipeType: z.string().optional().nullable(),
  dishType: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  language: z.string().optional().nullable(),
  sourceUrl: z.string().optional(),
  source: z.string().nullable().optional(),
  author: z.string().nullable().optional(),
  createdAt: z.coerce.date().optional(),
  importedFrom: z.enum(importSources).optional(),
  thermomix: z.boolean().optional(),
  airFryer: z.boolean().optional(),
  glutenFree: z.boolean().optional(),
  keto: z.boolean().optional(),
  lowCarb: z.boolean().optional(),
  vegetarian: z.boolean().optional(),

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
        language: data.language?.trim() || 'Español',
        sourceUrl: data.sourceUrl,
        source: data.source?.trim() || null,
        author: data.author?.trim() || getAuthorFromSourceUrl(data.sourceUrl),
        createdAt: data.createdAt,
        importedFrom: data.importedFrom ?? detectImportSource(data.sourceUrl),
        featured: data.featured,
        cooked: data.cooked,
        thermomix: data.thermomix,
        airFryer: data.airFryer,
        glutenFree,
        keto: data.keto,
        lowCarb: data.lowCarb,
        vegetarian: data.vegetarian,
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
        language: data.language,
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
        keto: data.keto,
        lowCarb: data.lowCarb,
        vegetarian: data.vegetarian,
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
