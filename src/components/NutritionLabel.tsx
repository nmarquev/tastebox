import React from 'react';
import { Calculator } from 'lucide-react';

interface NutritionLabelProps {
  nutrition: {
    calories?: number | null;
    protein?: number | null;
    carbohydrates?: number | null;
    fat?: number | null;
    saturatedFat?: number | null;
    fiber?: number | null;
    sugar?: number | null;
    sodium?: number | null;
  };
  servings?: number;
  showCalculateButton?: boolean;
  onCalculate?: () => void;
  isCalculating?: boolean;
}

export const NutritionLabel: React.FC<NutritionLabelProps> = ({
  nutrition,
  servings = 1,
  showCalculateButton = false,
  onCalculate,
  isCalculating = false
}) => {
  const hasNutritionData = nutrition.calories || nutrition.protein || nutrition.carbohydrates || nutrition.fat;

  if (!hasNutritionData && !showCalculateButton) {
    return null;
  }

  return (
    <div className="bg-white border border-[#6f6f6d] p-3 text-xs font-mono max-w-[15rem] leading-tight">
      {/* Header */}
      <div className="border-b-4 border-[#6f6f6d] pb-0.5 mb-1">
        <h3 className="text-sm font-bold text-[#6f6f6d]">Información Nutricional</h3>
        <p className="text-[10px] text-[#6f6f6d]">Por porción</p>
        {servings > 1 && <p className="text-[10px] text-[#6f6f6d]">Porciones: {servings}</p>}
      </div>

      {hasNutritionData ? (
        <>
          {/* Calories */}
          {nutrition.calories && (
            <div className="border-b border-gray-400 py-0.5">
              <div className="flex justify-between items-center">
                <span className="font-bold text-sm">Calorías</span>
                <span className="font-bold text-sm">{Math.round(nutrition.calories)}</span>
              </div>
            </div>
          )}

          <div className="border-b-2 border-[#6f6f6d] py-0.5 mb-1">
            <p className="text-[10px] text-[#6f6f6d] text-right">% Valor Diario*</p>
          </div>

          {/* Macronutrients */}
          <div className="space-y-0">
            {nutrition.fat !== null && nutrition.fat !== undefined && (
              <div className="flex justify-between gap-3 border-b border-gray-300 py-0.5">
                <span className="font-bold">Grasa Total</span>
                <span>{nutrition.fat.toFixed(2)}g</span>
              </div>
            )}

            {nutrition.saturatedFat !== null && nutrition.saturatedFat !== undefined && (
              <div className="flex justify-between gap-3 border-b border-gray-300 py-0.5 pl-4">
                <span>Grasas Saturadas</span>
                <span>{nutrition.saturatedFat.toFixed(2)}g</span>
              </div>
            )}

            {nutrition.sodium !== null && nutrition.sodium !== undefined && (
              <div className="flex justify-between gap-3 border-b border-gray-300 py-0.5">
                <span className="font-bold">Sodio</span>
                <span>{Math.round(nutrition.sodium)}mg</span>
              </div>
            )}

            {nutrition.carbohydrates !== null && nutrition.carbohydrates !== undefined && (
              <div className="flex justify-between gap-3 border-b border-gray-300 py-0.5">
                <span className="font-bold">Carbohidratos Totales</span>
                <span>{nutrition.carbohydrates.toFixed(2)}g</span>
              </div>
            )}

            {nutrition.fiber !== null && nutrition.fiber !== undefined && (
              <div className="flex justify-between gap-3 border-b border-gray-300 py-0.5 pl-4">
                <span>Fibra Dietética</span>
                <span>{nutrition.fiber.toFixed(2)}g</span>
              </div>
            )}

            {nutrition.sugar !== null && nutrition.sugar !== undefined && (
              <div className="flex justify-between gap-3 border-b border-gray-300 py-0.5 pl-4">
                <span>Azúcares Totales</span>
                <span>{nutrition.sugar.toFixed(2)}g</span>
              </div>
            )}

            {nutrition.protein !== null && nutrition.protein !== undefined && (
              <div className="flex justify-between gap-3 border-b border-gray-300 py-0.5">
                <span className="font-bold">Proteína</span>
                <span>{nutrition.protein.toFixed(2)}g</span>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="py-4 text-center text-gray-500">
          <p className="mb-2">No hay información nutricional disponible</p>
        </div>
      )}

      {showCalculateButton && (
        <div className="mt-3 pt-3 border-t border-gray-300">
          <button
            onClick={onCalculate}
            disabled={isCalculating}
            className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent/90 text-accent-foreground px-3 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Calculator className="h-4 w-4" />
            {isCalculating ? 'Calculando...' : 'Calcular Nutrientes'}
          </button>
        </div>
      )}
    </div>
  );
};