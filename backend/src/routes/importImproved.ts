import express from 'express';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { LLMServiceImproved } from '../services/llmServiceImproved';
import { ImageService } from '../services/imageService';
import { CookidooService } from '../services/cookidooService';
import { getCookidooCredentials } from '../config/cookidooSettings';
import { FooditService } from '../services/fooditService';
import { getFooditCredentials } from '../config/fooditSettings';
import { detectImportSource, getAuthorFromSourceUrl } from '../utils/importSource';
import { sanitizeSuggestionText } from '../utils/suggestions';
import { mentionsGlutenFree } from '../utils/dietaryFeatures';
import type { RecipeImage } from '../types/recipe';
import {
  isSocialRecipeUrl,
  isYouTubeRecipeUrl,
  removeSocialInstructionPlaceholders,
  removeSocialPlaceholders,
  SOCIAL_INGREDIENTS_UNAVAILABLE,
  YOUTUBE_INGREDIENTS_UNAVAILABLE,
} from '../utils/socialRecipeContent';

const router = express.Router();

// Validation schema
const importUrlSchema = z.object({
  url: z.string().url()
});

const importTextSchema = z.object({
  text: z.string().trim().min(20, 'El texto es demasiado corto').max(200000, 'El texto es demasiado largo'),
  suggestedTitle: z.string().trim().max(180).optional(),
  multiple: z.boolean().optional().default(false)
});

// Initialize services
const llmService = new LLMServiceImproved();
const imageService = new ImageService();
const cookidooService = new CookidooService();
const fooditService = new FooditService();

const getLiteralIngredientText = (ingredient: unknown) => {
  if (typeof ingredient === 'string') {
    return ingredient.trim();
  }

  const item = ingredient as { sourceText?: unknown; name?: unknown; amount?: unknown; unit?: unknown };
  const sourceText = String(item?.sourceText || '').trim();
  if (sourceText) return sourceText;

  return [item?.amount, item?.unit, item?.name]
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .join(' ');
};

const getLiteralInstructionText = (instruction: unknown) => {
  if (typeof instruction === 'string') {
    return instruction.trim();
  }

  const item = instruction as { sourceText?: unknown; description?: unknown };
  return String(item?.sourceText || item?.description || '').trim();
};

const findExactSourceFragment = (candidate: string, sourceText: string) => {
  const trimmedCandidate = candidate.trim();
  if (!trimmedCandidate) return null;

  const exactIndex = sourceText.indexOf(trimmedCandidate);
  if (exactIndex >= 0) {
    return sourceText.slice(exactIndex, exactIndex + trimmedCandidate.length);
  }

  // Tolera solamente diferencias de espacios o saltos de linea introducidas al
  // serializar el JSON. El valor devuelto siempre se toma del texto original.
  const whitespaceFlexiblePattern = trimmedCandidate
    .split(/\s+/)
    .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s+');
  const match = sourceText.match(new RegExp(whitespaceFlexiblePattern));
  return match?.[0]?.trim() || null;
};

const normalizeTextIngredient = (ingredient: unknown, index: number, sourceText: string) => {
  const literalText = findExactSourceFragment(getLiteralIngredientText(ingredient), sourceText);
  if (!literalText) return null;

  // En una importacion desde texto se conserva la linea original completa. Separar
  // cantidad, unidad y nombre permitiria que el modelo reformule el contenido.
  return {
    name: literalText,
    amount: '',
    unit: '',
    order: index + 1,
    section: null
  };
};

const normalizeTextInstruction = (instruction: unknown, index: number, sourceText: string) => {
  const literalText = findExactSourceFragment(getLiteralInstructionText(instruction), sourceText);
  if (!literalText) return null;

  return {
    step: index + 1,
    description: literalText,
    time: undefined,
    temperature: undefined,
    speed: undefined,
    function: null,
    section: null
  };
};

/*
 * Esta respuesta se usa exclusivamente para texto pegado. Ingredientes y pasos
 * quedan respaldados por una coincidencia literal con el texto de entrada.
 */
const buildTextImportRecipeResponse = (recipeData: any, sourceText: string) => {
  const ingredients = (recipeData.ingredients || [])
    .map((ingredient: unknown, index: number) => normalizeTextIngredient(ingredient, index, sourceText))
    .filter((ingredient: { name: string } | null): ingredient is { name: string; amount: string; unit: string; order: number; section: null } => {
      if (!ingredient) return false;
      const name = ingredient.name.trim().toLowerCase();
      return name && name !== 'ingredientes no especificados' && name !== 'ingrediente';
    })
    .map((ingredient, index) => ({ ...ingredient, order: index + 1 }));

  const instructions = (recipeData.instructions || [])
    .map((instruction: unknown, index: number) => normalizeTextInstruction(instruction, index, sourceText))
    .filter((instruction: { description: string } | null): instruction is { step: number; description: string; time: undefined; temperature: undefined; speed: undefined; function: null; section: null } => {
      if (!instruction) return false;
      const description = instruction.description.trim().toLowerCase();
      return description && description !== 'preparar segun la receta original' && description !== 'preparar segÃºn la receta original';
    })
    .map((instruction, index) => ({ ...instruction, step: index + 1 }));

  return {
    title: String(recipeData.title || '').trim(),
    description: recipeData.description,
    suggestions: sanitizeSuggestionText(recipeData.suggestions),
    prepTime: Number.isFinite(recipeData.prepTime) ? recipeData.prepTime : 30,
    cookTime: Number.isFinite(recipeData.cookTime) ? recipeData.cookTime : undefined,
    servings: Number.isFinite(recipeData.servings) ? recipeData.servings : 4,
    difficulty: undefined,
    recipeType: undefined,
    country: undefined,
    language: recipeData.language || undefined,
    sourceUrl: undefined,
    author: undefined,
    importedFrom: 'recetario',
    thermomix: recipeData.thermomix ?? false,
    airFryer: recipeData.airFryer ?? false,
    glutenFree: recipeData.glutenFree === true || mentionsGlutenFree(recipeData),
    sugarFree: recipeData.sugarFree ?? false,
    keto: recipeData.keto ?? false,
    lowCarb: recipeData.lowCarb ?? false,
    vegetarian: recipeData.vegetarian ?? false,
    proteica: recipeData.proteica ?? false,
    sweet: recipeData.sweet ?? false,
    savory: recipeData.savory ?? false,
    calories: recipeData.nutrition?.calories,
    protein: recipeData.nutrition?.protein,
    carbohydrates: recipeData.nutrition?.carbohydrates,
    fat: recipeData.nutrition?.fat,
    saturatedFat: recipeData.nutrition?.saturatedFat,
    fiber: recipeData.nutrition?.fiber,
    sugar: recipeData.nutrition?.sugar,
    sodium: recipeData.nutrition?.sodium,
    images: [],
    ingredients,
    instructions,
    tags: Array.isArray(recipeData.tags) ? recipeData.tags.filter(Boolean).slice(0, 5) : []
  };
};

// Import recipe from URL
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { url } = importUrlSchema.parse(req.body);

    console.log(`Starting recipe import from: ${url}`);

    // Step 1: Extract recipe data with LLM.
    // Cookidoo oculta la preparación detrás del login: si la URL es de Cookidoo y hay
    // credenciales configuradas, el servidor inicia sesión y baja el HTML autenticado
    // (con los pasos reales). Si no hay credenciales, cae al flujo normal (que avisará
    // que faltan los pasos).
    const hostname = new URL(url).hostname;
    const isCookidoo = /cookidoo\./i.test(hostname);
    const cookidooCreds = isCookidoo ? getCookidooCredentials() : null;

    // Foodit (La Nación) esconde la preparación y los tips detrás de un paywall por
    // sesión. Con credenciales configuradas, el servidor inicia sesión (Auth0, vía
    // navegador headless) y lee el HTML completo. Sin credenciales, cae al flujo normal.
    const isFoodit = /foodit\.lanacion\.com\.ar$/i.test(hostname);
    const fooditCreds = isFoodit ? getFooditCredentials() : null;

    let recipeData;
    if (isCookidoo && cookidooCreds) {
      console.log('🔐 Cookidoo detectado con credenciales: usando extracción autenticada...');
      recipeData = await cookidooService.extractRecipeWithAuth(url, cookidooCreds);
    } else if (isFoodit && fooditCreds) {
      console.log('🔐 Foodit detectado con credenciales: usando extracción autenticada...');
      recipeData = await fooditService.extractRecipeWithAuth(url, fooditCreds);
    } else {
      if (isCookidoo) {
        console.log('⚠️ Cookidoo sin credenciales configuradas: la preparación puede no estar disponible.');
      }
      if (isFoodit) {
        console.log('⚠️ Foodit sin credenciales configuradas: los tips/preparación pueden no estar disponibles (paywall).');
      }
      console.log('Extracting recipe data with LLM...');
      recipeData = await llmService.extractRecipeFromUrl(url);
    }

    console.log(`Extracted recipe: ${recipeData.title}`);
    console.log(`Found ${recipeData.images.length} images`);

    const isSocialRecipe = isSocialRecipeUrl(url);
    const isYouTubeRecipe = isYouTubeRecipeUrl(url);
    const isStrictVideoRecipe = isSocialRecipe || isYouTubeRecipe;
    if (isStrictVideoRecipe) {
      recipeData.ingredients = removeSocialPlaceholders(recipeData.ingredients);
      recipeData.instructions = removeSocialInstructionPlaceholders(recipeData.instructions);
    }
    const hasIngredients = (recipeData.ingredients?.length ?? 0) > 0;
    const hasInstructions = (recipeData.instructions?.length ?? 0) > 0;

    if (
      (isSocialRecipe && !hasIngredients && !hasInstructions)
      || (isYouTubeRecipe && !hasIngredients)
    ) {
      return res.status(422).json({
        success: false,
        code: isYouTubeRecipe
          ? 'YOUTUBE_RECIPE_INGREDIENTS_UNAVAILABLE'
          : 'SOCIAL_RECIPE_INGREDIENTS_UNAVAILABLE',
        error: isYouTubeRecipe
          ? YOUTUBE_INGREDIENTS_UNAVAILABLE
          : SOCIAL_INGREDIENTS_UNAVAILABLE
      });
    }

    // Aviso al usuario: receta de Foodit sin credenciales y sin pasos → la preparación
    // quedó detrás del paywall. Le explicamos cómo traerla completa.
    let warning: string | undefined;
    if (isFoodit && !fooditCreds && (recipeData.instructions?.length ?? 0) < 2) {
      warning = 'Esta receta de Foodit (La Nación) tiene la preparación detrás del paywall, por eso no se importaron los pasos. Para traerlos completos, configurá tus credenciales de Foodit en Ajustes o importala con la extensión de Chrome de TasteBox.';
    } else if (isCookidoo && !cookidooCreds && (recipeData.instructions?.length ?? 0) < 2) {
      warning = 'Esta receta de Cookidoo tiene la preparación detrás del paywall, por eso no se importaron los pasos. Configurá tus credenciales de Cookidoo en Ajustes para traerlos completos.';
    } else if (isSocialRecipe && hasIngredients && !hasInstructions) {
      warning = 'Se importaron los ingredientes, pero los pasos de preparación no están disponibles en la publicación ni en sus primeros 5 comentarios.';
    } else if (isSocialRecipe && !hasIngredients && hasInstructions) {
      warning = 'Se importaron los pasos de preparación, pero los ingredientes no están disponibles en la publicación ni en sus primeros 5 comentarios.';
    } else if (isYouTubeRecipe && hasIngredients && !hasInstructions) {
      warning = 'Se importaron los ingredientes, pero los pasos de preparación no están disponibles en la descripción ni en los primeros 5 comentarios.';
    }

    // Step 2: Download and process images
    let processedImages: Array<Pick<RecipeImage, 'url' | 'localPath' | 'order' | 'altText'>> = [];
    if (recipeData.images.length > 0) {
      console.log('Downloading and processing images...');
      try {
        const imageUrls = recipeData.images.map(img => img.url);
        processedImages = await imageService.downloadAndStoreImages(imageUrls);
        console.log(`Successfully processed ${processedImages.length} images`);
      } catch (imageError) {
        console.error('Error al procesar imágenes:', imageError);
        // Continue without images if they fail
      }
    }

    // Step 3: Prepare response data
    const responseData = {
      title: recipeData.title,
      description: recipeData.description,
      suggestions: sanitizeSuggestionText(recipeData.suggestions),
      prepTime: recipeData.prepTime,
      cookTime: recipeData.cookTime,
      servings: recipeData.servings,
      difficulty: recipeData.difficulty,
      recipeType: recipeData.recipeType,
      country: recipeData.country,
      // Idioma: solo lo detectado; nunca forzar "Español" (no autocompletar con lo que adivina la IA).
      language: recipeData.language || undefined,
      sourceUrl: recipeData.sourceUrl || url,
      author: getAuthorFromSourceUrl(recipeData.sourceUrl || url),
      importedFrom: detectImportSource(recipeData.sourceUrl || url),
      thermomix: recipeData.thermomix ?? false,
      airFryer: recipeData.airFryer ?? false,
      glutenFree: recipeData.glutenFree === true || mentionsGlutenFree(recipeData),
      sugarFree: recipeData.sugarFree ?? false,
      keto: recipeData.keto ?? false,
      lowCarb: recipeData.lowCarb ?? false,
      vegetarian: recipeData.vegetarian ?? false,
      proteica: recipeData.proteica ?? false,
      sweet: recipeData.sweet ?? false,
      savory: recipeData.savory ?? false,
      // Nutrición exacta (Cookidoo). Si no hay, queda undefined y se calcula luego.
      calories: recipeData.nutrition?.calories,
      protein: recipeData.nutrition?.protein,
      carbohydrates: recipeData.nutrition?.carbohydrates,
      fat: recipeData.nutrition?.fat,
      saturatedFat: recipeData.nutrition?.saturatedFat,
      fiber: recipeData.nutrition?.fiber,
      sugar: recipeData.nutrition?.sugar,
      sodium: recipeData.nutrition?.sodium,
      images: processedImages.map(img => ({
        url: img.url,
        localPath: img.localPath,
        order: img.order,
        altText: img.altText
      })),
      ingredients: recipeData.ingredients.map((ingredient, index) => ({
        ...ingredient,
        order: index + 1,
        section: ingredient.section || null
      })),
      instructions: recipeData.instructions.map(inst => ({
        step: inst.step,
        description: inst.description,
        time: inst.time || undefined,
        temperature: inst.temperature || undefined,
        speed: inst.speed || undefined,
        function: inst.function || null,
        section: inst.section || null
      })),
      tags: recipeData.tags
    };

    res.json({
      success: true,
      recipe: responseData,
      preview: true, // Indicates this needs user confirmation before saving
      ...(warning ? { warning } : {})
    });

  } catch (error) {
    console.error('Import error:', error);

    let errorMessage = 'Error al import recipe';
    let statusCode = 500;

    if (error instanceof z.ZodError) {
      errorMessage = 'URL inválida provided';
      statusCode = 400;
    } else if (error instanceof Error) {
      errorMessage = error.message;
      if (error.message.includes('No valid recipe found')) {
        statusCode = 404;
      } else if (
        error.message.toLowerCase().includes('no están disponibles los ingredientes')
        || error.message.toLowerCase().includes('faltan los ingredientes')
      ) {
        statusCode = 422;
      } else if (error.message.includes('Error al fetch')) {
        statusCode = 400;
      }
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage
    });
  }
});

// Import recipe from pasted plain text
router.post('/text', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { text, suggestedTitle, multiple } = importTextSchema.parse(req.body);

    console.log(`Starting recipe import from pasted text (${text.length} chars)`);

    if (multiple) {
      const extraction = await llmService.extractMultipleRecipesFromDocument(text);
      if (!extraction.success) {
        return res.status(422).json({
          success: false,
          error: extraction.error || 'No se pudieron detectar recetas en el texto.'
        });
      }

      const recipes = extraction.recipes
        .map(recipe => buildTextImportRecipeResponse(recipe, text))
        .filter(recipe => recipe.title && recipe.ingredients.length > 0 && recipe.instructions.length > 0);

      if (recipes.length === 0) {
        return res.status(422).json({
          success: false,
          error: 'No se pudo importar porque el texto no tiene recetas con nombre, ingredientes y pasos de preparacion disponibles.'
        });
      }

      return res.json({
        success: true,
        recipes,
        preview: true
      });
    }

    const recipeData = await llmService.extractRecipeFromText(text, {
      suggestedTitle,
      context: 'texto pegado manualmente'
    });

    const responseData = buildTextImportRecipeResponse(recipeData, text);

    if (!responseData.title || responseData.ingredients.length === 0 || responseData.instructions.length === 0) {
      return res.status(422).json({
        success: false,
        error: 'No se pudo importar la receta porque el texto no tiene nombre, ingredientes y pasos de preparacion disponibles.'
      });
    }

    res.json({
      success: true,
      recipe: responseData,
      preview: true
    });
  } catch (error) {
    console.error('Text import error:', error);

    let errorMessage = 'Error al importar la receta desde texto';
    let statusCode = 500;

    if (error instanceof z.ZodError) {
      errorMessage = error.errors[0]?.message || 'Texto invalido';
      statusCode = 400;
    } else if (error instanceof Error) {
      errorMessage = error.message;
      if (error.message.includes('No valid recipe found')) {
        errorMessage = 'No se pudo importar la receta porque el texto no tiene nombre, ingredientes y pasos de preparacion disponibles.';
        statusCode = 422;
      }
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage
    });
  }
});

// Validate URL endpoint (for frontend validation)
router.post('/validate-url', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { url } = importUrlSchema.parse(req.body);

    // Basic URL validation using axios for consistency
    const axios = require('axios');
    try {
      const response = await axios({
        method: 'HEAD',
        url: url,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 10000,
        validateStatus: (status: number) => status < 400
      });

      res.json({
        valid: true,
        status: response.status,
        contentType: response.headers['content-type']
      });
    } catch (error: any) {
      res.json({
        valid: false,
        error: 'URL not accessible',
        details: error.message
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'URL inválida format' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
