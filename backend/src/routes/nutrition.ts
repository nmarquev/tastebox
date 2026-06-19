import express from 'express';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { LLMServiceImproved } from '../services/llmServiceImproved';

const router = express.Router();
const llmService = new LLMServiceImproved();

// Validation schema for nutrition calculation request
const calculateNutritionSchema = z.object({
  ingredients: z.array(z.object({
    name: z.string().min(1),
    amount: z.string(),  // Permitir strings vacíos para "al gusto"
    unit: z.string().nullable().optional().transform(val => val ?? '')
  })).min(1),
  servings: z.number().min(1).default(4)
});

// Calculate nutrition for ingredients
router.post('/calculate', authenticateToken, async (req: AuthRequest, res) => {
  try {
    console.log('🥗 Nutrition calculation request received');
    console.log('📝 Request body:', JSON.stringify(req.body, null, 2));

    // Debug ingredients before validation
    if (req.body.ingredients) {
      console.log('🔍 Ingredients debug:');
      (req.body.ingredients as Array<{ name?: unknown; amount?: unknown; unit?: unknown }>).forEach((ing, idx) => {
        console.log(`  ${idx}: name="${ing.name}" amount="${ing.amount}" unit="${ing.unit}"`);
      });
    }

    const data = calculateNutritionSchema.parse(req.body);

    // Cap servings at 20 for nutrition calculation to prevent API abuse
    const cappedServings = Math.min(data.servings, 20);

    console.log('✅ Validation passed');
    console.log('📊 Processing ingredients:', data.ingredients.length);
    console.log('🍽️ Original servings:', data.servings);
    console.log('🍽️ Capped servings for calculation:', cappedServings);

    // Filter valid ingredients with required fields
    const validIngredients = data.ingredients.filter(ing => ing.name && ing.amount) as { name: string; amount: string; unit?: string; }[];

    const result = await llmService.calculateNutrition(validIngredients, cappedServings);

    if (!result.success) {
      console.error('❌ Nutrition calculation failed:', result.error);
      return res.status(500).json({
        error: 'Error al calculate nutrition',
        details: result.error
      });
    }

    console.log('✅ Nutrition calculation successful');
    console.log('📊 Result:', result.nutrition);

    res.json({
      success: true,
      nutrition: result.nutrition
    });

  } catch (error) {
    console.error('❌ Nutrition calculation endpoint error:', error);

    if (error instanceof z.ZodError) {
      console.error('🔍 Validation error details:', JSON.stringify(error.errors, null, 2));
      console.error('🔍 Failed fields:');
      error.errors.forEach(err => {
        console.error(`  Path: ${err.path.join('.')} - Code: ${err.code} - Message: ${err.message}`);
      });
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

export default router;
