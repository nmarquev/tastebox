import { useState } from 'react';
import { api } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

export interface NutritionData {
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
}

export interface Ingredient {
  name: string;
  amount: string;
  unit?: string;
}

export const useNutritionCalculator = () => {
  const [isCalculating, setIsCalculating] = useState(false);
  const [nutrition, setNutrition] = useState<NutritionData | null>(null);
  const { toast } = useToast();

  const calculateNutrition = async (ingredients: Ingredient[], servings: number = 4): Promise<NutritionData | null> => {
    const validIngredients = ingredients?.filter(ingredient => ingredient.name?.trim()) ?? [];

    if (validIngredients.length === 0) {
      toast({
        title: "Sin ingredientes",
        description: "No hay ingredientes para calcular nutrición",
        variant: "destructive",
      });
      return null;
    }

    try {
      setIsCalculating(true);
      const parsedServings = Number(servings);
      const servingsForCalculation = Number.isFinite(parsedServings) && parsedServings > 0
        ? parsedServings
        : 4;
      console.log('🥗 Calculating nutrition for:', { ingredients: validIngredients, servings: servingsForCalculation });
      console.log('🔍 Ingredients details:');
      validIngredients.forEach((ing, idx) => {
        console.log(`  ${idx}: name="${ing.name}" amount="${ing.amount}" unit="${ing.unit || 'undefined'}"`);
      });

      const result = await api.nutrition.calculate(validIngredients, servingsForCalculation);

      if (!result.success || !result.nutrition) {
        throw new Error(result.error || 'Error al calcular nutrición');
      }

      console.log('✅ Nutrition calculated:', result.nutrition);
      setNutrition(result.nutrition);
      toast({
        title: "¡Éxito!",
        description: "Información nutricional calculada correctamente",
      });

      return result.nutrition;

    } catch (error) {
      console.error('❌ Error calculating nutrition:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error al calcular información nutricional';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      return null;
    } finally {
      setIsCalculating(false);
    }
  };

  const resetNutrition = () => {
    setNutrition(null);
  };

  return {
    isCalculating,
    nutrition,
    calculateNutrition,
    resetNutrition,
    setNutrition
  };
};
