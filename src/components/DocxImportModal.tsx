import { useState, useCallback, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { FileText, ArrowLeft, ArrowRight, CheckCircle } from "lucide-react";
import { DocxImportState, PageRange, DocxExtractedRecipe } from "@/types/docx";
import { api } from "@/services/api";
import { FileUploader } from "./docx/FileUploader";
import { PageSelector } from "./docx/PageSelector";
import { RecipeExtractor } from "./docx/RecipeExtractor";
import { RecipeReviewer } from "./docx/RecipeReviewer";
import { MultiSelectCombobox } from "./MultiSelectCombobox";
import { joinCategories, RECIPE_DISH_TYPES } from "@/constants/categories";
import { toast } from "sonner";
import { IMPORT_ERROR_TOAST_DURATION_MS } from "@/constants/toastDurations";

interface DocxImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecipeSaved?: (recipeId: string) => void;
}

// Unidades de medida reconocidas para separar cantidad/unidad del nombre.
const INGREDIENT_UNITS = new Set([
  'g', 'gr', 'grs', 'gramo', 'gramos', 'kg', 'kilo', 'kilos', 'mg',
  'ml', 'cc', 'l', 'lt', 'litro', 'litros',
  'taza', 'tazas', 'vaso', 'vasos', 'pocillo', 'pocillos',
  'cda', 'cdas', 'cucharada', 'cucharadas', 'cdta', 'cdta.', 'cdtas', 'cucharadita', 'cucharaditas',
  'pizca', 'pizcas', 'puñado', 'puñados', 'chorrito', 'chorro',
  'diente', 'dientes', 'unidad', 'unidades', 'u', 'rodaja', 'rodajas',
  'hoja', 'hojas', 'rama', 'ramas', 'lata', 'latas', 'sobre', 'sobres',
  'paquete', 'paquetes', 'pizca', 'puñado',
]);

// Convierte a número (el LLM a veces devuelve "30" como string). undefined si no es válido.
function toNum(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^\d.,-]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

// Separa "25 g de semillas de lino" → { amount: '25', unit: 'g', name: 'semillas de lino' }.
function parseIngredientLine(raw: string): { name: string; amount: string; unit: string } {
  const original = (raw || '').trim();
  if (!original) return { name: '', amount: '', unit: '' };

  let text = original;

  // 1) Cantidad inicial: número (decimal, fracción, rango o fracción unicode).
  const qtyMatch = text.match(
    /^((?:\d+(?:[.,]\d+)?|\d+\s*\/\s*\d+|[½¼¾⅓⅔⅛])(?:\s*[-aA]\s*(?:\d+(?:[.,]\d+)?|\d+\s*\/\s*\d+|[½¼¾⅓⅔⅛]))?)\s*/
  );
  let amount = '';
  if (qtyMatch) {
    amount = qtyMatch[1].replace(/\s+/g, ' ').trim();
    text = text.slice(qtyMatch[0].length).trim();
  }

  // 2) Unidad (solo si hubo cantidad y la primera palabra es una unidad conocida).
  let unit = '';
  if (amount) {
    const unitMatch = text.match(/^([a-zA-Záéíóúñ]+)\.?\b/);
    if (unitMatch && INGREDIENT_UNITS.has(unitMatch[1].toLowerCase())) {
      unit = unitMatch[1];
      text = text.slice(unitMatch[0].length).trim();
    }
  }

  // 3) Quitar "de"/"del"/"de la" inicial del nombre.
  text = text.replace(/^(?:de\s+la|de\s+los|de\s+las|del|de)\s+/i, '').trim();

  return {
    name: text || original,
    amount,
    unit,
  };
}

export const DocxImportModal = ({ isOpen, onClose, onRecipeSaved }: DocxImportModalProps) => {
  const [state, setState] = useState<DocxImportState>({
    currentStep: 'upload',
    currentRecipeIndex: 0,
    loading: false,
    savedRecipes: []
  });

  // Permite abortar la request en curso y descartar resultados que lleguen tarde.
  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);

  // Datos comunes que se aplican a TODAS las recetas importadas del documento.
  const [sharedFields, setSharedFields] = useState<{
    source: string;
    author: string;
    importedFrom: 'www' | 'instagram' | 'youtube' | 'doc';
    language: string;
    country: string;
  }>({ source: '', author: '', importedFrom: 'doc', language: '', country: '' });

  // Datos propios de cada receta (categoría y tipo), preguntados receta por receta.
  const [perRecipeFields, setPerRecipeFields] = useState<Record<string, { recipeTypes: string[]; dishType: string; title?: string }>>({});
  const setRecipeField = (id: string, patch: Partial<{ recipeTypes: string[]; dishType: string; title: string }>) =>
    setPerRecipeFields(prev => ({ ...prev, [id]: { recipeTypes: [], dishType: '', ...prev[id], ...patch } }));

  // Listas existentes para elegir categoría / tipo (o crear nuevas).
  const [existingCategories, setExistingCategories] = useState<string[]>([]);
  const [existingDishTypes, setExistingDishTypes] = useState<string[]>([]);
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const [cats, recipes] = await Promise.all([
          api.categories.getAll().catch(() => [] as Array<{ name: string }>),
          api.recipes.getAll().catch(() => []),
        ]);
        if (cancelled) return;
        setExistingCategories(Array.from(new Set(cats.map(c => c.name))).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' })));
        const dishTypes = Array.from(new Set(
          recipes.map(r => (r.dishType || '').trim()).filter(Boolean)
        )).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
        setExistingDishTypes(dishTypes);
      } catch {
        // Silencioso: si falla, igual se pueden tipear valores nuevos.
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen]);

  const resetState = useCallback(() => {
    setState({
      currentStep: 'upload',
      currentRecipeIndex: 0,
      loading: false,
      savedRecipes: []
    });
  }, []);

  const handleRestart = useCallback(() => {
    // Abortar cualquier procesamiento en curso y volver al primer paso (subir documento).
    cancelledRef.current = true;
    abortRef.current?.abort();
    resetState();
  }, [resetState]);

  const handleClose = useCallback(() => {
    // Cancelar cualquier procesamiento en curso antes de cerrar.
    cancelledRef.current = true;
    abortRef.current?.abort();
    resetState();
    onClose();
  }, [resetState, onClose]);

  // Step 1: File Upload
  const handleFileUpload = async (file: File) => {
    cancelledRef.current = false;
    setState(prev => ({ ...prev, loading: true, error: undefined, fileName: file.name }));

    try {
      console.log('📤 Uploading DOCX file:', file.name);
      const uploadResponse = await api.docx.upload(file);

      if (cancelledRef.current) return; // El usuario canceló durante la subida.

      if (uploadResponse.success) {
        setState(prev => ({
          ...prev,
          uploadData: uploadResponse,
          currentStep: 'select-pages',
          loading: false
        }));
      } else {
        throw new Error(uploadResponse.error || 'Upload failed');
      }
    } catch (error: any) {
      if (cancelledRef.current) return; // Cancelado por el usuario.
      console.error('❌ Upload error:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to upload file'
      }));
    }
  };

  // Step 2: Page Selection
  const handlePageSelection = (pageRange: PageRange) => {
    setState(prev => ({
      ...prev,
      selectedPages: pageRange,
      currentStep: 'extract',
      loading: true,
      error: undefined
    }));

    void handleExtractRecipes(pageRange);
  };

  // Step 3: Extract Recipes — procesa todo el rango de páginas indicado.
  async function handleExtractRecipes(range = state.selectedPages) {
    if (!state.uploadData || !range) return;

    cancelledRef.current = false;
    const controller = new AbortController();
    abortRef.current = controller;

    setState(prev => ({ ...prev, currentStep: 'extract', loading: true, error: undefined }));

    try {
      console.log(`🔍 Extracting recipes from pages ${range.start}-${range.end}`);
      const extractResponse = await api.docx.extract(
        state.uploadData.fileId,
        range.start,
        range.end,
        controller.signal
      );

      if (cancelledRef.current) return; // El usuario cerró/canceló.

      if (extractResponse.success && extractResponse.recipes.length > 0) {
        setState(prev => ({
          ...prev,
          extractedRecipes: extractResponse.recipes,
          currentRecipeIndex: 0,
          currentStep: 'review',
          loading: false
        }));
      } else {
        throw new Error(extractResponse.error || 'No se encontraron recetas en las páginas seleccionadas.');
      }
    } catch (error: any) {
      if (cancelledRef.current || error?.name === 'AbortError') return;

      console.error('❌ Extract error:', error);
      const errorMessage = error?.name === 'TimeoutError'
        ? 'La extracción tardó demasiado. Intenta nuevamente o selecciona menos páginas.'
        : error.message || 'No se pudieron extraer las recetas';

      setState(prev => ({ ...prev, loading: false, error: errorMessage }));
    }
  }

  // Step 4: Recipe Review and Save
  const handleRecipeSave = async (recipe: DocxExtractedRecipe, silent = false): Promise<boolean> => {
    if (!recipe.estimatedData) return false;

    try {
      // Si el LLM no encontró descripción, no inventamos ninguna (a veces devuelve
      // placeholders como "No description provided" / "Sin descripción").
      const rawDescription = (recipe.estimatedData.description || '').trim();
      const isPlaceholderDescription = /^(no description( provided)?\.?|n\/?a|sin descripci[oó]n.*|none)$/i.test(rawDescription);
      const cleanDescription = isPlaceholderDescription ? '' : rawDescription;

      const recipeData = {
        title: (perRecipeFields[recipe.id]?.title ?? (recipe.estimatedData.title || recipe.title)).trim() || recipe.title,
        description: cleanDescription,
        sourceUrl: sharedFields.source.trim() || undefined,
        author: sharedFields.author.trim() || undefined,
        language: sharedFields.language.trim() || undefined,
        country: sharedFields.country.trim() || undefined,
        ingredients: (recipe.estimatedData.ingredients || []).map((ing, index) => {
          const parsed = parseIngredientLine(ing);
          return {
            name: parsed.name,
            amount: parsed.amount, // vacío si no hay cantidad (ya no forzamos "al gusto")
            unit: parsed.unit,
            order: index + 1
          };
        }),
        instructions: recipe.estimatedData.instructions?.map((inst, index) => ({
          step: index + 1,
          description: inst,
          time: "",
          temperature: "",
          speed: ""
        })) || [],
        prepTime: toNum(recipe.estimatedData.prepTime) ?? 30,
        cookTime: toNum(recipe.estimatedData.cookTime),
        servings: toNum(recipe.estimatedData.servings) ?? 4,
        difficulty: undefined,
        recipeType: joinCategories(perRecipeFields[recipe.id]?.recipeTypes || []) || undefined,
        dishType: (perRecipeFields[recipe.id]?.dishType || '').trim() || undefined,
        importedFrom: sharedFields.importedFrom,
        tags: [],
        autoTags: false, // no autogenerar etiquetas en la importación DOCX
        images: (() => {
          // Solo la imagen que aparece junto a esta receta en el documento.
          const idx = recipe.imageIndex;
          const url = typeof idx === 'number' && idx >= 0 ? state.uploadData?.images?.[idx] : undefined;
          return url
            ? [{ url, localPath: undefined, order: 1, altText: `Imagen de ${recipe.estimatedData?.title || recipe.title}` }]
            : [];
        })()
      };

      const savedRecipe = await api.recipes.create(recipeData);

      setState(prev => ({
        ...prev,
        savedRecipes: [...prev.savedRecipes, recipe.id]
      }));

      if (onRecipeSaved) {
        onRecipeSaved(savedRecipe.id);
      }

      console.log('✅ Recipe saved successfully:', savedRecipe.id);
      if (!silent) {
        toast.success('Receta guardada', {
          description: recipe.estimatedData?.title || recipe.title,
        });
      }
      return true;
    } catch (error: any) {
      console.error('❌ Save error:', error);
      const message = error.message || 'No se pudo guardar la receta';
      if (!silent) {
        setState(prev => ({ ...prev, error: message }));
        toast.error('No se pudo guardar la receta', {
          description: message,
          duration: IMPORT_ERROR_TOAST_DURATION_MS,
        });
      }
      return false;
    }
  };

  // Guardar todas las recetas del lote actual.
  const handleSaveAll = async () => {
    const recipes = (state.extractedRecipes || []).filter(r => !state.savedRecipes.includes(r.id));
    if (recipes.length === 0) {
      toast.info('Ya guardaste todas las recetas de este lote.');
      return;
    }
    let ok = 0;
    let fail = 0;
    for (const recipe of recipes) {
      const saved = await handleRecipeSave(recipe, true);
      if (saved) ok++; else fail++;
    }
    toast.success(`Guardadas ${ok} receta${ok !== 1 ? 's' : ''}${fail ? `, ${fail} con error` : ''}`);
  };

  const handleNextRecipe = () => {
    if (state.extractedRecipes && state.currentRecipeIndex < state.extractedRecipes.length - 1) {
      setState(prev => ({
        ...prev,
        currentRecipeIndex: prev.currentRecipeIndex + 1
      }));
    }
  };

  const handlePreviousRecipe = () => {
    if (state.currentRecipeIndex > 0) {
      setState(prev => ({
        ...prev,
        currentRecipeIndex: prev.currentRecipeIndex - 1
      }));
    }
  };

  const handleSkipRecipe = () => {
    handleNextRecipe();
  };

  const handleFinish = () => {
    // Show summary or close
    handleClose();
  };

  // Calculate progress
  const getProgress = () => {
    switch (state.currentStep) {
      case 'upload': return 25;
      case 'select-pages': return 50;
      case 'extract': return 75;
      case 'review': return 100;
      default: return 0;
    }
  };

  const currentRecipe = state.extractedRecipes?.[state.currentRecipeIndex];
  const totalRecipes = state.extractedRecipes?.length || 0;
  const dishTypeOptions = Array.from(new Set([
    ...RECIPE_DISH_TYPES,
    ...existingDishTypes,
  ])).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  const isLastRecipe = state.currentRecipeIndex === totalRecipes - 1;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-4xl max-h-[90vh] overflow-y-auto"
        closeButtonClassName="h-8 w-8 rounded-md bg-primary text-primary-foreground opacity-100 inline-flex items-center justify-center shadow-sm hover:bg-primary/90 hover:opacity-100 data-[state=open]:bg-primary data-[state=open]:text-primary-foreground"
      >
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-10">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <DialogTitle>
                Importar Recetas desde DOCX
                {state.fileName && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    — {state.fileName}
                  </span>
                )}
                {state.currentStep === 'review' && totalRecipes > 0 && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({state.currentRecipeIndex + 1} de {totalRecipes})
                  </span>
                )}
              </DialogTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClose}
              className="shrink-0"
            >
              {state.currentStep === 'review' && state.savedRecipes.length > 0 ? 'Finalizar' : 'Cancelar'}
            </Button>
          </div>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Progreso</span>
            <span>{getProgress()}%</span>
          </div>
          <Progress value={getProgress()} className="h-2" />
        </div>

        {/* Error Display */}
        {state.error && (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        {/* Botón Completar (en la última receta, con recetas guardadas) */}
        {state.currentStep === 'review' && isLastRecipe && state.savedRecipes.length > 0 && (
          <div className="flex justify-end items-center pb-3 mb-2 border-b">
            <Button onClick={handleFinish}>
              <CheckCircle className="h-4 w-4 mr-1" />
              Completar ({state.savedRecipes.length} guardadas)
            </Button>
          </div>
        )}

        {/* Step Content */}
        <div className="min-h-[400px]">
          {state.currentStep === 'upload' && (
            <FileUploader
              onFileSelect={handleFileUpload}
              loading={state.loading}
            />
          )}

          {state.currentStep === 'select-pages' && state.uploadData && (
            <PageSelector
              uploadData={state.uploadData}
              onPageSelect={handlePageSelection}
              loading={state.loading}
            />
          )}

          {state.currentStep === 'extract' && (
            <RecipeExtractor
              uploadData={state.uploadData!}
              selectedPages={state.selectedPages!}
              onRestart={handleRestart}
              loading={state.loading}
            />
          )}

          {state.currentStep === 'review' && currentRecipe && (
            <>
              {/* Datos comunes para todas las recetas del documento */}
              <div className="mb-4 rounded-lg border border-border/60 bg-muted/30 p-4">
                <h3 className="mb-1 text-sm font-semibold text-foreground">Datos para todas las recetas (opcional)</h3>
                <p className="mb-3 text-xs text-muted-foreground">
                  Se aplican a cada receta que guardes de este documento.
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <Label htmlFor="shared-source" className="text-xs">Fuente</Label>
                    <Input
                      id="shared-source"
                      value={sharedFields.source}
                      onChange={(e) => setSharedFields(prev => ({ ...prev, source: e.target.value }))}
                      placeholder="Libro, web, autor..."
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label htmlFor="shared-author" className="text-xs">Autor</Label>
                    <Input
                      id="shared-author"
                      value={sharedFields.author}
                      onChange={(e) => setSharedFields(prev => ({ ...prev, author: e.target.value }))}
                      placeholder="Nombre del autor"
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Origen</Label>
                    <Select
                      value={sharedFields.importedFrom}
                      onValueChange={(value) => setSharedFields(prev => ({ ...prev, importedFrom: value as typeof prev.importedFrom }))}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="doc">Documento</SelectItem>
                        <SelectItem value="www">Página web</SelectItem>
                        <SelectItem value="instagram">Instagram</SelectItem>
                        <SelectItem value="youtube">YouTube</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="shared-language" className="text-xs">Idioma</Label>
                    <Input
                      id="shared-language"
                      value={sharedFields.language}
                      onChange={(e) => setSharedFields(prev => ({ ...prev, language: e.target.value }))}
                      placeholder="Español"
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label htmlFor="shared-country" className="text-xs">País</Label>
                    <Input
                      id="shared-country"
                      value={sharedFields.country}
                      onChange={(e) => setSharedFields(prev => ({ ...prev, country: e.target.value }))}
                      placeholder="Argentina"
                      className="h-9"
                    />
                  </div>
                </div>
              </div>

              {/* Datos propios de esta receta */}
              <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
                <h3 className="mb-3 text-sm font-semibold text-foreground">
                  Datos de esta receta ({state.currentRecipeIndex + 1} de {totalRecipes})
                </h3>
                <div className="mb-3">
                  <Label htmlFor="recipe-title" className="text-xs">Título</Label>
                  <Input
                    id="recipe-title"
                    value={perRecipeFields[currentRecipe.id]?.title ?? (currentRecipe.estimatedData?.title || currentRecipe.title)}
                    onChange={(e) => setRecipeField(currentRecipe.id, { title: e.target.value })}
                    placeholder="Título de la receta"
                    className="h-9"
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs">Categoría</Label>
                    <MultiSelectCombobox
                      options={existingCategories}
                      selected={perRecipeFields[currentRecipe.id]?.recipeTypes || []}
                      onChange={(next) => setRecipeField(currentRecipe.id, { recipeTypes: next })}
                      placeholder="Elegí o creá categorías"
                      searchPlaceholder="Buscar o crear categoría..."
                      allowCreate
                      createLabel="Crear categoría"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Tipo de comida</Label>
                    <Select
                      value={perRecipeFields[currentRecipe.id]?.dishType || ''}
                      onValueChange={(value) => setRecipeField(currentRecipe.id, { dishType: value })}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Elegir tipo de comida" />
                      </SelectTrigger>
                      <SelectContent>
                        {dishTypeOptions.map((dt) => (
                          <SelectItem key={dt} value={dt}>{dt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <RecipeReviewer
                recipe={currentRecipe}
                recipeIndex={state.currentRecipeIndex}
                totalRecipes={totalRecipes}
                isSaved={state.savedRecipes.includes(currentRecipe.id)}
                onSave={() => handleRecipeSave(currentRecipe)}
                onSaveAll={handleSaveAll}
                onSkip={handleSkipRecipe}
                loading={state.loading}
                onPrevious={handlePreviousRecipe}
                onNext={handleNextRecipe}
              />
            </>
          )}
        </div>

      </DialogContent>
    </Dialog>
  );
};
