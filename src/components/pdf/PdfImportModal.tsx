import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileText, Zap, CheckCircle } from 'lucide-react';
import { PdfUploader } from './PdfUploader';
import { PdfPageSelector } from './PdfPageSelector';
import { PdfRecipeExtractor } from './PdfRecipeExtractor';
import { PdfRecipeReviewer } from './PdfRecipeReviewer';
import { PdfUploadResponse, PdfExtractedRecipe, PageRange } from '@/types/pdf';
import { api } from '@/services/api';

interface PdfImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecipeSaved: (recipeId: string) => void;
}

type ImportStep = 'upload' | 'selectPages' | 'extract' | 'review';

export const PdfImportModal = ({ isOpen, onClose, onRecipeSaved }: PdfImportModalProps) => {
  // State management
  const [currentStep, setCurrentStep] = useState<ImportStep>('upload');
  const [uploadData, setUploadData] = useState<PdfUploadResponse | null>(null);
  const [selectedPages, setSelectedPages] = useState<PageRange | null>(null);
  const [extractedRecipes, setExtractedRecipes] = useState<PdfExtractedRecipe[]>([]);
  const [currentRecipeIndex, setCurrentRecipeIndex] = useState(0);
  const [savedRecipes, setSavedRecipes] = useState<Set<string>>(new Set());

  // Loading states
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Error handling
  const [error, setError] = useState<string | null>(null);

  const resetModal = () => {
    setCurrentStep('upload');
    setUploadData(null);
    setSelectedPages(null);
    setExtractedRecipes([]);
    setCurrentRecipeIndex(0);
    setSavedRecipes(new Set());
    setUploading(false);
    setExtracting(false);
    setSaving(false);
    setError(null);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const handleUploadSuccess = (result: PdfUploadResponse) => {
    console.log('✅ PDF upload successful:', result);
    setUploadData(result);
    setCurrentStep('selectPages');
    setError(null);
  };

  const handlePageSelection = (pageRange: PageRange) => {
    console.log('📖 Pages selected:', pageRange);
    setSelectedPages(pageRange);
    setCurrentStep('extract');
    setError(null);
  };

  const handleExtractRecipes = async () => {
    if (!uploadData || !selectedPages) return;

    setExtracting(true);
    setError(null);

    try {
      console.log('🤖 Starting recipe extraction with GPT-5-mini...');

      const result = await api.pdf.extract(
        uploadData.fileId,
        selectedPages.start,
        selectedPages.end
      );

      if (result.success && result.recipes.length > 0) {
        console.log(`✅ Extracted ${result.recipes.length} recipes`);
        setExtractedRecipes(result.recipes);
        setCurrentStep('review');
      } else {
        throw new Error('No se encontraron recetas en las páginas seleccionadas');
      }

    } catch (error: any) {
      console.error('❌ Recipe extraction error:', error);
      setError(error.message || 'Error al extraer recetas del PDF');
    } finally {
      setExtracting(false);
    }
  };

  const handleSaveRecipe = async () => {
    const currentRecipe = extractedRecipes[currentRecipeIndex];
    if (!currentRecipe || savedRecipes.has(currentRecipe.id)) return;

    setSaving(true);
    setError(null);

    try {
      console.log('💾 Saving recipe:', currentRecipe.title);

      // Prepare recipe data for saving
      const rawIngredients = currentRecipe.estimatedData?.ingredients || [];
      const rawInstructions = currentRecipe.estimatedData?.instructions || [];

      console.log('🔍 DEBUG: Raw data from LLM:');
      console.log('📝 Raw ingredients type:', typeof rawIngredients, Array.isArray(rawIngredients));
      console.log('📝 Raw ingredients sample:', rawIngredients.slice(0, 2));
      console.log('📝 Raw instructions type:', typeof rawInstructions, Array.isArray(rawInstructions));
      console.log('📝 Raw instructions sample:', rawInstructions.slice(0, 2));

      // Convert ingredients to proper format
      const ingredients = rawIngredients.map((ingredient: any, index: number) => {
        if (typeof ingredient === 'string') {
          // Parse string ingredient to extract amount and name (legacy format)
          const parts = ingredient.trim().split(/\s+/);
          const amount = parts[0] || '1';
          const name = parts.slice(1).join(' ') || ingredient;
          return {
            name: name,
            amount: amount,
            unit: '',
            order: index + 1
          };
        }
        // If already an object (new format), ensure it has required fields
        return {
          name: ingredient.name || ingredient.toString(),
          amount: ingredient.amount || '1',
          unit: ingredient.unit || '',
          order: index + 1
        };
      });

      // Convert instructions to proper format
      const instructions = rawInstructions.map((instruction: any, index: number) => {
        if (typeof instruction === 'string') {
          // String format (legacy format)
          return {
            step: index + 1,
            description: instruction,
            time: "",
            temperature: "",
            speed: ""
          };
        }
        // If already an object (new format), ensure it has required fields
        return {
          step: instruction.step || index + 1,
          description: instruction.description || instruction.toString(),
          time: instruction.time || "",
          temperature: instruction.temperature || "",
          speed: instruction.speed || ""
        };
      });

      const recipeData = {
        title: currentRecipe.estimatedData?.title || currentRecipe.title,
        description: currentRecipe.estimatedData?.description || '',
        ingredients,
        instructions,
        prepTime: currentRecipe.estimatedData?.prepTime || 30,
        cookTime: currentRecipe.estimatedData?.cookTime,
        servings: currentRecipe.estimatedData?.servings || 4,
        difficulty: currentRecipe.estimatedData?.difficulty || 'Medio',
        recipeType: currentRecipe.estimatedData?.recipeType || 'Otro',
        importedFrom: 'doc' as const,
        tags: currentRecipe.estimatedData?.tags || [],
        images: currentRecipe.thumbnailUrl ? [{
          url: currentRecipe.thumbnailUrl,
          localPath: null,
          order: 1,
          altText: `Imagen de ${currentRecipe.title}`
        }] : []
      };

      console.log('🔍 DEBUG: Recipe data being sent to API:');
      console.log('📝 Ingredients sample:', ingredients.slice(0, 2));
      console.log('📝 Instructions sample:', instructions.slice(0, 2));
      console.log('📝 Raw data structure:', {
        ingredientsType: typeof ingredients,
        instructionsType: typeof instructions,
        ingredientsLength: ingredients.length,
        instructionsLength: instructions.length
      });

      const savedRecipe = await api.recipes.create(recipeData);
      console.log('✅ Recipe saved successfully:', savedRecipe.id);

      // Mark as saved
      setSavedRecipes(prev => new Set([...prev, currentRecipe.id]));
      onRecipeSaved(savedRecipe.id);

      // Move to next recipe automatically after a short delay
      setTimeout(() => {
        handleNextRecipe();
      }, 1500);

    } catch (error: any) {
      console.error('❌ Save recipe error:', error);
      setError(error.message || 'Error al guardar la receta');
    } finally {
      setSaving(false);
    }
  };

  const handleSkipRecipe = () => {
    handleNextRecipe();
  };

  const handleNextRecipe = () => {
    if (currentRecipeIndex < extractedRecipes.length - 1) {
      setCurrentRecipeIndex(prev => prev + 1);
    } else {
      // All recipes processed
      handleClose();
    }
  };

  const getStepProgress = () => {
    const steps = ['upload', 'selectPages', 'extract', 'review'];
    const currentIndex = steps.indexOf(currentStep);
    return ((currentIndex + 1) / steps.length) * 100;
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 'upload':
        return 'Subir PDF';
      case 'selectPages':
        return 'Seleccionar Páginas';
      case 'extract':
        return 'Extraer Recetas';
      case 'review':
        return 'Revisar Recetas';
      default:
        return 'Importar PDF';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-4">
          <DialogTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-blue-600" />
            <span>Importar Recetas desde PDF</span>
          </DialogTitle>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{getStepTitle()}</span>
              <span>Paso {['upload', 'selectPages', 'extract', 'review'].indexOf(currentStep) + 1} de 4</span>
            </div>
            <Progress value={getStepProgress()} className="h-2" />
          </div>

          {/* Step Indicators */}
          <div className="flex justify-center space-x-8">
            {[
              { key: 'upload', label: 'Subir', icon: FileText },
              { key: 'selectPages', label: 'Páginas', icon: FileText },
              { key: 'extract', label: 'Extraer', icon: Zap },
              { key: 'review', label: 'Revisar', icon: CheckCircle }
            ].map((step, index) => {
              const isActive = currentStep === step.key;
              const isCompleted = ['upload', 'selectPages', 'extract', 'review'].indexOf(currentStep) > index;
              const Icon = step.icon;

              return (
                <div
                  key={step.key}
                  className={`flex flex-col items-center space-y-1 ${
                    isActive ? 'text-primary' : isCompleted ? 'text-green-600' : 'text-muted-foreground'
                  }`}
                >
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center
                    ${isActive ? 'bg-primary text-white' : isCompleted ? 'bg-green-100' : 'bg-gray-100'}
                  `}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-medium">{step.label}</span>
                </div>
              );
            })}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Step Content */}
          {currentStep === 'upload' && (
            <PdfUploader
              onUploadSuccess={handleUploadSuccess}
              loading={uploading}
            />
          )}

          {currentStep === 'selectPages' && uploadData && (
            <PdfPageSelector
              uploadData={uploadData}
              onPageSelect={handlePageSelection}
              loading={false}
            />
          )}

          {currentStep === 'extract' && uploadData && selectedPages && (
            <PdfRecipeExtractor
              uploadData={uploadData}
              selectedPages={selectedPages}
              onExtract={handleExtractRecipes}
              loading={extracting}
            />
          )}

          {currentStep === 'review' && extractedRecipes.length > 0 && (
            <PdfRecipeReviewer
              recipe={extractedRecipes[currentRecipeIndex]}
              recipeIndex={currentRecipeIndex}
              totalRecipes={extractedRecipes.length}
              isSaved={savedRecipes.has(extractedRecipes[currentRecipeIndex].id)}
              onSave={handleSaveRecipe}
              onSkip={handleSkipRecipe}
              loading={saving}
            />
          )}
        </div>

        {/* Summary Info */}
        {extractedRecipes.length > 0 && currentStep === 'review' && (
          <div className="border-t pt-4 text-center text-sm text-muted-foreground">
            <div className="flex justify-center items-center space-x-4">
              <span>📄 {uploadData?.totalPages} páginas totales</span>
              <span>📖 {selectedPages ? `${selectedPages.start}-${selectedPages.end}` : ''} procesadas</span>
              <span>🍽️ {extractedRecipes.length} recetas encontradas</span>
              <span>✅ {savedRecipes.size} guardadas</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
