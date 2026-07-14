import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/services/api';
import { Recipe } from '@/types/recipe';
import { Loader2, Globe, Clock, Users, ChefHat, X, Check, ClipboardPaste, ChevronUp, ChevronDown, Edit } from 'lucide-react';
import { resolveImageUrl } from '@/utils/api';
import { ThermomixSetting } from '@/components/ThermomixSetting';
import { StepDescription, hasInlineThermomix } from '@/components/StepDescription';
import { EditRecipeModal } from '@/components/EditRecipeModal';
import { useDraggableDialog } from '@/hooks/useDraggableDialog';
import { SINGLE_IMPORT_ERROR_TOAST_DURATION_MS } from '@/constants/toastDurations';

interface ImportRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (recipe: Recipe) => void;
  onViewRecipe?: (recipe: Recipe) => void;
  onBulkImport?: () => void;
}

export const ImportRecipeModal = ({ isOpen, onClose, onImportSuccess, onViewRecipe, onBulkImport }: ImportRecipeModalProps) => {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [importedRecipe, setImportedRecipe] = useState<Recipe | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const isOpenRef = useRef(isOpen);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const { dragHandleProps, contentStyle: dragContentStyle } = useDraggableDialog(isOpen);
  const { toast } = useToast();

  // Flechas de la vista previa: ir al principio / al final del contenido scrolleable.
  const scrollToTop = () => contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  const scrollToBottom = () =>
    contentRef.current?.scrollTo({ top: contentRef.current.scrollHeight, behavior: 'smooth' });

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  const handleImport = async () => {
    if (!url.trim()) {
      toast({
        title: "URL requerida",
        description: "Por favor ingresa una URL válida",
        variant: "destructive",
        duration: SINGLE_IMPORT_ERROR_TOAST_DURATION_MS,
      });
      return;
    }

    // Evitar duplicados: si ya hay una receta con esta URL, avisar antes de bajarla.
    try {
      const dup = await api.recipes.checkUrl(url.trim());
      if (dup.exists) {
        const seguir = window.confirm(
          `Ya tenés una receta importada de esta URL${dup.recipe?.title ? `: "${dup.recipe.title}"` : ''}.\n\n¿Querés importarla igual?`
        );
        if (!seguir) return;
      }
    } catch {
      // Si el chequeo falla, seguimos con la importación normal.
    }

    setIsLoading(true);
    cancelledRef.current = false;
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await api.import.fromUrl(url, controller.signal);

      // Si el usuario canceló (aunque la respuesta ya haya llegado), no guardar.
      if (cancelledRef.current || controller.signal.aborted) {
        return;
      }

      if (response.success && response.recipe) {
        const recipe = response.recipe;
        const savedRecipe = await api.recipes.create({
          title: recipe.title,
          description: recipe.description,
          suggestions: recipe.suggestions,
          images: recipe.images,
          prepTime: recipe.prepTime,
          cookTime: recipe.cookTime,
          servings: recipe.servings,
          // Dificultad: no autocompletar con lo que adivina la IA.
          difficulty: undefined,
          tags: recipe.tags,
          ingredients: recipe.ingredients,
          instructions: recipe.instructions,
          sourceUrl: recipe.sourceUrl,
          author: recipe.author,
          importedFrom: recipe.importedFrom,
          // Categoría, país e idioma: no autocompletar con lo que adivina la IA.
          recipeType: undefined,
          country: undefined,
          language: undefined,
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
        });

        if (isOpenRef.current) {
          setImportedRecipe(savedRecipe);
        }
        onImportSuccess(savedRecipe);
        toast({
          title: "¡Receta importada y guardada!",
          description: `Se guardó: ${savedRecipe.title}`,
          action: onViewRecipe ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewRecipe(savedRecipe)}
            >
              Ver receta
            </Button>
          ) : undefined,
        });

        // Aviso de contenido parcial: paywall o datos sociales no disponibles.
        if (response.warning) {
          toast({
            title: "Información incompleta",
            description: response.warning,
            variant: "destructive",
            duration: SINGLE_IMPORT_ERROR_TOAST_DURATION_MS,
          });
        }
      }
    } catch (error) {
      // Cancelación del usuario: ya se notificó en handleCancelImport, no mostrar error.
      if (cancelledRef.current || controller.signal.aborted || (error as { name?: string })?.name === 'AbortError') {
        return;
      }
      console.error('Import error:', error);
      const message = error instanceof Error ? error.message : "No se pudo importar la receta";
      toast({
        title: message.includes('No están disponibles los ingredientes')
          ? "Ingredientes no disponibles"
          : "Error al importar",
        description: message,
        variant: "destructive",
        duration: SINGLE_IMPORT_ERROR_TOAST_DURATION_MS,
      });
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setIsLoading(false);
    }
  };

  const handleCancelImport = () => {
    // Marca la cancelación (incondicional), aborta la request y resetea el estado al instante.
    cancelledRef.current = true;
    abortRef.current?.abort();
    setIsLoading(false);
    toast({ title: "Importación cancelada" });
  };

  const triggerImport = () => {
    if (!isLoading) handleImport();
  };

  const handlePasteUrl = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      const pastedUrl = clipboardText.trim();

      if (!pastedUrl) {
        toast({
          title: "Portapapeles vacío",
          description: "No hay una URL para pegar",
          variant: "destructive",
          duration: SINGLE_IMPORT_ERROR_TOAST_DURATION_MS,
        });
        return;
      }

      setUrl(pastedUrl);
      urlInputRef.current?.focus();
    } catch {
      toast({
        title: "No se pudo pegar",
        description: "Permití el acceso al portapapeles o pegá la URL manualmente",
        variant: "destructive",
        duration: SINGLE_IMPORT_ERROR_TOAST_DURATION_MS,
      });
    }
  };

  const handleClose = () => {
    setUrl('');
    setImportedRecipe(null);
    setIsEditing(false);
    onClose();
  };

  const handleRemoveImage = (indexToRemove: number) => {
    if (!importedRecipe) return;

    setImportedRecipe({
      ...importedRecipe,
      images: importedRecipe.images.filter((_, index) => index !== indexToRemove)
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        ref={contentRef}
        style={dragContentStyle}
        className="max-w-4xl max-h-[90vh] overflow-y-auto"
        closeButtonClassName="h-8 w-8 rounded-md bg-primary text-primary-foreground opacity-100 inline-flex items-center justify-center shadow-sm hover:bg-primary/90 hover:opacity-100 data-[state=open]:bg-primary data-[state=open]:text-primary-foreground"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader {...dragHandleProps}>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Importar Receta desde URL
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* URL Input Section */}
          {!importedRecipe && (
            <div className="space-y-4">
              <form onSubmit={(event) => event.preventDefault()}>
                <Label htmlFor="recipe-url">URL de la receta</Label>
                <div className="flex gap-2 mt-1">
                  <div className="relative flex-1">
                    <Input
                      ref={urlInputRef}
                      id="recipe-url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); triggerImport(); } }}
                      placeholder="https://ejemplo.com/mi-receta"
                      className="w-full pr-9"
                    />
                    {url && (
                      <button
                        type="button"
                        onClick={() => { setUrl(''); urlInputRef.current?.focus(); }}
                        title="Borrar URL"
                        aria-label="Borrar URL"
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <Button
                    type="button"
                    onClick={handlePasteUrl}
                    disabled={isLoading}
                    title="Pegar URL"
                    aria-label="Pegar URL"
                    className="shrink-0"
                  >
                    <ClipboardPaste className="h-4 w-4 mr-2" />
                    Pegar
                  </Button>
                  {isLoading ? (
                    <Button
                      type="button"
                      onClick={handleCancelImport}
                      className="min-w-44"
                    >
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Cancelar importación
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={triggerImport}
                      className="min-w-32 flex items-center gap-2 bg-accent text-accent-foreground hover:bg-accent/80 border-0 transition-all duration-200 hover:scale-105 hover:shadow-md"
                    >
                      Importar
                    </Button>
                  )}
                </div>
              </form>

              <div className="text-sm text-muted-foreground">
                <p>Pega la URL de una receta:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>de una página web</li>
                  <li>de una publicación de Instagram</li>
                  <li>de una publicación de TikTok</li>
                  <li>de un video de YouTube</li>
                </ul>
                <p className="mt-4">Nuestro sistema la analizará automáticamente para extraer:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Nombre y descripción de la receta</li>
                  <li>Lista de ingredientes con cantidades</li>
                  <li>Instrucciones paso a paso</li>
                  <li>Tiempo de preparación y dificultad</li>
                  <li>Hasta 3 imágenes de la receta</li>
                </ul>
              </div>

              {onBulkImport && (
                <div className="border-t pt-4">
                  <Button
                    type="button"
                    className="w-full"
                    onClick={() => { setUrl(''); onBulkImport(); }}
                    disabled={isLoading}
                  >
                    <Globe className="h-4 w-4 mr-2" />
                    Importar varias recetas por URL
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Recipe Preview Section */}
          {importedRecipe && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Vista previa de la receta</h3>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setIsEditing(!isEditing)}
                  >
                    {!isEditing && <Edit className="h-4 w-4 mr-2" />}
                    {isEditing ? 'Ver' : 'Editar receta'}
                  </Button>
                  <Button
                    onClick={() => { setImportedRecipe(null); setUrl(''); }}
                  >
                    Importar otra receta
                  </Button>
                  <Button
                    onClick={handleClose}
                  >
                    Finalizar
                  </Button>
                </div>
              </div>

              {/* Recipe Images */}
              {(importedRecipe.images?.length ?? 0) > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Imágenes ({importedRecipe.images?.length ?? 0})</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {(importedRecipe.images || []).map((image, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={resolveImageUrl(image.url)}
                          alt={image.altText || `Imagen ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg"
                          crossOrigin="anonymous"
                          loading="lazy"
                          onError={(e) => {
                            // Fallback to original URL if local image fails
                            e.currentTarget.src = resolveImageUrl(image.url);
                          }}
                        />
                        {isEditing && (
                          <button
                            onClick={() => handleRemoveImage(index)}
                            className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                        <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                          {index + 1}
                        </div>
                      </div>
                    ))}
                  </div>

                </div>
              )}

              {/* Recipe Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="recipe-title">Título</Label>
                    {isEditing ? (
                      <Input
                        id="recipe-title"
                        value={importedRecipe.title}
                        onChange={(e) => setImportedRecipe({
                          ...importedRecipe,
                          title: e.target.value
                        })}
                      />
                    ) : (
                      <h2 className="text-xl font-semibold">{importedRecipe.title}</h2>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="recipe-description">Descripción</Label>
                    {isEditing ? (
                      <Textarea
                        id="recipe-description"
                        value={importedRecipe.description || ''}
                        onChange={(e) => setImportedRecipe({
                          ...importedRecipe,
                          description: e.target.value
                        })}
                        rows={3}
                      />
                    ) : (
                      <p className="text-muted-foreground">{importedRecipe.description}</p>
                    )}
                  </div>

                  {(isEditing || importedRecipe.suggestions) && (
                    <div>
                      <Label htmlFor="recipe-suggestions">Sugerencias</Label>
                      {isEditing ? (
                        <Textarea
                          id="recipe-suggestions"
                          value={importedRecipe.suggestions || ''}
                          onChange={(e) => setImportedRecipe({
                            ...importedRecipe,
                            suggestions: e.target.value
                          })}
                          rows={4}
                          placeholder="Tips, consejos o notas de la receta..."
                        />
                      ) : (
                        <p className="whitespace-pre-line text-muted-foreground">
                          {importedRecipe.suggestions}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>{importedRecipe.prepTime} min</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>{importedRecipe.servings} personas</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <ChefHat className="h-4 w-4" />
                      <span>{importedRecipe.difficulty}</span>
                    </div>
                  </div>

                  <div>
                    <Label>Etiquetas</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {importedRecipe.tags.map((tag, index) => (
                        <Badge key={index} variant="outline">{tag}</Badge>
                      ))}
                    </div>
                  </div>

                  {importedRecipe.recipeType && (
                    <div>
                      <Label>Tipo de receta</Label>
                      <p className="text-sm text-muted-foreground">{importedRecipe.recipeType}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Nutritional Information */}
              {importedRecipe.nutritionalInfo && (
                <div>
                  <h4 className="font-medium mb-2">Información Nutricional (por porción)</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="text-lg font-semibold">{importedRecipe.nutritionalInfo.calories}</div>
                      <div className="text-xs text-muted-foreground">Calorías</div>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="text-lg font-semibold">{importedRecipe.nutritionalInfo.protein}g</div>
                      <div className="text-xs text-muted-foreground">Proteínas</div>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="text-lg font-semibold">{importedRecipe.nutritionalInfo.carbohydrates}g</div>
                      <div className="text-xs text-muted-foreground">Carbohidratos</div>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="text-lg font-semibold">{importedRecipe.nutritionalInfo.fat}g</div>
                      <div className="text-xs text-muted-foreground">Grasas</div>
                    </div>
                    {importedRecipe.nutritionalInfo.fiber && (
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <div className="text-lg font-semibold">{importedRecipe.nutritionalInfo.fiber}g</div>
                        <div className="text-xs text-muted-foreground">Fibra</div>
                      </div>
                    )}
                    {importedRecipe.nutritionalInfo.sugar && (
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <div className="text-lg font-semibold">{importedRecipe.nutritionalInfo.sugar}g</div>
                        <div className="text-xs text-muted-foreground">Azúcar</div>
                      </div>
                    )}
                    {importedRecipe.nutritionalInfo.sodium && (
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <div className="text-lg font-semibold">{importedRecipe.nutritionalInfo.sodium}mg</div>
                        <div className="text-xs text-muted-foreground">Sodio</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Ingredients */}
              <div>
                <h4 className="font-medium mb-2">Ingredientes ({importedRecipe.ingredients.length})</h4>
                <div className="space-y-4">
                  {(() => {
                    // Group ingredients by section
                    const grouped = new Map<string | null, typeof importedRecipe.ingredients>();
                    importedRecipe.ingredients.forEach(ing => {
                      const section = (ing as any).section || null;
                      if (!grouped.has(section)) {
                        grouped.set(section, []);
                      }
                      grouped.get(section)!.push(ing);
                    });

                    return Array.from(grouped.entries()).map(([section, ingredients], sectionIndex) => (
                      <div key={sectionIndex}>
                        {section && (
                          <h5 className="font-medium text-primary text-sm mb-2">{section}</h5>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {ingredients.map((ingredient, index) => (
                            <div key={index} className="flex items-center gap-2 text-sm">
                              <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
                              <span className="font-medium">{ingredient.amount} {ingredient.unit}</span>
                              <span>{ingredient.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Instructions */}
              <div>
                <h4 className="font-medium mb-2">Instrucciones ({importedRecipe.instructions.length} pasos)</h4>
                <div className="space-y-4">
                  {(() => {
                    // Si las configuraciones ya están inline en el texto, no mostrar badges debajo.
                    const settingsInline = importedRecipe.instructions.some(i => hasInlineThermomix(i.description));
                    // Group instructions by section
                    const grouped = new Map<string | null, typeof importedRecipe.instructions>();

                    // Debug logging
                    console.log('📋 ImportRecipeModal - Instructions data:', {
                      total: importedRecipe.instructions.length,
                      firstInstruction: importedRecipe.instructions[0],
                      hasSection: importedRecipe.instructions.some(inst => (inst as any).section)
                    });

                    importedRecipe.instructions.forEach(inst => {
                      const section = (inst as any).section || null;
                      if (!grouped.has(section)) {
                        grouped.set(section, []);
                      }
                      grouped.get(section)!.push(inst);
                    });

                    console.log('📋 Grouped instructions:', {
                      sections: Array.from(grouped.keys()),
                      counts: Array.from(grouped.entries()).map(([s, insts]) => ({ section: s || '(none)', count: insts.length }))
                    });

                    return Array.from(grouped.entries()).map(([section, instructions], sectionIndex) => (
                      <div key={sectionIndex}>
                        {section && (
                          <h5 className="font-medium text-primary text-sm mb-2">{section}</h5>
                        )}
                        <div className="space-y-3">
                          {instructions.map((instruction) => {
                            const tm = instruction as any;
                            const settings: string[] = [];
                            if (tm.function) settings.push(`🔧 ${tm.function}`);
                            if (tm.time) settings.push(`⏱️ ${tm.time}`);
                            if (tm.temperature) settings.push(`🌡️ ${tm.temperature}`);
                            if (tm.speed) settings.push(`⚡ ${tm.speed}`);
                            return (
                              <div key={instruction.step} className="flex gap-3">
                                <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                                  {instruction.step}
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm text-muted-foreground">
                                    <StepDescription text={instruction.description} />
                                  </p>
                                  {settings.length > 0 && !settingsInline && (
                                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-primary">
                                      {settings.map((s, idx) => (
                                        <ThermomixSetting key={idx} text={s} />
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Flechitas para ir al principio / al final del contenido (arriba de la línea) */}
              <div className="pointer-events-none sticky bottom-3 z-30 flex flex-col items-end gap-1.5 pr-3">
                <button
                  type="button"
                  onClick={scrollToTop}
                  className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-md transition-all hover:bg-primary hover:scale-105"
                  title="Ir al principio"
                  aria-label="Ir al principio"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={scrollToBottom}
                  className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-md transition-all hover:bg-primary hover:scale-105"
                  title="Ir al final"
                  aria-label="Ir al final"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between pt-4 border-t">
                <Button onClick={handleClose}>
                  Cancelar
                </Button>
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      if (onViewRecipe) onViewRecipe(importedRecipe);
                      handleClose();
                    }}
                    disabled={isLoading}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    {onViewRecipe ? 'Ver receta' : 'Listo'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>

      {/* Edit Recipe Modal */}
      {importedRecipe && (
        <EditRecipeModal
          isOpen={isEditing}
          onClose={() => setIsEditing(false)}
          recipe={importedRecipe as any}
          onRecipeUpdated={(updatedRecipe) => {
            // No cerramos el editor al actualizar; queda abierto hasta "Finalizar".
            // Guard: si llegara algo nulo, NO lo asignamos (desmontaría el editor y lo cerraría).
            if (updatedRecipe) setImportedRecipe(updatedRecipe as any);
          }}
          onImportAnother={() => { setIsEditing(false); setImportedRecipe(null); setUrl(''); }}
        />
      )}
    </Dialog>
  );
};
