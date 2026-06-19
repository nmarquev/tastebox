import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { MultiSelectCombobox } from '@/components/MultiSelectCombobox';
import { AvocadoIcon } from '@/components/icons/AvocadoIcon';
import { RecipePreparedIcon } from '@/components/icons/RecipePreparedIcon';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/services/api';
import { Recipe } from '@/types/recipe';
import { getRecipeSource } from '@/utils/siteUtils';
import { Loader2, Check, X, Globe, Heart, WheatOff, Leaf } from 'lucide-react';

interface BulkUrlImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecipeSaved?: (recipeId: string) => void;
}

type ImportStatus = 'pending' | 'importing' | 'success' | 'error';

interface UrlResult {
  url: string;
  status: ImportStatus;
  title?: string;
  error?: string;
  warning?: string;
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

const EMPTY_COMMON: CommonFields = {
  source: '', importedFrom: '', difficulty: '', language: '', country: '', dishType: '', collectionId: '', recipeType: '',
  featured: false, cooked: false, thermomix: false, airFryer: false, glutenFree: false, keto: false, lowCarb: false, vegetarian: false,
};

export const BulkUrlImportModal = ({ isOpen, onClose, onRecipeSaved }: BulkUrlImportModalProps) => {
  const [step, setStep] = useState<1 | 2>(1);
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
          difficulty: (common.difficulty || recipe.difficulty) as any,
          tags: recipe.tags,
          ingredients: recipe.ingredients,
          instructions: recipe.instructions,
          sourceUrl: recipe.sourceUrl,
          source: common.source || (recipe as any).source || undefined,
          author: recipe.author,
          importedFrom: (common.importedFrom || recipe.importedFrom) as any,
          recipeType: common.recipeType || recipe.recipeType,
          dishType: common.dishType || (recipe as any).dishType || undefined,
          country: common.country || recipe.country,
          language: common.language || recipe.language || 'Español',
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
        return { url, status: 'success', title: savedRecipe.title, warning: response.warning };
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
    setStep(1);
    onClose();
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
        className="max-h-[90vh] max-w-2xl overflow-y-auto"
        closeButtonClassName="h-8 w-8 rounded-md bg-primary text-primary-foreground opacity-100 inline-flex items-center justify-center shadow-sm hover:bg-primary/90 hover:opacity-100 data-[state=open]:bg-primary data-[state=open]:text-primary-foreground"
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
              <Textarea
                id="bulk-urls"
                value={urlsText}
                onChange={(e) => setUrlsText(e.target.value)}
                placeholder={"https://sitio.com/receta-1\nhttps://sitio.com/receta-2\nhttps://instagram.com/p/..."}
                rows={6}
                className="mt-1 font-mono text-sm"
              />
              {urlCount > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {urlCount} URL{urlCount > 1 ? 's' : ''} detectada{urlCount > 1 ? 's' : ''}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button type="button" onClick={() => setStep(2)} disabled={urlCount === 0}>
                Siguiente paso
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-base font-semibold text-foreground">
              Paso 2: Ingresar los campos en común de las recetas a importar (opcionales):
            </p>

            {!isImporting && results.length === 0 && (
              <>
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
              </>
            )}

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

            {/* Botonera: Cancelar / Aceptar (volver a Paso 1) y, debajo, Importar recetas */}
            <div className="space-y-2">
              <div className="flex justify-end gap-2">
                {isImporting ? (
                  <Button type="button" variant="outline" onClick={() => { cancelRef.current = true; abortRef.current?.abort(); }}>
                    <X className="mr-2 h-4 w-4" />
                    Cancelar importación
                  </Button>
                ) : (
                  <>
                    <Button type="button" variant="outline" onClick={handleClose}>Cancelar</Button>
                    <Button type="button" variant="outline" onClick={() => setStep(1)}>Aceptar</Button>
                  </>
                )}
              </div>
              <Button type="button" className="w-full" onClick={handleImport} disabled={isImporting || urlCount === 0}>
                {isImporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  `Importar ${urlCount > 0 ? urlCount : ''} receta${urlCount === 1 ? '' : 's'}`.trim()
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
