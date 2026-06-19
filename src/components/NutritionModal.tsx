import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NutritionLabel } from "@/components/NutritionLabel";
import { Recipe } from "@/types/recipe";
import { useNutritionCalculator } from "@/hooks/useNutritionCalculator";
import { api } from "@/services/api";
import { Loader2 } from "lucide-react";

interface NutritionModalProps {
  recipe: Recipe | null;
  isOpen: boolean;
  onClose: () => void;
  onRecipeUpdate?: (updatedRecipe: Recipe) => void;
}

export const NutritionModal = ({ recipe, isOpen, onClose, onRecipeUpdate }: NutritionModalProps) => {
  const [currentRecipe, setCurrentRecipe] = useState<Recipe | null>(recipe);
  const [isCalculating, setIsCalculating] = useState(false);
  const [hasCalculated, setHasCalculated] = useState(false);
  const { calculateNutrition } = useNutritionCalculator();

  useEffect(() => {
    setCurrentRecipe(recipe);
    setHasCalculated(false); // Reset flag when recipe changes
  }, [recipe]);

  useEffect(() => {
    const autoCalculateNutrition = async () => {
      if (!recipe || !isOpen || hasCalculated) return;

      const hasNutritionData = recipe.calories !== null && recipe.calories !== undefined && recipe.calories > 0;

      if (!hasNutritionData && recipe.ingredients?.length > 0) {
        setIsCalculating(true);

        try {
          const result = await calculateNutrition(recipe.ingredients, recipe.servings);

          if (result) {
            // Update the recipe with calculated nutrition data
            const updatedRecipe = {
              ...recipe,
              calories: result.calories,
              protein: result.protein,
              carbohydrates: result.carbohydrates,
              fat: result.fat,
              fiber: result.fiber,
              sugar: result.sugar,
              sodium: result.sodium
            };

            // Clean the recipe data to match API expectations
            const cleanedRecipe = {
              title: updatedRecipe.title,
              description: updatedRecipe.description || undefined,
              suggestions: updatedRecipe.suggestions || undefined,
              prepTime: updatedRecipe.prepTime,
              cookTime: updatedRecipe.cookTime,
              servings: updatedRecipe.servings,
              difficulty: updatedRecipe.difficulty,
              recipeType: updatedRecipe.recipeType,
              locution: updatedRecipe.locution || "",
              calories: updatedRecipe.calories,
              protein: updatedRecipe.protein,
              carbohydrates: updatedRecipe.carbohydrates,
              fat: updatedRecipe.fat,
              fiber: updatedRecipe.fiber,
              sugar: updatedRecipe.sugar,
              sodium: updatedRecipe.sodium,
              images: (updatedRecipe.images || []).map((image, index) => ({
                url: image.url,
                localPath: image.localPath ?? undefined,
                order: image.order || index + 1,
                altText: image.altText ?? undefined,
              })),
              ingredients: updatedRecipe.ingredients.map((ing, index) => ({
                name: ing.name,
                amount: ing.amount || "",  // Ensure amount is never null/undefined
                unit: ing.unit || "",
                section: ing.section || undefined, // Include section for multi-part recipes
                order: ing.order || index + 1
              })),
              instructions: updatedRecipe.instructions.map((inst, index) => ({
                step: inst.step || index + 1,
                description: inst.description,
                time: inst.thermomixSettings?.time || "",
                temperature: inst.thermomixSettings?.temperature || "",
                speed: inst.thermomixSettings?.speed || "",
                section: inst.section || undefined // Include section for multi-part recipes
              })),
              tags: updatedRecipe.tags
            };

            // Save to backend
            const savedRecipe = await api.recipes.update(recipe.id, cleanedRecipe);

            // Update local state
            setCurrentRecipe(savedRecipe);

            // Notify parent component of the update
            if (onRecipeUpdate) {
              onRecipeUpdate(savedRecipe);
            }
          }
        } catch (error) {
          console.error('Error auto-calculating nutrition:', error);
        } finally {
          setIsCalculating(false);
          setHasCalculated(true); // Mark as calculated to prevent re-runs
        }
      }
    };

    autoCalculateNutrition();
  }, [recipe, isOpen, hasCalculated]); // hasCalculated prevents infinite loop

  if (!currentRecipe) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Información Nutricional</DialogTitle>
          <p className="text-muted-foreground">{currentRecipe.title}</p>
        </DialogHeader>

        <div className="flex justify-center py-4">
          {isCalculating ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Calculando información nutricional...</p>
            </div>
          ) : (
            <NutritionLabel
              nutrition={{
                calories: currentRecipe.calories,
                protein: currentRecipe.protein,
                carbohydrates: currentRecipe.carbohydrates,
                fat: currentRecipe.fat,
                saturatedFat: currentRecipe.saturatedFat,
                fiber: currentRecipe.fiber,
                sugar: currentRecipe.sugar,
                sodium: currentRecipe.sodium
              }}
              servings={currentRecipe.servings}
              showCalculateButton={false}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
