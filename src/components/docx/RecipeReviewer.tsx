import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import {
  Save,
  SkipForward,
  Clock,
  Users,
  ChefHat,
  FileText,
  CheckCircle,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight
} from "lucide-react";
import { DocxExtractedRecipe } from "@/types/docx";

interface RecipeReviewerProps {
  recipe: DocxExtractedRecipe;
  recipeIndex: number;
  totalRecipes: number;
  isSaved: boolean;
  onSave: () => void;
  onSaveAll?: () => void;
  onSkip: () => void;
  loading: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
}

export const RecipeReviewer = ({
  recipe,
  recipeIndex,
  totalRecipes,
  isSaved,
  onSave,
  onSaveAll,
  onSkip,
  loading,
  onPrevious,
  onNext
}: RecipeReviewerProps) => {
  const [showRawContent, setShowRawContent] = useState(false);

  const estimatedData = recipe.estimatedData;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold">
          Revisar Receta {recipeIndex + 1} de {totalRecipes}
        </h3>
      </div>

      {/* Action Buttons (arriba de la vista previa) */}
      <div className="flex justify-center space-x-4">
        <Button
          variant="outline"
          size="lg"
          onClick={onSkip}
          disabled={loading}
        >
          <SkipForward className="h-4 w-4 mr-2" />
          Saltar Esta Receta
        </Button>

        <Button
          size="lg"
          onClick={onSave}
          disabled={loading || isSaved}
          className="px-8"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Guardando...
            </>
          ) : isSaved ? (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Ya Guardada
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Guardar Receta
            </>
          )}
        </Button>

        {onSaveAll && totalRecipes > 1 && (
          <Button
            variant="secondary"
            size="lg"
            onClick={onSaveAll}
            disabled={loading}
          >
            <Save className="h-4 w-4 mr-2" />
            Guardar todas las recetas
          </Button>
        )}
      </div>

      {/* Navegación entre recetas (arriba del recuadro) */}
      {totalRecipes > 1 && (
        <div className="flex justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onPrevious}
            disabled={recipeIndex === 0}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onNext}
            disabled={recipeIndex >= totalRecipes - 1}
          >
            Siguiente
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}

      {/* Calidad de Extracción (arriba de la vista previa) */}
      <Card>
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="flex items-center space-x-2 text-sm">
            <FileText className="h-4 w-4" />
            <span>Calidad de Extracción</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-3 pt-0">
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <div className="text-base font-semibold text-green-600">{estimatedData?.title ? '✓' : '⚠️'}</div>
              <div className="text-xs text-muted-foreground">Título</div>
            </div>
            <div>
              <div className="text-base font-semibold text-green-600">{estimatedData?.ingredients?.length || 0}</div>
              <div className="text-xs text-muted-foreground">Ingredientes</div>
            </div>
            <div>
              <div className="text-base font-semibold text-green-600">{estimatedData?.instructions?.length || 0}</div>
              <div className="text-xs text-muted-foreground">Pasos</div>
            </div>
            <div>
              <div className="text-base font-semibold text-green-600">{estimatedData?.prepTime ? '✓' : '⚠️'}</div>
              <div className="text-xs text-muted-foreground">Tiempos</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recipe Preview */}
      <Card className={isSaved ? "border-green-200 bg-green-50" : ""}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <ChefHat className="h-5 w-5" />
              <span>{estimatedData?.title || recipe.title}</span>
            </CardTitle>
            {isSaved && (
              <Badge variant="outline" className="border-green-500 text-green-700">
                <CheckCircle className="h-3 w-3 mr-1" />
                Guardada
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Info */}
          {estimatedData?.description && (
            <div>
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide mb-2">
                Descripción
              </h4>
              <p className="text-sm">{estimatedData.description}</p>
            </div>
          )}

          {/* Recipe Meta */}
          <div className="flex flex-wrap gap-4 text-sm">
            {estimatedData?.prepTime && (
              <div className="flex items-center space-x-1">
                <Clock className="h-4 w-4 text-blue-500" />
                <span>{estimatedData.prepTime} min preparación</span>
              </div>
            )}
            {estimatedData?.cookTime && (
              <div className="flex items-center space-x-1">
                <Clock className="h-4 w-4 text-orange-500" />
                <span>{estimatedData.cookTime} min cocción</span>
              </div>
            )}
            {estimatedData?.servings && (
              <div className="flex items-center space-x-1">
                <Users className="h-4 w-4 text-green-500" />
                <span>{estimatedData.servings} porciones</span>
              </div>
            )}
          </div>

          {/* Ingredients */}
          {estimatedData?.ingredients && estimatedData.ingredients.length > 0 && (
            <div>
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide mb-3">
                Ingredientes ({estimatedData.ingredients.length})
              </h4>
              <div className="space-y-1">
                {estimatedData.ingredients.map((ingredient, index) => (
                  <div key={index} className="flex items-start space-x-2 text-sm">
                    <span className="text-muted-foreground mt-1">•</span>
                    <span>{ingredient}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Instructions */}
          {estimatedData?.instructions && estimatedData.instructions.length > 0 && (
            <div>
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide mb-3">
                Instrucciones ({estimatedData.instructions.length} pasos)
              </h4>
              <div className="space-y-3">
                {estimatedData.instructions.map((instruction, index) => (
                  <div key={index} className="flex items-start space-x-3 text-sm">
                    <div className="flex-shrink-0 w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center text-xs font-semibold text-primary">
                      {index + 1}
                    </div>
                    <span>{typeof instruction === 'string' ? instruction : instruction.description || JSON.stringify(instruction)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Raw Content Toggle */}
          <div className="border-t pt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowRawContent(!showRawContent)}
              className="text-muted-foreground"
            >
              {showRawContent ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
              {showRawContent ? 'Ocultar contenido original' : 'Ver contenido original'}
            </Button>

            {showRawContent && (
              <div className="mt-3">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide mb-2">
                  Contenido Original del Documento
                </h4>
                <Textarea
                  value={recipe.content}
                  readOnly
                  className="min-h-[200px] font-mono text-xs resize-none"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Warnings */}
      {(!estimatedData?.ingredients || estimatedData.ingredients.length === 0) && (
        <Alert>
          <AlertDescription>
            <strong>Advertencia:</strong> No se detectaron ingredientes en esta receta.
            Revisa el contenido original y considera editarla manualmente después de guardarla.
          </AlertDescription>
        </Alert>
      )}

      {(!estimatedData?.instructions || estimatedData.instructions.length === 0) && (
        <Alert>
          <AlertDescription>
            <strong>Advertencia:</strong> No se detectaron instrucciones en esta receta.
            Revisa el contenido original y considera editarla manualmente después de guardarla.
          </AlertDescription>
        </Alert>
      )}

      {/* Progress Indicator */}
      <div className="text-center text-sm text-muted-foreground">
        Receta {recipeIndex + 1} de {totalRecipes}
        {recipeIndex < totalRecipes - 1 && (
          <span> • {totalRecipes - recipeIndex - 1} restantes</span>
        )}
      </div>
    </div>
  );
};