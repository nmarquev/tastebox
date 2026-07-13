import express from 'express';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { LLMServiceImproved } from '../services/llmServiceImproved';

const llmService = new LLMServiceImproved();

const router = express.Router();

const generateScriptSchema = z.object({
  prompt: z.string().min(1)
});

const searchRecipesSchema = z.object({
  query: z.string().min(1),
  count: z.number().min(1).max(10).optional().default(3),
  offset: z.number().min(0).optional().default(0)
});

router.post('/generate-script', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { prompt } = generateScriptSchema.parse(req.body);

    const result = await llmService.generateText(prompt);

    if (result.success && result.content) {
      res.json({
        success: true,
        script: result.content
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Error al generate script'
      });
    }
  } catch (error) {
    console.error('Generate script error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/search-recipes', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { query, count, offset } = searchRecipesSchema.parse(req.body);

    console.log('🔍 Recipe search request:', { query, count, offset, userId: req.user?.id });

    const result = await llmService.searchRecipesWithAI(query, count, offset);

    if (result.success) {
      res.json({
        success: true,
        recipes: result.recipes,
        hasMore: result.hasMore,
        source: 'ai_search',
        query,
        count: result.recipes.length,
        offset
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Error al search recipes',
        query
      });
    }
  } catch (error) {
    console.error('Search recipes error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

const translateRecipeSchema = z.object({
  title: z.string().optional().default(''),
  description: z.string().optional().default(''),
  suggestions: z.string().optional().default(''),
  ingredients: z.array(z.string()).optional().default([]),
  instructions: z.array(z.string()).optional().default([]),
});

// Traduce una receta al español usando el LLM.
router.post('/translate-recipe', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const data = translateRecipeSchema.parse(req.body);

    const prompt = `Traducí al español (español neutro) la siguiente receta, incluyendo el nombre de cada ingrediente (por ejemplo "flour" -> "harina", "cup" -> "taza").
Mantené los números/cantidades tal cual, pero traducí las unidades y el texto.
Devolvé EXCLUSIVAMENTE un JSON válido, sin texto adicional, con esta forma exacta:
{"title": string, "description": string, "suggestions": string, "ingredients": string[], "instructions": string[]}
Mantené el mismo orden y la misma cantidad de elementos en "ingredients" e "instructions".

Importante: si un ingrediente menciona oz, ounce, ounces, onza u onzas, converti esa cantidad a gramos usando 1 oz = 28.35 g, redondea al gramo mas cercano y usa la unidad "g".
Importante: si un ingrediente menciona tsp, teaspoon o teaspoons, traducilo como "cucharadita"; si menciona tbsp, tablespoon o tablespoons, traducilo como "cucharada".

Receta a traducir (en JSON):
${JSON.stringify(data)}`;

    const result = await llmService.generateText(prompt);
    if (!result.success || !result.content) {
      return res.status(500).json({ success: false, error: result.error || 'No se pudo traducir la receta' });
    }

    // Extraer el JSON de la respuesta (por si viene con texto alrededor).
    const match = result.content.match(/\{[\s\S]*\}/);
    if (!match) {
      return res.status(500).json({ success: false, error: 'Respuesta de traducción no válida' });
    }

    const parsed = JSON.parse(match[0]);
    res.json({
      success: true,
      title: typeof parsed.title === 'string' ? parsed.title : data.title,
      description: typeof parsed.description === 'string' ? parsed.description : data.description,
      suggestions: typeof parsed.suggestions === 'string' ? parsed.suggestions : data.suggestions,
      ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : data.ingredients,
      instructions: Array.isArray(parsed.instructions) ? parsed.instructions : data.instructions,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Datos de receta no válidos' });
    }
    console.error('Translate recipe error:', error);
    res.status(500).json({ success: false, error: 'No se pudo traducir la receta' });
  }
});

export default router;
