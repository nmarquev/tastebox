import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { MultiSelectCombobox } from '@/components/MultiSelectCombobox';
import { AvocadoIcon } from '@/components/icons/AvocadoIcon';
import { RecipePreparedIcon } from '@/components/icons/RecipePreparedIcon';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/services/api';
import { Recipe } from '@/types/recipe';
import { getRecipeSource } from '@/utils/siteUtils';
import { Loader2, Check, X, Globe, Heart, WheatOff, Leaf, ClipboardPaste } from 'lucide-react';

interface BulkUrlImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecipeSaved?: (recipeId: string) => void;
  // Abre las recetas recién importadas en modo edición, una tras otra.
  onEditRecipes?: (recipeIds: string[]) => void;
}

type ImportStatus = 'pending' | 'importing' | 'success' | 'error';

interface UrlResult {
  url: string;
  status: ImportStatus;
  title?: string;
  error?: string;
  warning?: string;
  recipeId?: string;
}

// Campos en común que se aplican a todas las recetas importadas (todos opcionales).
interface CommonFields {
  source: string;
  importedFrom: string;
  difficulty: string;
  language: string;
  country: string;
  dishType: string;
  collectionId: string;
  recipeType: string;
  featured: boolean;
  cooked: boolean;
  thermomix: boolean;
  airFryer: boolean;
  glutenFree: boolean;
  keto: boolean;
  lowCarb: boolean;
  vegetarian: boolean;
}

// Máximo de recetas que se pueden importar en un lote.
const MAX_URLS = 20;

const EMPTY_COMMON: CommonFields = {
  source: '', importedFrom: '', difficulty: '', language: '', country: '', dishType: '', collectionId: '', recipeType: '',
  featured: false, cooked: false, thermomix: false, airFryer: false, glutenFree: false, keto: false, lowCarb: false, vegetarian: false,
};

export const BulkUrlImportModal = ({ isOpen, onClose, onRecipeSaved, onEditRecipes }: BulkUrlImportModalProps) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [confirmed, setConfirmed] = useState(false);
  // Paso 4: 'keep' conserva los campos en común; 'clear' los borra.
  const [keepCommonChoice, setKeepCommonChoice] = useState<'keep' | 'clear'>('keep');
  const [urlsText, setUrlsText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [results, setResults] = useState<UrlResult[]>([]);
  const [common, setCommon] = useState<CommonFields>(EMPTY_COMMON);
  const cancelRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  // Listas de opciones para los desplegables de campos en común.
  const [sourceOptions, setSourceOptions] = useState<string[]>([]);
  const [languageOptions, setLanguageOptions] = useState<string[]>([]);
  const [countryOptions, setCountryOptions] = useState<string[]>([]);
  const [dishTypeOptions, setDishTypeOptions] = useState<string[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [collections, setCollections] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const sortEs = (arr: string[]) => Array.from(new Set(arr)).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
    const DEFAULT_LANGUAGES = ['Español', 'Inglés', 'Portugués', 'Italiano', 'Francés', 'Alemán'];
    const DEFAULT_COUNTRIES = ['Argentina', 'España', 'México', 'Chile', 'Uruguay', 'Colombia', 'Perú', 'Estados Unidos', 'Italia', 'Francia'];
    Promise.all([
      api.recipes.getAll().catch(() => [] as Recipe[]),
      api.sources.getAll().catch(() => [] as Array<{ name: string }>),
      api.dishTypes.getAll().catch(() => [] as Array<{ name: string }>),
      api.categories.getAll().catch(() => [] as Array<{ name: string }>),
      api.collections.getAll().catch(() => [] as Array<{ id: string; name: string }>),
    ]).then(([recipes, srcs, dts, cats, cols]) => {
      if (cancelled) return;
      const sources = new Set<string>();
      const languages = [...DEFAULT_LANGUAGES];
      const countries = [...DEFAULT_COUNTRIES];
      const dishTypes = new Set<string>();
      const categories = new Set<string>();
      recipes.forEach(r => {
        const s = getRecipeSource(r); if (s) sources.add(s);
        if (r.language?.trim()) languages.push(r.language.trim());
        if (r.country?.trim()) countries.push(r.country.trim());
        if (r.dishType?.trim()) dishTypes.add(r.dishType.trim());
        if (r.recipeType?.trim()) r.recipeType.split(',').map(c => c.trim()).filter(Boolean).forEach(c => categories.add(c));
      });
      srcs.forEach(s => { const n = (s.name || '').trim(); if (n) sources.add(n); });
      dts.forEach(s => { const n = (s.name || '').trim(); if (n) dishTypes.add(n); });
      cats.forEach(s => { const n = (s.name || '').trim(); if (n) categories.add(n); });
      setSourceOptions(sortEs(Array.from(sources)));
      setLanguageOptions(sortEs(languages));
      setCountryOptions(sortEs(countries));
      setDishTypeOptions(sortEs(Array.from(dishTypes)));
      setCategoryOptions(sortEs(Array.from(categories)));
      setCollections(cols.map(c => ({ id: c.id, name: c.name })));
    });
    return () => { cancelled = true; };
  }, [isOpen]);

  // Si se modifica algún campo en común después de confirmar, se vuelve a pedir confirmación.
  useEffect(() => {
    setConfirmed(false);
  }, [common]);

  const parseUrls = (text: string): string[] => {
    const seen = new Set<string>();
    return text
      .split(/[\n\s]+/)
      .map(u => u.trim())
      .filter(u => /^https?:\/\//i.test(u))
      .filter(u => {
        if (seen.has(u)) return false;
        seen.add(u);
        return true;
      });
  };

  const importSingle = async (url: string, signal?: AbortSignal): Promise<UrlResult> => {
    try {
      const response = await api.import.fromUrl(url, signal);
      if (cancelRef.current) return { url, status: 'pending' };
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
          // Campos en común (si se eligieron) sobre los extraídos:
          // Dificultad: solo lo que el usuario indique en el Paso 2 (no autocompletar con la IA).
          difficulty: (common.difficulty || undefined) as any,
          tags: recipe.tags,
          ingredients: recipe.ingredients,
          instructions: recipe.instructions,
          sourceUrl: recipe.sourceUrl,
          source: common.source || (recipe as any).source || undefined,
          author: recipe.author,
          importedFrom: (common.importedFrom || recipe.importedFrom) as any,
          // Categoría, país e idioma: solo lo que el usuario indique en el Paso 2 (no autocompletar con la IA).
          recipeType: common.recipeType || undefined,
          dishType: common.dishType || undefined,
          country: common.country || undefined,
          language: common.language || undefined,
          featured: common.featured || undefined,
          cooked: common.cooked || undefined,
          thermomix: common.thermomix || recipe.thermomix,
          airFryer: common.airFryer || recipe.airFryer,
          glutenFree: common.glutenFree || recipe.glutenFree,
          keto: common.keto || recipe.keto,
          lowCarb: common.lowCarb || recipe.lowCarb,
          vegetarian: common.vegetarian || recipe.vegetarian,
          calories: recipe.calories,
          protein: recipe.protein,
          carbohydrates: recipe.carbohydrates,
          fat: recipe.fat,
          saturatedFat: recipe.saturatedFat,
          fiber: recipe.fiber,
          sugar: recipe.sugar,
          sodium: recipe.sodium
        } as any);
        // Asignar a la colección en común (si se eligió).
        if (common.collectionId) {
          try { await api.collections.addRecipe(common.collectionId, savedRecipe.id); } catch { /* no bloquear la importación */ }
        }
        onRecipeSaved?.(savedRecipe.id);
        return { url, status: 'success', title: savedRecipe.title, warning: response.warning, recipeId: savedRecipe.id };
      }
      return { url, status: 'error', error: 'No se pudo extraer la receta' };
    } catch (error) {
      if (cancelRef.current || (error as { name?: string })?.name === 'AbortError') {
        return { url, status: 'pending' };
      }
      return { url, status: 'error', error: error instanceof Error ? error.message : 'Error al importar' };
    }
  };

  const handleImport = async () => {
    const urls = parseUrls(urlsText);
    if (urls.length === 0) {
      toast({ title: 'Sin URLs válidas', description: 'Pegá al menos una URL (http:// o https://), una por línea.', variant: 'destructive' });
      return;
    }

    setIsImporting(true);
    cancelRef.current = false;
    const controller = new AbortController();
    abortRef.current = controller;
    setResults(urls.map(url => ({ url, status: 'pending' as ImportStatus })));

    let okCount = 0;
    const CONCURRENCY = 3;
    let nextIndex = 0;
    const worker = async () => {
      while (nextIndex < urls.length) {
        if (cancelRef.current) return;
        const i = nextIndex++;
        setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'importing' } : r));
        const result = await importSingle(urls[i], controller.signal);
        if (result.status === 'success') okCount++;
        setResults(prev => prev.map((r, idx) => idx === i ? result : r));
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length) }, () => worker()));

    abortRef.current = null;
    setIsImporting(false);
    if (cancelRef.current) {
      toast({ title: 'Importación cancelada', description: `Se importaron ${okCount} receta${okCount === 1 ? '' : 's'} antes de cancelar.` });
    } else {
      toast({
        title: 'Importación finalizada',
        description: `${okCount} de ${urls.length} receta${urls.length > 1 ? 's' : ''} importada${okCount === 1 ? '' : 's'} correctamente.`,
        variant: okCount > 0 ? undefined : 'destructive'
      });
    }
  };

  const handleClose = () => {
    if (isImporting) return;
    setUrlsText('');
    setResults([]);
    setCommon(EMPTY_COMMON);
    setConfirmed(false);
    setKeepCommonChoice('keep');
    setStep(1);
    onClose();
  };

  // Paso 2: confirma los campos en común y habilita avanzar al Paso 3.
  const handleConfirmData = () => {
    setConfirmed(true);
    toast({
      title: 'Datos confirmados',
      description: 'Se aplicarán a todas las recetas.',
      duration: 2000,
      className: 'w-auto p-3 pr-8 text-sm',
    });
  };

  // Paso 1: pega la última dirección copiada del portapapeles en el cuadro de URLs.
  const handlePasteUrl = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) {
        toast({ title: 'Portapapeles vacío', description: 'No hay ninguna dirección copiada.', variant: 'destructive' });
        return;
      }
      setUrlsText(prev => (prev.trim() ? `${prev.replace(/\s*$/, '')}\n${text}` : text));
    } catch {
      toast({ title: 'No se pudo pegar', description: 'El navegador no permitió acceder al portapapeles. Pegá manualmente con Ctrl+V.', variant: 'destructive' });
    }
  };

  // Paso 4: vuelve al Paso 1 para otro lote. keepCommon decide si se conservan los campos en común.
  const handleStartNewBatch = (keepCommon: boolean) => {
    setUrlsText('');
    setResults([]);
    setConfirmed(false);
    if (!keepCommon) setCommon(EMPTY_COMMON);
    setStep(1);
  };

  const urlCount = parseUrls(urlsText).length;

  // Botones de características (switches) iguales que en editar receta.
  const featureToggles = ([
    { field: 'featured', label: 'Favorita', icon: <Heart className="h-4 w-4" /> },
    { field: 'cooked', label: 'Cocinada', icon: <RecipePreparedIcon className="h-4 w-4" /> },
    { field: 'thermomix', label: 'Thermomix', icon: <img src="/thermomix-logo.transparent.png" alt="" aria-hidden="true" className="h-4 w-4 object-contain" /> },
    { field: 'airFryer', label: 'Air Fryer', icon: <img src="/air-fryer.transparent.png" alt="" aria-hidden="true" className="h-4 w-4 object-contain" /> },
    { field: 'glutenFree', label: 'Sin Gluten', icon: <WheatOff className="h-4 w-4" /> },
    { field: 'keto', label: 'Keto', icon: <AvocadoIcon className="h-4 w-4" /> },
    { field: 'lowCarb', label: 'Low Carb', icon: <img src="/logo-saludable.png" alt="" aria-hidden="true" className="h-4 w-4 object-contain" /> },
    { field: 'vegetarian', label: 'Vegetariana', icon: <Leaf className="h-4 w-4" /> },
  ] as const);

  const selectTriggerCls = "focus:!ring-0 focus:!ring-offset-2 focus:border-primary data-[state=open]:border-primary";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent
        className={`max-h-[90vh] overflow-y-auto ${step === 2 ? 'max-w-4xl' : 'max-w-2xl'}`}
        closeButtonClassName="h-8 w-8 rounded-md bg-primary text-primary-foreground opacity-100 inline-flex items-center justify-center shadow-sm hover:bg-primary/90 hover:opacity-100 data-[state=open]:bg-primary data-[state=open]:text-primary-foreground"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Importar varias recetas por URL
          </DialogTitle>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="bulk-urls" className="text-base font-semibold">Paso 1: Pegá las URLs, una por línea</Label>
              <p className="mt-1 text-xs text-muted-foreground">Máximo {MAX_URLS} recetas.</p>
              <Textarea
                id="bulk-urls"
                value={urlsText}
                onChange={(e) => setUrlsText(e.target.value)}
                placeholder={"https://sitio.com/receta-1\nhttps://sitio.com/receta-2\nhttps://instagram.com/p/..."}
                rows={6}
                className="mt-1 font-mono text-sm"
              />
              {urlCount > MAX_URLS && (
                <div className="mt-2 rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                  El máximo de links son {MAX_URLS}. Ingresaste {urlCount}, quitá {urlCount - MAX_URLS} para continuar.
                </div>
              )}
              <div className="mt-2 flex items-center justify-between gap-2">
                {urlCount > 0 && urlCount <= MAX_URLS ? (
                  <p className="text-xs text-muted-foreground">
                    {urlCount} URL{urlCount > 1 ? 's' : ''} detectada{urlCount > 1 ? 's' : ''}
                  </p>
                ) : <span />}
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" onClick={handlePasteUrl}>
                    <ClipboardPaste className="mr-2 h-4 w-4" />
                    Pegar
                  </Button>
                  <Button type="button" size="sm" onClick={() => setUrlsText('')} disabled={urlsText.trim() === ''}>
                    <X className="mr-2 h-4 w-4" />
                    Limpiar lista
                  </Button>
                </div>
              </div>

              {/* Vista previa de los links detectados, numerados */}
              {urlCount > 0 && (
                <ol className="mt-2 max-h-40 overflow-y-auto rounded-md border border-border/50 divide-y divide-border/40 text-sm">
                  {parseUrls(urlsText).map((u, i) => (
                    <li key={i} className="flex items-center gap-2 px-3 py-1.5">
                      <span className="w-6 shrink-0 text-right font-medium text-muted-foreground">{i + 1}.</span>
                      <span className="min-w-0 flex-1 truncate font-mono text-xs">{u}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button type="button" onClick={handleClose}>Cancelar</Button>
              <Button
                type="button"
                disabled={urlCount === 0}
                onClick={() => {
                  if (urlCount > MAX_URLS) {
                    toast({
                      title: `El máximo de links son ${MAX_URLS}`,
                      description: `Ingresaste ${urlCount}. Quitá ${urlCount - MAX_URLS} para continuar.`,
                      variant: 'destructive',
                    });
                    return;
                  }
                  setStep(2);
                }}
              >
                Siguiente
              </Button>
            </div>
          </div>
        ) : step === 2 ? (
          <div className="space-y-4">
            <p className="text-base font-semibold text-foreground">
              Paso 2: Ingresar los campos en común de las recetas a importar (opcionales):
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Fuente</Label>
                    <MultiSelectCombobox
                      options={sourceOptions}
                      selected={common.source ? [common.source] : []}
                      onChange={(next) => setCommon(c => ({ ...c, source: next[0] || '' }))}
                      placeholder="Elegí una fuente"
                      searchPlaceholder="Buscar o escribir fuente..."
                      singleSelect closeOnSelect allowCreate createLabel="Agregar"
                    />
                  </div>
                  <div>
                    <Label>Origen</Label>
                    <Select value={common.importedFrom || undefined} onValueChange={(v) => setCommon(c => ({ ...c, importedFrom: v }))}>
                      <SelectTrigger className={selectTriggerCls}><SelectValue placeholder="Elegí un origen" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="www">Página web</SelectItem>
                        <SelectItem value="instagram">Instagram</SelectItem>
                        <SelectItem value="youtube">YouTube</SelectItem>
                        <SelectItem value="doc">DOC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Dificultad</Label>
                    <Select value={common.difficulty || undefined} onValueChange={(v) => setCommon(c => ({ ...c, difficulty: v }))}>
                      <SelectTrigger className={selectTriggerCls}><SelectValue placeholder="Elegí una dificultad" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Fácil">Fácil</SelectItem>
                        <SelectItem value="Medio">Medio</SelectItem>
                        <SelectItem value="Difícil">Difícil</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Idioma</Label>
                    <MultiSelectCombobox
                      options={languageOptions}
                      selected={common.language ? [common.language] : []}
                      onChange={(next) => setCommon(c => ({ ...c, language: next[0] || '' }))}
                      placeholder="Elegí un idioma"
                      searchPlaceholder="Buscar o escribir idioma..."
                      singleSelect closeOnSelect allowCreate createLabel="Agregar"
                    />
                  </div>
                  <div>
                    <Label>País</Label>
                    <MultiSelectCombobox
                      options={countryOptions}
                      selected={common.country ? [common.country] : []}
                      onChange={(next) => setCommon(c => ({ ...c, country: next[0] || '' }))}
                      placeholder="Elegí un país"
                      searchPlaceholder="Buscar o escribir país..."
                      singleSelect closeOnSelect allowCreate createLabel="Agregar"
                    />
                  </div>
                  <div>
                    <Label>Tipo de receta</Label>
                    <MultiSelectCombobox
                      options={dishTypeOptions}
                      selected={common.dishType ? [common.dishType] : []}
                      onChange={(next) => setCommon(c => ({ ...c, dishType: next[0] || '' }))}
                      placeholder="Elegí un tipo de receta"
                      searchPlaceholder="Buscar o escribir tipo..."
                      singleSelect closeOnSelect allowCreate createLabel="Agregar"
                    />
                  </div>
                  <div>
                    <Label>Categoría</Label>
                    <MultiSelectCombobox
                      options={categoryOptions}
                      selected={common.recipeType ? [common.recipeType] : []}
                      onChange={(next) => setCommon(c => ({ ...c, recipeType: next[0] || '' }))}
                      placeholder="Elegí una categoría"
                      searchPlaceholder="Buscar o escribir categoría..."
                      singleSelect closeOnSelect allowCreate createLabel="Agregar"
                    />
                  </div>
                  <div>
                    <Label>Colección</Label>
                    <MultiSelectCombobox
                      options={collections.map(c => c.name)}
                      selected={(() => { const c = collections.find(c => c.id === common.collectionId); return c ? [c.name] : []; })()}
                      onChange={(next) => {
                        const found = collections.find(c => c.name === next[0]);
                        setCommon(c => ({ ...c, collectionId: found ? found.id : '' }));
                      }}
                      placeholder="Elegí una colección"
                      searchPlaceholder="Buscar colección..."
                      singleSelect closeOnSelect
                    />
                  </div>
                </div>

                {/* Características (switches) igual que en editar receta */}
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {featureToggles.map(({ field, label, icon }) => {
                    const active = Boolean(common[field]);
                    return (
                      <label key={field} className="flex cursor-pointer items-center justify-between rounded-md border bg-background px-3 py-2">
                        <span className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">{icon}</span>
                          {label}
                        </span>
                        <Switch className="scale-90 data-[state=checked]:!bg-[#9eddee]" checked={active} onCheckedChange={(v) => setCommon(c => ({ ...c, [field]: v }))} />
                      </label>
                    );
                  })}
                </div>

            {/* Botonera: (Confirmar datos / Limpiar datos / Cancelar) y debajo (Anterior / Siguiente) */}
            <div className="space-y-2">
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" size="sm" className="w-40" onClick={handleConfirmData}>
                  {confirmed ? <><Check className="mr-2 h-4 w-4" />Datos confirmados</> : 'Confirmar datos'}
                </Button>
                <Button type="button" size="sm" className="w-40" onClick={() => setCommon(EMPTY_COMMON)}>Limpiar datos</Button>
                <Button type="button" size="sm" className="w-28" onClick={handleClose}>Cancelar</Button>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" size="sm" className="w-28" onClick={() => setStep(1)}>Anterior</Button>
                <Button type="button" size="sm" className="w-28" onClick={() => setStep(3)}>Siguiente</Button>
              </div>
            </div>
          </div>
        ) : step === 3 ? (
          <div className="space-y-4">
            <p className="text-base font-semibold text-foreground">
              Paso 3: Importar recetas
            </p>

            {/* Resumen al finalizar la importación */}
            {!isImporting && results.length > 0 && (() => {
              const ok = results.filter(r => r.status === 'success').length;
              const failed = results.filter(r => r.status === 'error').length;
              return (
                <div className="rounded-md border border-green-600/40 bg-green-600/10 px-3 py-2 text-sm font-medium text-green-700">
                  {ok} receta{ok === 1 ? '' : 's'} importada{ok === 1 ? '' : 's'}{failed > 0 ? ` · ${failed} con error` : ''}.
                </div>
              );
            })()}

            {/* Resultados de la importación */}
            {results.length > 0 && (
              <div className="max-h-64 overflow-y-auto rounded-md border border-border/50 divide-y divide-border/40">
                {results.map((result, idx) => (
                  <div key={idx} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <span className="shrink-0">
                      {result.status === 'success' && <Check className="h-4 w-4 text-green-600" />}
                      {result.status === 'error' && <X className="h-4 w-4 text-destructive" />}
                      {result.status === 'importing' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                      {result.status === 'pending' && <span className="block h-4 w-4 rounded-full border border-muted-foreground/40" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{result.title || result.url}</p>
                      {result.status === 'error' && <p className="truncate text-xs text-destructive">{result.error}</p>}
                      {result.warning && <p className="text-xs text-amber-600">{result.warning}</p>}
                      {result.title && <p className="truncate text-xs text-muted-foreground">{result.url}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Botonera: Importar recetas y, debajo, Cancelar importación / Seguir importando / Anterior */}
            <div className="space-y-2">
              {isImporting ? (
                <Button type="button" className="w-full" onClick={() => { cancelRef.current = true; abortRef.current?.abort(); }}>
                  <X className="mr-2 h-4 w-4" />
                  Cancelar importación
                </Button>
              ) : (
                <Button type="button" className="w-full" onClick={handleImport} disabled={urlCount === 0 || results.length > 0}>
                  {results.length > 0
                    ? 'Recetas importadas'
                    : `Importar ${urlCount > 0 ? urlCount : ''} receta${urlCount === 1 ? '' : 's'}`.trim()}
                </Button>
              )}
              {isImporting && (
                <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importando...
                </p>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" size="sm" className="w-28" onClick={handleClose} disabled={isImporting}>Cancelar</Button>
                <Button type="button" size="sm" className="w-28" onClick={handleClose} disabled={isImporting}>Finalizar</Button>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" size="sm" className="w-28" onClick={() => setStep(2)} disabled={isImporting}>Anterior</Button>
                <Button type="button" size="sm" className="w-28" onClick={() => setStep(4)} disabled={isImporting}>Siguiente</Button>
              </div>
            </div>
          </div>
        ) : step === 4 ? (
          <div className="space-y-4">
            <p className="text-base font-semibold text-foreground">
              Paso 4: ¿Qué desea hacer ahora?
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Button type="button" onClick={() => setStep(5)}>Seguir importando</Button>
              <Button
                type="button"
                onClick={() => {
                  const ids = results.filter(r => r.status === 'success' && r.recipeId).map(r => r.recipeId as string);
                  if (ids.length === 0) return;
                  handleClose();
                  onEditRecipes?.(ids);
                }}
                disabled={!results.some(r => r.status === 'success' && r.recipeId)}
              >
                Editar recetas
              </Button>
              <Button type="button" onClick={handleClose}>Finalizar</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-base font-semibold text-foreground">
              Paso 5: Seguir importando
            </p>
            <p className="text-sm text-muted-foreground">
              ¿Qué hacemos con los campos en común ingresados para el próximo lote?
            </p>

            <RadioGroup
              value={keepCommonChoice}
              onValueChange={(v) => setKeepCommonChoice(v as 'keep' | 'clear')}
              className="gap-2"
            >
              <label htmlFor="keep-common-keep" className="flex cursor-pointer items-center gap-3 rounded-md border bg-background px-3 py-2 text-sm">
                <RadioGroupItem value="keep" id="keep-common-keep" />
                Mantener campos en común
              </label>
              <label htmlFor="keep-common-clear" className="flex cursor-pointer items-center gap-3 rounded-md border bg-background px-3 py-2 text-sm">
                <RadioGroupItem value="clear" id="keep-common-clear" />
                Borrar campos en común
              </label>
            </RadioGroup>

            <div className="space-y-2 pt-2">
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" size="sm" className="w-28" onClick={handleClose}>Cancelar</Button>
                <Button type="button" size="sm" className="w-28" onClick={handleClose}>Finalizar</Button>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" size="sm" className="w-28" onClick={() => setStep(4)}>Anterior</Button>
                <Button type="button" size="sm" className="w-28" onClick={() => handleStartNewBatch(keepCommonChoice === 'keep')}>Siguiente</Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
