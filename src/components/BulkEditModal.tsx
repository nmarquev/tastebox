import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelectCombobox } from '@/components/MultiSelectCombobox';
import { useToast } from '@/hooks/use-toast';
import { api, RecipeCollection } from '@/services/api';
import { Recipe } from '@/types/recipe';
import { getRecipeSource } from '@/utils/siteUtils';
import { Loader2 } from 'lucide-react';

interface BulkEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipes: Recipe[]; // recetas seleccionadas
  onApplied: () => void; // recargar recetas tras aplicar
}

// Estado de cada característica booleana: no tocar / poner en sí / poner en no.
type Tri = 'keep' | 'yes' | 'no';

const FEATURE_FIELDS = [
  { field: 'featured', label: 'Favorita' },
  { field: 'cooked', label: 'Cocinada' },
  { field: 'thermomix', label: 'Thermomix' },
  { field: 'airFryer', label: 'Air Fryer' },
  { field: 'glutenFree', label: 'Sin Gluten' },
  { field: 'keto', label: 'Keto' },
  { field: 'lowCarb', label: 'Low Carb' },
  { field: 'vegetarian', label: 'Vegetariana' },
] as const;

const emptyFeatures = (): Record<string, Tri> =>
  Object.fromEntries(FEATURE_FIELDS.map(f => [f.field, 'keep'])) as Record<string, Tri>;

const selectTriggerCls = 'focus:!ring-0 focus:border-primary data-[state=open]:border-primary';

export const BulkEditModal = ({ isOpen, onClose, recipes, onApplied }: BulkEditModalProps) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Valores. Para texto/select/multi: vacío = "no cambiar".
  const [source, setSource] = useState('');
  const [importedFrom, setImportedFrom] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [language, setLanguage] = useState('');
  const [country, setCountry] = useState('');
  const [createdAt, setCreatedAt] = useState('');
  const [dishType, setDishType] = useState<string[]>([]);
  const [recipeType, setRecipeType] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [collectionIds, setCollectionIds] = useState<string[]>([]);
  const [features, setFeatures] = useState<Record<string, Tri>>(emptyFeatures());

  // Opciones de los desplegables.
  const [sourceOptions, setSourceOptions] = useState<string[]>([]);
  const [languageOptions, setLanguageOptions] = useState<string[]>([]);
  const [countryOptions, setCountryOptions] = useState<string[]>([]);
  const [dishTypeOptions, setDishTypeOptions] = useState<string[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [tagOptions, setTagOptions] = useState<string[]>([]);
  const [collections, setCollections] = useState<RecipeCollection[]>([]);

  // Reiniciar al abrir.
  useEffect(() => {
    if (!isOpen) return;
    setSource(''); setImportedFrom(''); setDifficulty(''); setLanguage(''); setCountry('');
    setCreatedAt(''); setDishType([]); setRecipeType([]); setTags([]); setCollectionIds([]);
    setFeatures(emptyFeatures());
  }, [isOpen]);

  // Cargar opciones (de todas las recetas + galerías) al abrir.
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
      api.tags.getAll().catch(() => [] as Array<{ name: string }>),
      api.collections.getAll().catch(() => [] as RecipeCollection[]),
    ]).then(([allRecipes, srcs, dts, cats, tgs, cols]) => {
      if (cancelled) return;
      const sources = new Set<string>();
      const languages = [...DEFAULT_LANGUAGES];
      const countries = [...DEFAULT_COUNTRIES];
      const dishTypes = new Set<string>();
      const categories = new Set<string>();
      const tagSet = new Set<string>();
      allRecipes.forEach(r => {
        const s = getRecipeSource(r); if (s) sources.add(s);
        if (r.language?.trim()) languages.push(r.language.trim());
        if (r.country?.trim()) countries.push(r.country.trim());
        if (r.dishType?.trim()) r.dishType.split(',').map(c => c.trim()).filter(Boolean).forEach(c => dishTypes.add(c));
        if (r.recipeType?.trim()) r.recipeType.split(',').map(c => c.trim()).filter(Boolean).forEach(c => categories.add(c));
        (r.tags || []).forEach((t: any) => { const n = (typeof t === 'string' ? t : (t?.tag?.name || t?.name || t?.tag || '')).toString().trim(); if (n) tagSet.add(n); });
      });
      srcs.forEach(s => { const n = (s.name || '').trim(); if (n) sources.add(n); });
      dts.forEach(s => { const n = (s.name || '').trim(); if (n) dishTypes.add(n); });
      cats.forEach(s => { const n = (s.name || '').trim(); if (n) categories.add(n); });
      tgs.forEach(s => { const n = (s.name || '').trim(); if (n) tagSet.add(n); });
      setSourceOptions(sortEs(Array.from(sources)));
      setLanguageOptions(sortEs(languages));
      setCountryOptions(sortEs(countries));
      setDishTypeOptions(sortEs(Array.from(dishTypes)));
      setCategoryOptions(sortEs(Array.from(categories)));
      setTagOptions(sortEs(Array.from(tagSet)));
      setCollections(cols);
    });
    return () => { cancelled = true; };
  }, [isOpen]);

  const setFeature = (field: string, value: Tri) => setFeatures(prev => ({ ...prev, [field]: value }));

  const buildUpdate = (): Partial<Recipe> => {
    const update: Record<string, any> = {};
    if (source.trim()) update.source = source.trim();
    if (importedFrom) update.importedFrom = importedFrom;
    if (difficulty) update.difficulty = difficulty;
    if (language.trim()) update.language = language.trim();
    if (country.trim()) update.country = country.trim();
    if (createdAt) update.createdAt = new Date(`${createdAt}T12:00:00`).toISOString();
    if (dishType.length) update.dishType = dishType.join(', ');
    if (recipeType.length) update.recipeType = recipeType.join(', ');
    if (tags.length) update.tags = tags;
    FEATURE_FIELDS.forEach(({ field }) => {
      const tri = features[field];
      if (tri === 'yes') update[field] = true;
      else if (tri === 'no') update[field] = false;
    });
    return update;
  };

  const handleApply = async () => {
    const update = buildUpdate();
    const hasFieldUpdate = Object.keys(update).length > 0;
    const hasCollection = collectionIds.length > 0;
    if (!hasFieldUpdate && !hasCollection) {
      toast({ title: 'No elegiste ningún campo', description: 'Modificá al menos un campo para aplicar.', variant: 'destructive' });
      return;
    }
    const ids = recipes.map(r => r.id);
    setSaving(true);
    try {
      // Campos escalares/tags: una sola llamada masiva (update parcial, no toca pasos/ingredientes).
      if (hasFieldUpdate) {
        await api.recipes.bulkUpdate(ids, update as Record<string, unknown>);
      }
      // Colecciones: agregar cada receta a las colecciones elegidas.
      if (hasCollection) {
        for (const id of ids) {
          for (const cid of collectionIds) {
            try { await api.collections.addRecipe(cid, id); } catch { /* no bloquear */ }
          }
        }
      }
      toast({
        title: 'Recetas actualizadas',
        description: `Se aplicaron los cambios a ${recipes.length} receta${recipes.length === 1 ? '' : 's'}.`,
      });
      onApplied();
      onClose();
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'No se pudieron actualizar las recetas', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent
        className="max-w-4xl max-h-[88vh] gap-2 overflow-y-auto"
        closeButtonClassName="right-4 top-4 h-8 w-8 rounded-md bg-primary text-primary-foreground opacity-100 inline-flex items-center justify-center shadow-sm hover:bg-primary/90 hover:opacity-100 data-[state=open]:bg-primary data-[state=open]:text-primary-foreground"
      >
        <DialogHeader>
          <DialogTitle>Editar campos comunes</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Editando <strong>{recipes.length}</strong> receta{recipes.length === 1 ? '' : 's'}. Completá solo los campos que quieras
          cambiar; los que dejes vacíos (o en “No cambiar”) no se modifican.
        </p>

        <div className="grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label>Fuente</Label>
            <MultiSelectCombobox
              options={sourceOptions}
              selected={source ? [source] : []}
              onChange={(next) => setSource(next[0] || '')}
              placeholder="Elegí una fuente"
              searchPlaceholder="Buscar o escribir fuente..."
              singleSelect closeOnSelect allowCreate createLabel="Agregar"
            />
          </div>
          <div>
            <Label>Origen</Label>
            <Select value={importedFrom || undefined} onValueChange={setImportedFrom}>
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
            <Select value={difficulty || undefined} onValueChange={setDifficulty}>
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
              selected={language ? [language] : []}
              onChange={(next) => setLanguage(next[0] || '')}
              placeholder="Elegí un idioma"
              searchPlaceholder="Buscar o escribir idioma..."
              singleSelect closeOnSelect allowCreate createLabel="Agregar"
            />
          </div>
          <div>
            <Label>País</Label>
            <MultiSelectCombobox
              options={countryOptions}
              selected={country ? [country] : []}
              onChange={(next) => setCountry(next[0] || '')}
              placeholder="Elegí un país"
              searchPlaceholder="Buscar o escribir país..."
              singleSelect closeOnSelect allowCreate createLabel="Agregar"
            />
          </div>
          <div>
            <Label htmlFor="bulk-date">Fecha</Label>
            <Input id="bulk-date" type="date" value={createdAt} onChange={(e) => setCreatedAt(e.target.value)} />
          </div>
          <div>
            <Label>Tipo de comida</Label>
            <MultiSelectCombobox
              options={dishTypeOptions}
              selected={dishType}
              onChange={setDishType}
              placeholder="Elegí uno o más tipos"
              searchPlaceholder="Buscar o escribir tipo..."
              closeOnSelect allowCreate createLabel="Agregar"
            />
          </div>
          <div>
            <Label>Categoría</Label>
            <MultiSelectCombobox
              options={categoryOptions}
              selected={recipeType}
              onChange={setRecipeType}
              placeholder="Elegí una o más categorías"
              searchPlaceholder="Buscar o escribir categoría..."
              closeOnSelect allowCreate createLabel="Agregar"
            />
          </div>
          <div>
            <Label>Colección</Label>
            <MultiSelectCombobox
              options={collections.map(c => c.name)}
              selected={collectionIds.map(id => collections.find(c => c.id === id)?.name).filter(Boolean) as string[]}
              onChange={(next) => {
                const ids = next.map(name => collections.find(c => c.name === name)?.id).filter(Boolean) as string[];
                setCollectionIds(ids);
              }}
              placeholder="Agregar a una o más colecciones"
              searchPlaceholder="Buscar colección..."
              closeOnSelect
            />
          </div>
          <div>
            <Label>Etiquetas <span className="text-xs font-normal text-muted-foreground">(se agregan a las existentes)</span></Label>
            <MultiSelectCombobox
              options={tagOptions}
              selected={tags}
              onChange={setTags}
              placeholder="Agregar una o más etiquetas"
              searchPlaceholder="Buscar o escribir etiqueta..."
              closeOnSelect allowCreate createLabel="Agregar"
            />
          </div>
        </div>

        {/* Características (No cambiar / Sí / No) */}
        <div className="space-y-2">
          <Label>Características</Label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURE_FIELDS.map(({ field, label }) => (
              <div key={field} className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-1">
                <span className="text-sm">{label}</span>
                <Select value={features[field]} onValueChange={(v) => setFeature(field, v as Tri)}>
                  <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="keep">No cambiar</SelectItem>
                    <SelectItem value="yes">Sí</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="button" onClick={handleApply} disabled={saving}>
            {saving ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Aplicando...</>) : `Aplicar a ${recipes.length} receta${recipes.length === 1 ? '' : 's'}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
