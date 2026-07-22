import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/services/api';
import { ImportRecipeResponse, Recipe } from '@/types/recipe';
import { Check, ClipboardPaste, FileText, Loader2, X } from 'lucide-react';
import { SINGLE_IMPORT_ERROR_TOAST_DURATION_MS } from '@/constants/toastDurations';

interface TextImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecipeSaved?: (recipeId: string) => void;
}

export const TextImportModal = ({ isOpen, onClose, onRecipeSaved }: TextImportModalProps) => {
  const [text, setText] = useState('');
  const [suggestedTitle, setSuggestedTitle] = useState('');
  const [importMode, setImportMode] = useState<'single' | 'multiple'>('single');
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!isOpen) {
      abortRef.current?.abort();
      abortRef.current = null;
      setText('');
      setSuggestedTitle('');
      setImportMode('single');
      setIsLoading(false);
    }
  }, [isOpen]);

  const saveImportedRecipe = async (recipe: NonNullable<ImportRecipeResponse['recipe']>) => {
    return api.recipes.create({
      title: recipe.title,
      description: recipe.description,
      suggestions: recipe.suggestions,
      images: recipe.images || [],
      prepTime: recipe.prepTime,
      cookTime: recipe.cookTime,
      servings: recipe.servings,
      difficulty: undefined,
      tags: recipe.tags || [],
      ingredients: recipe.ingredients || [],
      instructions: recipe.instructions || [],
      sourceUrl: recipe.sourceUrl,
      source: recipe.source,
      author: recipe.author,
      importedFrom: recipe.importedFrom || 'recetario',
      recipeType: undefined,
      country: undefined,
      language: recipe.language,
      thermomix: recipe.thermomix,
      airFryer: recipe.airFryer,
      glutenFree: recipe.glutenFree,
      sugarFree: recipe.sugarFree,
      keto: recipe.keto,
      lowCarb: recipe.lowCarb,
      proteica: recipe.proteica,
      vegetarian: recipe.vegetarian,
      sweet: recipe.sweet,
      savory: recipe.savory,
      calories: recipe.calories,
      protein: recipe.protein,
      carbohydrates: recipe.carbohydrates,
      fat: recipe.fat,
      saturatedFat: recipe.saturatedFat,
      fiber: recipe.fiber,
      sugar: recipe.sugar,
      sodium: recipe.sodium
    } as Omit<Recipe, 'id' | 'userId' | 'createdAt' | 'updatedAt'>);
  };

  const handlePaste = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      if (!clipboardText.trim()) {
        toast({
          title: 'Portapapeles vacio',
          description: 'No hay texto para pegar',
          variant: 'destructive',
          duration: SINGLE_IMPORT_ERROR_TOAST_DURATION_MS,
        });
        return;
      }
      setText(clipboardText);
    } catch {
      toast({
        title: 'No se pudo pegar',
        description: 'Permiti el acceso al portapapeles o pega el texto manualmente',
        variant: 'destructive',
        duration: SINGLE_IMPORT_ERROR_TOAST_DURATION_MS,
      });
    }
  };

  const handleImport = async () => {
    const cleanedText = text.trim();
    if (cleanedText.length < 20) {
      toast({
        title: 'Texto requerido',
        description: 'Pega el texto completo de la receta',
        variant: 'destructive',
        duration: SINGLE_IMPORT_ERROR_TOAST_DURATION_MS,
      });
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);

    try {
      const response = await api.import.fromText(
        cleanedText,
        importMode === 'single' ? suggestedTitle.trim() || undefined : undefined,
        controller.signal,
        importMode === 'multiple'
      );

      if (!response.success) {
        throw new Error(response.error || 'No se pudo detectar una receta en el texto');
      }

      if (importMode === 'multiple') {
        const recipes = response.recipes || [];
        if (recipes.length === 0) {
          throw new Error(response.error || 'No se detectaron recetas completas en el texto');
        }

        let lastRecipeId = '';
        let savedCount = 0;
        const failedTitles: string[] = [];
        for (const recipe of recipes) {
          try {
            const savedRecipe = await saveImportedRecipe(recipe);
            lastRecipeId = savedRecipe.id;
            savedCount += 1;
          } catch (saveError) {
            console.error('Error saving imported text recipe:', saveError);
            failedTitles.push(recipe.title || 'Receta sin nombre');
          }
        }

        if (savedCount === 0) {
          throw new Error(
            failedTitles.length
              ? `No se pudo guardar ninguna receta. Revisa los datos detectados: ${failedTitles.slice(0, 3).join(', ')}`
              : 'No se pudo guardar ninguna receta detectada'
          );
        }

        toast({
          title: 'Recetas importadas',
          description: failedTitles.length
            ? `Se guardaron ${savedCount} recetas. No se pudieron guardar ${failedTitles.length}.`
            : `Se guardaron ${savedCount} recetas`,
        });
        if (lastRecipeId) onRecipeSaved?.(lastRecipeId);
        onClose();
        return;
      }

      if (!response.recipe) {
        throw new Error(response.error || 'No se pudo detectar una receta en el texto');
      }

      const savedRecipe = await saveImportedRecipe(response.recipe);
      toast({
        title: 'Receta importada',
        description: `Se guardo: ${savedRecipe.title}`,
      });
      onRecipeSaved?.(savedRecipe.id);
      onClose();
    } catch (error) {
      if ((error as { name?: string })?.name === 'AbortError') return;
      const message = error instanceof Error ? error.message : 'No se pudo importar la receta desde texto';
      toast({
        title: 'Error al importar texto',
        description: message,
        variant: 'destructive',
        duration: SINGLE_IMPORT_ERROR_TOAST_DURATION_MS,
      });
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-h-[90vh] max-w-3xl overflow-y-auto"
        closeButtonClassName="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground opacity-100 hover:bg-primary/90 hover:text-primary-foreground"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Importar receta desde texto
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Que queres importar?</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={importMode === 'single' ? 'default' : 'outline'}
                onClick={() => setImportMode('single')}
                disabled={isLoading}
              >
                Una receta
              </Button>
              <Button
                type="button"
                variant={importMode === 'multiple' ? 'default' : 'outline'}
                onClick={() => setImportMode('multiple')}
                disabled={isLoading}
              >
                Varias recetas
              </Button>
            </div>
          </div>

          {importMode === 'single' && (
          <div className="space-y-2">
            <Label htmlFor="text-import-title">Nombre sugerido (opcional)</Label>
            <Input
              id="text-import-title"
              value={suggestedTitle}
              onChange={(event) => setSuggestedTitle(event.target.value)}
              placeholder="Ej: Brownies sin gluten"
              disabled={isLoading}
            />
          </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="text-import-content">
              {importMode === 'multiple' ? 'Texto con varias recetas' : 'Texto de la receta'}
            </Label>
            <Textarea
              id="text-import-content"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={importMode === 'multiple'
                ? 'Pega aca el texto completo con varias recetas. El sistema intentara separarlas y detectar nombre, ingredientes y preparacion de cada una.'
                : 'Pega aca el texto completo de la receta. El sistema intentara detectar nombre, ingredientes y preparacion.'
              }
              className="min-h-[220px] resize-y"
              disabled={isLoading}
            />
          </div>

          <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">
            {importMode === 'multiple'
              ? 'Se guardaran solamente las recetas que tengan nombre, ingredientes y pasos de preparacion detectables.'
              : 'Se importara solamente si el texto contiene nombre, ingredientes y pasos de preparacion detectables.'
            }
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={handlePaste} disabled={isLoading}>
              <ClipboardPaste className="mr-2 h-4 w-4" />
              Pegar texto
            </Button>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              <X className="mr-2 h-4 w-4" />
              Cancelar
            </Button>
            <Button type="button" onClick={handleImport} disabled={isLoading || text.trim().length < 20}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              {importMode === 'multiple' ? 'Importar recetas' : 'Importar texto'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
