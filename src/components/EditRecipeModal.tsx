import { useState, useEffect, useMemo, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useNutritionCalculator } from '@/hooks/useNutritionCalculator';
import { api, RecipeCollection } from '@/services/api';
import { Recipe } from '@/types/recipe';
import { Beef, CakeSlice, CandyOff, Loader2, Plus, X, Upload, Edit, Calculator, Globe, Check, ClipboardList, ClipboardPaste, Heart, WheatOff, Leaf, Utensils, ChevronUp, ChevronDown, AudioLines, Trash2 } from 'lucide-react';
import { resolveImageUrl } from '@/utils/api';
import { getRecipeSource } from '@/utils/siteUtils';
import { MultiSelectCombobox } from '@/components/MultiSelectCombobox';
import { CreatableCombobox } from '@/components/CreatableCombobox';
import { Switch } from '@/components/ui/switch';
import { AvocadoIcon } from '@/components/icons/AvocadoIcon';
import { RecipePreparedIcon } from '@/components/icons/RecipePreparedIcon';
import { useDraggableDialog } from '@/hooks/useDraggableDialog';

interface EditRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipe: Recipe | null;
  onRecipeUpdated: (recipe: Recipe) => void;
  onCollectionsUpdated?: (collections: RecipeCollection[]) => void;
  mode?: 'edit' | 'create';
  // Edición secuencial de varias recetas (p. ej. tras importar varias por URL).
  // position es 0-based; onNext avanza a la siguiente o cierra si es la última.
  queue?: { position: number; total: number; onNext: () => void };
  // Solo en el flujo de importación: vuelve a la pantalla para importar otra receta.
  onImportAnother?: () => void;
}

interface RecipeFormData {
  title: string;
  description: string;
  suggestions: string;
  importedFrom?: string;
  sourceUrl: string;
  source: string;
  author: string;
  createdAt: string;
  prepTime: number;
  cookTime?: number;
  servings: number;
  difficulty: "Fácil" | "Medio" | "Difícil";
  recipeType: string;
  dishType: string;
  country: string;
  language: string;
  glutenFree: boolean;
  sugarFree: boolean;
  keto: boolean;
  lowCarb: boolean;
  vegetarian: boolean;
  proteica: boolean;
  sweet: boolean;
  savory: boolean;
  thermomix: boolean;
  airFryer: boolean;
  featured: boolean;
  cooked: boolean;
  locution: string;
  tags: string[];
  calories?: number;
  protein?: number;
  carbohydrates?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  ingredients: Array<{
    name: string;
    amount: string;
    unit: string;
    section?: string;
    pasted?: boolean;
  }>;
  instructions: Array<{
    description: string;
    function?: string;
    time?: string;
    temperature?: string;
    speed?: string;
    section?: string;
  }>;
}

const importSourceOptions = [
  { value: 'www', label: 'Pagina web' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'doc', label: 'DOC' },
];

const getImportSourceLabel = (value?: string) =>
  importSourceOptions.find(option => option.value === value)?.label || value || '';

const getImportSourceValue = (label: string) =>
  importSourceOptions.find(option => option.label.toLocaleLowerCase('es') === label.toLocaleLowerCase('es'))?.value || label;

const toDateInputValue = (value?: string | Date | null) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
};

const normalizeSnapshotValue = (value: unknown): unknown => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? value : '';
  if (Array.isArray(value)) return value.map(normalizeSnapshotValue);
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, normalizeSnapshotValue(item)])
    );
  }
  return value;
};

const getFormSnapshot = (value: unknown) => JSON.stringify(normalizeSnapshotValue(value));

const normalizeDifficulty = (value?: string | null) => {
  if (!value) return undefined;
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .trim();
  if (normalized === 'facil') return 'Fácil';
  if (normalized === 'medio') return 'Medio';
  if (normalized === 'dificil') return 'Difícil';
  return undefined;
};

export const EditRecipeModal = ({
  isOpen,
  onClose,
  recipe,
  onRecipeUpdated,
  onCollectionsUpdated,
  mode = 'edit',
  queue,
  onImportAnother,
}: EditRecipeModalProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [showScrollControls, setShowScrollControls] = useState(false);
  const [activeTab, setActiveTab] = useState('info');
  const [newTag, setNewTag] = useState('');
  const [existingImages, setExistingImages] = useState(recipe?.images || []);
  const [uploadedImages, setUploadedImages] = useState<Array<{ file: File; preview: string }>>([]);
  // Cantidad de imágenes de referencia (baseline) para detectar cambios; se actualiza al cargar y al guardar.
  const [initialImageCount, setInitialImageCount] = useState(recipe?.images?.length ?? 0);
  const [collections, setCollections] = useState<RecipeCollection[]>([]);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);
  // Colecciones de referencia (baseline) para detectar si el usuario cambió la colección.
  const [initialCollectionIds, setInitialCollectionIds] = useState<string[]>([]);
  const [isLoadingCollections, setIsLoadingCollections] = useState(false);
  const [sourceOptions, setSourceOptions] = useState<string[]>([]);
  const [originOptions, setOriginOptions] = useState<string[]>(importSourceOptions.map(option => option.label));
  const [languageOptions, setLanguageOptions] = useState<string[]>([]);
  const [countryOptions, setCountryOptions] = useState<string[]>([]);
  const [dishTypeOptions, setDishTypeOptions] = useState<string[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [tagOptions, setTagOptions] = useState<string[]>([]);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [bulkEditingIngredients, setBulkEditingIngredients] = useState(false);
  const [selectedIngredientIndexes, setSelectedIngredientIndexes] = useState<Set<number>>(new Set());
  const [bulkIngredientSection, setBulkIngredientSection] = useState('__none__');
  const [bulkEditingInstructions, setBulkEditingInstructions] = useState(false);
  const [selectedInstructionIndexes, setSelectedInstructionIndexes] = useState<Set<number>>(new Set());
  const [bulkInstructionSection, setBulkInstructionSection] = useState('__none__');
  const { toast } = useToast();
  const { calculateNutrition, isCalculating } = useNutritionCalculator();

  const { dragHandleProps, contentStyle: dragContentStyle } = useDraggableDialog(isOpen);

  const { register, handleSubmit, control, formState: { errors }, reset, setValue, watch, getValues } = useForm<RecipeFormData>();

  // Foto de los valores del formulario al cargar la receta (y tras guardar). Se compara
  // contra los valores actuales para saber si el usuario realmente modificó algún campo.
  // (Más confiable que isDirty, que puede dar falsos positivos al inicializar.)
  const initialFormSnapshot = useRef<string | null>(null);
  const formScrollRef = useRef<HTMLDivElement>(null);
  const lastSelectedIngredientIndex = useRef<number | null>(null);
  const lastSelectedInstructionIndex = useRef<number | null>(null);

  const scrollFormToTop = () => formScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  const scrollFormToBottom = () => formScrollRef.current?.scrollTo({
    top: formScrollRef.current.scrollHeight,
    behavior: 'smooth',
  });

  // ¿Se modificó algo? Campos del formulario, imágenes (agregadas/quitadas) o la colección.
  const collectionsChanged =
    [...selectedCollectionIds].sort().join(',') !== [...initialCollectionIds].sort().join(',');
  const formChanged =
    initialFormSnapshot.current !== null
    && getFormSnapshot(watch()) !== initialFormSnapshot.current;
  const hasChanges =
    formChanged
    || uploadedImages.length > 0
    || existingImages.length !== initialImageCount
    || collectionsChanged;

  const { fields: ingredientFields, append: appendIngredient, remove: removeIngredient, replace: replaceIngredients } = useFieldArray({
    control,
    name: 'ingredients'
  });

  const handleAppendIngredient = () => {
    const ingredients = getValues('ingredients') || [];
    const lastIngredient = ingredients[ingredients.length - 1];
    const inheritedSection = mode === 'create' ? (lastIngredient?.section || '').trim() : '';

    appendIngredient({ name: '', amount: '', unit: '', section: inheritedSection });
  };

  const handleClearIngredients = () => {
    replaceIngredients([{ name: '', amount: '', unit: '', section: '' }]);
    setShowNewIngredientSection({});
    setSelectedIngredientIndexes(new Set());
    setBulkEditingIngredients(false);
    lastSelectedIngredientIndex.current = null;
  };

  const handleRemovePastedIngredient = (index: number) => {
    if (ingredientFields.length === 1) {
      handleClearIngredients();
      return;
    }
    removeIngredient(index);
  };

  const handleIngredientSelection = (index: number, event: ReactMouseEvent<HTMLInputElement>) => {
    setSelectedIngredientIndexes(prev => {
      if (event.shiftKey && lastSelectedIngredientIndex.current !== null) {
        const next = new Set(prev);
        const start = Math.min(lastSelectedIngredientIndex.current, index);
        const end = Math.max(lastSelectedIngredientIndex.current, index);
        for (let itemIndex = start; itemIndex <= end; itemIndex += 1) next.add(itemIndex);
        return next;
      }

      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      lastSelectedIngredientIndex.current = index;
      return next;
    });
  };

  const { fields: instructionFields, append: appendInstruction, remove: removeInstruction, replace: replaceInstructions } = useFieldArray({
    control,
    name: 'instructions'
  });

  const handleAppendInstruction = () => {
    appendInstruction({ description: '', function: '', time: '', temperature: '', speed: '', section: '' });
  };

  const handleClearInstructions = () => {
    replaceInstructions([{ description: '', function: '', time: '', temperature: '', speed: '', section: '' }]);
    setShowNewInstructionSection({});
    setSelectedInstructionIndexes(new Set());
    setBulkEditingInstructions(false);
    setBulkInstructionSection('__none__');
    lastSelectedInstructionIndex.current = null;
  };

  const handleInstructionSelection = (index: number, event: ReactMouseEvent<HTMLInputElement>) => {
    setSelectedInstructionIndexes(prev => {
      if (event.shiftKey && lastSelectedInstructionIndex.current !== null) {
        const next = new Set(prev);
        const start = Math.min(lastSelectedInstructionIndex.current, index);
        const end = Math.max(lastSelectedInstructionIndex.current, index);
        for (let itemIndex = start; itemIndex <= end; itemIndex += 1) next.add(itemIndex);
        return next;
      }

      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      lastSelectedInstructionIndex.current = index;
      return next;
    });
  };

  useEffect(() => {
    if (!isOpen) {
      setShowScrollControls(false);
      return;
    }

    const scrollElement = formScrollRef.current;
    if (!scrollElement) return;

    const updateScrollControls = () => {
      const controls = scrollElement.querySelector<HTMLElement>('[data-scroll-controls]');
      const controlsHeight = controls?.offsetHeight || 0;
      setShowScrollControls(scrollElement.scrollHeight - controlsHeight > scrollElement.clientHeight + 1);
    };
    const frameId = window.requestAnimationFrame(updateScrollControls);
    const resizeObserver = new ResizeObserver(updateScrollControls);
    const mutationObserver = new MutationObserver(updateScrollControls);

    resizeObserver.observe(scrollElement);
    mutationObserver.observe(scrollElement, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    });
    window.addEventListener('resize', updateScrollControls);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', updateScrollControls);
    };
  }, [isOpen, activeTab, ingredientFields.length, instructionFields.length]);

  // Estado para subir imagen desde la web (URL) y para resaltar el recuadro al arrastrar.
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [addingWebImage, setAddingWebImage] = useState(false);
  const [showWebImageInput, setShowWebImageInput] = useState(false);
  const [webImageUrl, setWebImageUrl] = useState('');

  const tags = watch('tags') || [];

  // State for new section inputs
  const [showNewIngredientSection, setShowNewIngredientSection] = useState<{ [key: number]: boolean }>({});
  const [showNewInstructionSection, setShowNewInstructionSection] = useState<{ [key: number]: boolean }>({});
  const [savedIngredientSections, setSavedIngredientSections] = useState<string[]>([]);
  const watchedIngredients = useWatch({ control, name: 'ingredients' }) || [];
  const watchedInstructions = useWatch({ control, name: 'instructions' }) || [];

  // Lista compartida: las secciones creadas en ingredientes se sugieren en
  // preparación y viceversa, incluso antes de guardar la receta.
  const uniqueSections = useMemo(() => {
    const sections = new Set<string>();

    watchedIngredients.forEach(ing => {
      if (ing.section && ing.section.trim()) {
        sections.add(ing.section.trim());
      }
    });

    watchedInstructions.forEach(inst => {
      if (inst.section && inst.section.trim()) {
        sections.add(inst.section.trim());
      }
    });

    return Array.from(sections).sort();
  }, [watchedIngredients, watchedInstructions]);

  const ingredientSectionOptions = useMemo(
    () => Array.from(new Set([...uniqueSections, ...savedIngredientSections]))
      .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' })),
    [uniqueSections, savedIngredientSections]
  );

  const handleSaveIngredientSection = (index: number) => {
    const section = (getValues(`ingredients.${index}.section`) || '').trim();
    if (!section) {
      toast({ title: 'Escribí un nombre para la sección', variant: 'destructive' });
      return;
    }
    setValue(`ingredients.${index}.section`, section, { shouldDirty: true });
    setSavedIngredientSections(prev => prev.some(item => item.toLocaleLowerCase('es') === section.toLocaleLowerCase('es'))
      ? prev
      : [...prev, section]);
    setShowNewIngredientSection(prev => ({ ...prev, [index]: false }));
  };

  const handleApplyBulkIngredientSection = () => {
    if (selectedIngredientIndexes.size === 0) {
      toast({ title: 'Seleccioná al menos un ingrediente', variant: 'destructive' });
      return;
    }
    const section = bulkIngredientSection === '__none__' ? '' : bulkIngredientSection;
    selectedIngredientIndexes.forEach(index => {
      setValue(`ingredients.${index}.section`, section, { shouldDirty: true });
    });
    toast({
      title: section ? `Sección aplicada a ${selectedIngredientIndexes.size} ingredientes` : `Sección quitada de ${selectedIngredientIndexes.size} ingredientes`,
    });
    setSelectedIngredientIndexes(new Set());
    lastSelectedIngredientIndex.current = null;
  };

  const handleApplyBulkInstructionSection = () => {
    if (selectedInstructionIndexes.size === 0) {
      toast({ title: 'Seleccioná al menos un paso', variant: 'destructive' });
      return;
    }
    const section = bulkInstructionSection === '__none__' ? '' : bulkInstructionSection;
    selectedInstructionIndexes.forEach(index => {
      setValue(`instructions.${index}.section`, section, { shouldDirty: true });
    });
    toast({
      title: section ? `Sección aplicada a ${selectedInstructionIndexes.size} pasos` : `Sección quitada de ${selectedInstructionIndexes.size} pasos`,
    });
    setSelectedInstructionIndexes(new Set());
    lastSelectedInstructionIndex.current = null;
  };

  // Initialize form with recipe data
  useEffect(() => {
    if (recipe && isOpen) {
      setSavedIngredientSections([]);
      setSelectedIngredientIndexes(new Set());
      setBulkEditingIngredients(false);
      setBulkIngredientSection('__none__');
      lastSelectedIngredientIndex.current = null;
      setSelectedInstructionIndexes(new Set());
      setBulkEditingInstructions(false);
      setBulkInstructionSection('__none__');
      lastSelectedInstructionIndex.current = null;
      setExistingImages(recipe.images || []);
      setUploadedImages([]);
      setInitialImageCount(recipe.images?.length ?? 0);

      reset({
        title: recipe.title,
        description: recipe.description || '',
        suggestions: recipe.suggestions || '',
        importedFrom: recipe.importedFrom,
        sourceUrl: recipe.sourceUrl || '',
        source: recipe.source || '',
        author: recipe.author || '',
        createdAt: toDateInputValue(recipe.createdAt),
        prepTime: recipe.prepTime,
        cookTime: recipe.cookTime,
        servings: recipe.servings,
        difficulty: recipe.difficulty,
        recipeType: recipe.recipeType || '',
        dishType: recipe.dishType || '',
        country: recipe.country || '',
        language: recipe.language || '',
        glutenFree: recipe.glutenFree || false,
        sugarFree: recipe.sugarFree || false,
        keto: recipe.keto || false,
        lowCarb: recipe.lowCarb || false,
        vegetarian: recipe.vegetarian || false,
        proteica: recipe.proteica || false,
        sweet: recipe.sweet || false,
        savory: recipe.savory || false,
        thermomix: recipe.thermomix || false,
        airFryer: recipe.airFryer || false,
        featured: recipe.featured || false,
        cooked: recipe.cooked || false,
        locution: recipe.locution || '',
        tags: recipe.tags?.map(tag => typeof tag === 'string' ? tag : tag.tag || tag.name || '') || [],
        calories: recipe.calories || undefined,
        protein: recipe.protein || undefined,
        carbohydrates: recipe.carbohydrates || undefined,
        fat: recipe.fat || undefined,
        fiber: recipe.fiber || undefined,
        sugar: recipe.sugar || undefined,
        sodium: recipe.sodium || undefined,
        ingredients: recipe.ingredients?.map(ing => ({
          name: ing.name,
          amount: ing.amount,
          unit: ing.unit || '',
          section: ing.section || ''
        })) || [{ name: '', amount: '', unit: '', section: '' }],
        instructions: recipe.instructions?.map(inst => ({
          description: inst.description,
          function: inst.thermomixSettings?.function || '',
          time: inst.thermomixSettings?.time || '',
          temperature: inst.thermomixSettings?.temperature || '',
          speed: inst.thermomixSettings?.speed || '',
          section: inst.section || ''
        })) || [{ description: '', function: '', time: '', temperature: '', speed: '', section: '' }]
      });
      // Foto de los valores ya cargados: punto de partida para detectar cambios reales.
      initialFormSnapshot.current = getFormSnapshot(getValues());
    }
  }, [recipe, isOpen, reset, getValues]);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoadingCollections(true);
    api.collections.getAll()
      .then((items) => {
        setCollections(items);
        if (recipe?.id) {
          const ids = items
            .filter(collection => collection.recipeIds.includes(recipe.id))
            .sort((a, b) => (a.recipeOrders?.[recipe.id] ?? 0) - (b.recipeOrders?.[recipe.id] ?? 0))
            .map(collection => collection.id);
          setSelectedCollectionIds(ids);
          setInitialCollectionIds(ids);
        } else {
          setSelectedCollectionIds([]);
          setInitialCollectionIds([]);
        }
      })
      .catch(() => {
        setCollections([]);
        setSelectedCollectionIds([]);
        setInitialCollectionIds([]);
      })
      .finally(() => setIsLoadingCollections(false));
  }, [isOpen, recipe?.id]);

  // Cargar fuentes / idiomas / países existentes para sugerirlos (elegir o agregar nuevo).
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const sortEs = (arr: string[]) => Array.from(new Set(arr)).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
    const DEFAULT_LANGUAGES = ['Espanol', 'Ingles', 'Portugues', 'Italiano', 'Frances', 'Aleman'];
    const DEFAULT_COUNTRIES = ['Argentina', 'Espana', 'Mexico', 'Chile', 'Uruguay', 'Colombia', 'Peru', 'Estados Unidos', 'Italia', 'Francia'];
    Promise.all([
      api.recipes.getAll().catch(() => [] as Recipe[]),
      api.sources.getAll().catch(() => [] as Array<{ name: string }>),
      api.dishTypes.getAll().catch(() => [] as Array<{ name: string }>),
      api.categories.getAll().catch(() => [] as Array<{ name: string }>),
    ])
      .then(([allRecipes, customSources, customDishTypes, customCategories]) => {
        if (cancelled) return;
        const sources = new Set<string>();
        const languages: string[] = [...DEFAULT_LANGUAGES];
        const countries: string[] = [...DEFAULT_COUNTRIES];
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
        customSources.forEach(s => { const n = (s.name || '').trim(); if (n) sources.add(n); });
        customDishTypes.forEach(s => { const n = (s.name || '').trim(); if (n) dishTypes.add(n); });
        customCategories.forEach(s => { const n = (s.name || '').trim(); if (n) categories.add(n); });
        setSourceOptions(sortEs(Array.from(sources)));
        setLanguageOptions(sortEs(languages));
        setCountryOptions(sortEs(countries));
        setDishTypeOptions(sortEs(Array.from(dishTypes)));
        setCategoryOptions(sortEs(Array.from(categories)));
        setTagOptions(sortEs(Array.from(tagSet)));
      });
    return () => { cancelled = true; };
  }, [isOpen]);

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setValue('tags', [...tags, newTag.trim()], { shouldDirty: true });
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setValue('tags', tags.filter(tag => tag !== tagToRemove), { shouldDirty: true });
  };

  // Marcar/desmarcar una etiqueta desde el diálogo de etiquetas.
  const toggleTag = (tag: string) => {
    const t = tag.trim();
    if (!t) return;
    setValue('tags', tags.includes(t) ? tags.filter(x => x !== t) : [...tags, t], { shouldDirty: true });
  };

  // Crear una etiqueta nueva: la agrega a la receta y a la lista de opciones.
  const handleCreateTag = () => {
    const t = newTag.trim();
    if (!t) return;
    if (!tags.includes(t)) setValue('tags', [...tags, t], { shouldDirty: true });
    setTagOptions(prev => prev.includes(t) ? prev : [...prev, t].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' })));
    setNewTag('');
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const totalImages = existingImages.length + uploadedImages.length;

    files.forEach(file => {
      if (totalImages < 3 && file.type.startsWith('image/')) {
        const preview = URL.createObjectURL(file);
        setUploadedImages(prev => [...prev, { file, preview }]);
      }
    });
  };

  const handleRemoveExistingImage = (index: number) => {
    setExistingImages(prev => prev.filter((_, i) => i !== index));
  };

  // Agregar archivos de imagen (desde el botón "Mi PC" o arrastrando), respetando el máximo de 3.
  const addImageFiles = (files: File[]) => {
    let slots = 3 - (existingImages.length + uploadedImages.length);
    const toAdd: Array<{ file: File; preview: string }> = [];
    for (const file of files) {
      if (slots <= 0) break;
      if (!file.type.startsWith('image/')) continue;
      toAdd.push({ file, preview: URL.createObjectURL(file) });
      slots--;
    }
    if (toAdd.length) setUploadedImages(prev => [...prev, ...toAdd]);
    if (files.length > slots && existingImages.length + uploadedImages.length + toAdd.length >= 3) {
      // sin mensaje extra; el recuadro ya indica el máximo
    }
  };

  // Agregar una imagen desde una URL de la web (se descarga y optimiza en el servidor).
  const addWebImageFromUrl = async (rawUrl: string) => {
    const url = (rawUrl || '').trim();
    if (!/^https?:\/\//i.test(url)) {
      toast({ title: 'URL no válida', description: 'Pegá el enlace de una imagen (http...).', variant: 'destructive' });
      return;
    }
    if (existingImages.length + uploadedImages.length >= 3) {
      toast({ title: 'Máximo 3 imágenes', variant: 'destructive' });
      return;
    }
    setAddingWebImage(true);
    try {
      const res = await api.upload.fromUrl(url);
      setExistingImages(prev => [...prev, { url: res.image.url, altText: res.image.altText || 'Imagen', order: prev.length + 1 } as any]);
      setShowWebImageInput(false);
      setWebImageUrl('');
      toast({ title: 'Imagen agregada desde la web' });
    } catch (error: any) {
      toast({ title: 'No se pudo agregar la imagen', description: error?.message || 'Intentá con otra URL', variant: 'destructive' });
    } finally {
      setAddingWebImage(false);
    }
  };

  // Arrastrar una imagen al recuadro: archivo de la PC o imagen desde una página web (URL).
  const handleImageDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingImage(false);
    if (existingImages.length + uploadedImages.length >= 3) {
      toast({ title: 'Máximo 3 imágenes', variant: 'destructive' });
      return;
    }
    const files = Array.from(event.dataTransfer.files || []).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) { addImageFiles(files); return; }
    const html = event.dataTransfer.getData('text/html');
    const htmlSrc = html ? (html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] || '') : '';
    const url = (event.dataTransfer.getData('text/uri-list') || htmlSrc || event.dataTransfer.getData('text/plain') || '').trim();
    if (/^https?:\/\//i.test(url)) { await addWebImageFromUrl(url); return; }
    toast({ title: 'No se reconoció una imagen', description: 'Arrastrá un archivo o una imagen desde una página web.', variant: 'destructive' });
  };

  // En creación se conserva la lista completa tal como fue pegada. En edición se
  // mantiene el comportamiento histórico de separar cada línea en sus campos.
  const handlePasteIngredients = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) { toast({ title: 'El portapapeles está vacío', variant: 'destructive' }); return; }
      if (mode === 'create') {
        const pastedIngredients = text
          .split(/\r?\n/)
          .filter(line => line.trim())
          .map(line => ({ name: line, amount: '', unit: '', section: '', pasted: true }));
        replaceIngredients(pastedIngredients);
        setSelectedIngredientIndexes(new Set());
        lastSelectedIngredientIndex.current = null;
        toast({ title: `${pastedIngredients.length} ingredientes pegados` });
        return;
      }
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const parsed = lines.map(line => {
        const m = line.replace(/^[-*•\d.)\s]+/, '').match(/^([\d.,/]+)\s*([a-zA-Záéíóúñ.]+)?\s+(.*)$/);
        if (m && m[3]) {
          return { name: m[3].trim(), amount: m[1].trim(), unit: (m[2] || '').trim(), section: '' };
        }
        return { name: line.replace(/^[-*•\s]+/, '').trim(), amount: '', unit: '', section: '' };
      });
      parsed.forEach(ingredient => appendIngredient(ingredient));
      setSelectedIngredientIndexes(new Set());
      lastSelectedIngredientIndex.current = null;
      toast({ title: `${parsed.length} ingredientes agregados` });
    } catch {
      toast({ title: 'No se pudo leer el portapapeles', description: 'Permití el acceso al portapapeles o pegá manualmente.', variant: 'destructive' });
    }
  };

  // Pegar lista de pasos desde el portapapeles: uno por línea.
  const handlePasteInstructions = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const lines = text.split(/\r?\n/).map(l => l.replace(/^[-*•\d.)\s]+/, '').trim()).filter(Boolean);
      if (!lines.length) { toast({ title: 'El portapapeles está vacío', variant: 'destructive' }); return; }
      const pastedInstructions = lines.map(description => ({ description, function: '', time: '', temperature: '', speed: '', section: '' }));
      if (mode === 'create') {
        replaceInstructions(pastedInstructions);
      } else {
        pastedInstructions.forEach(instruction => appendInstruction(instruction));
      }
      setSelectedInstructionIndexes(new Set());
      setBulkEditingInstructions(false);
      setBulkInstructionSection('__none__');
      lastSelectedInstructionIndex.current = null;
      toast({ title: `${lines.length} pasos ${mode === 'create' ? 'pegados' : 'agregados'}` });
    } catch {
      toast({ title: 'No se pudo leer el portapapeles', description: 'Permití el acceso al portapapeles o pegá manualmente.', variant: 'destructive' });
    }
  };

  const handleGenerateRecipeAudio = async () => {
    const data = getValues();
    if (!data.title?.trim()) {
      toast({ title: 'Falta el titulo', description: 'Ingresa el titulo antes de generar el audio.', variant: 'destructive' });
      return;
    }

    const ingredientsText = (data.ingredients || [])
      .filter(ingredient => ingredient.name?.trim())
      .map(ingredient => {
        const section = ingredient.section?.trim() ? `[${ingredient.section.trim()}] ` : '';
        return `- ${section}${ingredient.amount || ''} ${ingredient.unit || ''} ${ingredient.name}`.replace(/\s+/g, ' ').trim();
      })
      .join('\n');
    const instructionsText = (data.instructions || [])
      .filter(instruction => instruction.description?.trim())
      .map((instruction, index) => {
        const section = instruction.section?.trim() ? `[${instruction.section.trim()}] ` : '';
        return `${index + 1}. ${section}${instruction.description}`;
      })
      .join('\n');

    const prompt = `Genera un guion natural y conversacional para escuchar esta receta de cocina. Empieza directamente con la receta, sin presentarte. Explica los ingredientes y la preparacion paso a paso, respetando las secciones cuando existan.

Titulo: ${data.title}
Descripcion: ${data.description || 'Sin descripcion'}
Tiempo de preparacion: ${data.prepTime || 'No especificado'} minutos
Tiempo de coccion: ${data.cookTime || 'No especificado'} minutos
Porciones: ${data.servings || 'No especificado'}
Dificultad: ${data.difficulty || 'No especificada'}

Ingredientes:
${ingredientsText || 'No especificados'}

Preparacion:
${instructionsText || 'No especificada'}

El resultado debe ser fluido, claro y agradable de escuchar.`;

    setIsGeneratingAudio(true);
    try {
      const response = await api.llm.generateScript(prompt);
      if (!response.success || !response.script?.trim()) throw new Error(response.error || 'No se genero el audio');
      setValue('locution', response.script.trim(), { shouldDirty: true });
      toast({ title: 'Audio de receta generado', description: 'Revisa la locucion antes de actualizar la receta.' });
    } catch (error) {
      toast({
        title: 'No se pudo generar el audio',
        description: error instanceof Error ? error.message : 'Intenta nuevamente.',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const handleDeleteRecipeAudio = () => {
    setValue('locution', '', { shouldDirty: true });
    toast({ title: 'Audio de receta borrado', description: 'Actualiza la receta para guardar el cambio.' });
  };

  // Recuerda el último campo de texto enfocado para "Pegar texto".
  const lastFieldRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const trackFocusField = (e: React.FocusEvent) => {
    const t = e.target as HTMLElement;
    if (t instanceof HTMLTextAreaElement) { lastFieldRef.current = t; return; }
    if (t instanceof HTMLInputElement) {
      const nonText = ['checkbox', 'radio', 'file', 'range', 'color', 'button', 'submit', 'reset'];
      if (!nonText.includes(t.type) && !t.readOnly && !t.disabled) lastFieldRef.current = t;
    }
  };

  // Pega el contenido del portapapeles en la posición del cursor del último campo enfocado.
  const handlePasteText = async () => {
    const el = lastFieldRef.current;
    if (!el) {
      toast({ title: 'Elegí un campo primero', description: 'Hacé clic en el campo donde querés pegar el texto.', variant: 'destructive' });
      return;
    }
    try {
      const text = await navigator.clipboard.readText();
      if (!text) { toast({ title: 'El portapapeles está vacío', variant: 'destructive' }); return; }
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      const newValue = el.value.slice(0, start) + text + el.value.slice(end);
      // Setter nativo + evento input para que React / react-hook-form tomen el cambio.
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      setter?.call(el, newValue);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      const caret = start + text.length;
      el.focus();
      el.setSelectionRange(caret, caret);
    } catch {
      toast({ title: 'No se pudo leer el portapapeles', description: 'Permití el acceso al portapapeles o pegá con Ctrl+V.', variant: 'destructive' });
    }
  };

  const handleRemoveNewImage = (index: number) => {
    setUploadedImages(prev => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleCalculateNutrition = async () => {
    const currentIngredients = watch('ingredients');
    const currentServings = watch('servings');

    if (!currentIngredients?.length || !currentServings) {
      toast({
        title: "Datos incompletos",
        description: "Agregue ingredientes y porciones antes de calcular",
        variant: "destructive"
      });
      return;
    }

    const result = await calculateNutrition(currentIngredients, currentServings);

    if (result) {
      // Update form with calculated nutrition values
      setValue('calories', result.calories, { shouldDirty: true });
      setValue('protein', result.protein, { shouldDirty: true });
      setValue('carbohydrates', result.carbohydrates, { shouldDirty: true });
      setValue('fat', result.fat, { shouldDirty: true });
      setValue('fiber', result.fiber, { shouldDirty: true });
      setValue('sugar', result.sugar, { shouldDirty: true });
      setValue('sodium', result.sodium, { shouldDirty: true });
    }
  };

  const syncRecipeCollections = async (recipeId: string) => {
    const currentCollectionIds = collections
      .filter(collection => collection.recipeIds.includes(recipeId))
      .map(collection => collection.id);
    const collectionIdsToAdd = selectedCollectionIds.filter(
      collectionId => !currentCollectionIds.includes(collectionId)
    );
    const collectionIdsToRemove = currentCollectionIds.filter(
      collectionId => !selectedCollectionIds.includes(collectionId)
    );

    await Promise.all([
      ...collectionIdsToAdd.map(collectionId => api.collections.addRecipe(collectionId, recipeId)),
      ...collectionIdsToRemove.map(collectionId => api.collections.removeRecipe(collectionId, recipeId)),
    ]);
    await api.collections.reorderRecipe(recipeId, selectedCollectionIds);

    const updatedCollections = await api.collections.getAll();
    setCollections(updatedCollections);
    onCollectionsUpdated?.(updatedCollections);
  };

  // Resuelve el createdAt a guardar a partir del valor del input (solo fecha, YYYY-MM-DD),
  // conservando la hora: si la fecha no cambió, mantiene el timestamp original (hora de
  // importación); si cambió, aplica la nueva fecha sobre la hora original.
  const resolveCreatedAt = (inputDate?: string): string | undefined => {
    if (!inputDate) return undefined;
    const original = recipe?.createdAt ? new Date(recipe.createdAt) : null;
    if (original && !Number.isNaN(original.getTime())) {
      if (toDateInputValue(original) === inputDate) {
        return original.toISOString();
      }
      const [y, m, d] = inputDate.split('-').map(Number);
      original.setUTCFullYear(y, m - 1, d);
      return original.toISOString();
    }
    // Receta sin fecha previa (p. ej. creación): nueva fecha con la hora actual.
    const base = new Date();
    const [y, m, d] = inputDate.split('-').map(Number);
    base.setUTCFullYear(y, m - 1, d);
    return base.toISOString();
  };

  const onSubmit = async (data: RecipeFormData) => {
    if (!recipe) return;

    // Sin cambios: no se actualiza. En modo cola pasa a la siguiente; en edición normal
    // el botón está deshabilitado, así que esto no debería dispararse (no cerramos).
    if (!hasChanges) {
      if (queue) queue.onNext();
      return;
    }

    // Convierte un valor de input numérico (posible string vacío/NaN) a número o undefined.
    const num = (v: unknown) => {
      const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
      return Number.isFinite(n) ? n : undefined;
    };

    setIsLoading(true);

    try {
      // Upload new images if any
      let newProcessedImages = [];
      if (uploadedImages.length > 0) {
        const files = uploadedImages.map(img => img.file);
        const uploadResult = await api.upload.images(files);
        if (uploadResult.success) {
          newProcessedImages = uploadResult.images;
        }
      }

      // Combine existing and new images
      const allImages = [
        ...existingImages.map((img, index) => ({ ...img, order: index + 1 })),
        ...newProcessedImages.map((img, index) => ({ ...img, order: existingImages.length + index + 1 }))
      ];

      const shouldSaveThermomixSettings = data.thermomix === true;

      // Create recipe data structure
      const recipeData = {
        title: data.title,
        description: data.description,
        suggestions: data.suggestions?.trim() || undefined,
        importedFrom: data.importedFrom || undefined,
        sourceUrl: data.sourceUrl || undefined,
        source: data.source?.trim() || undefined,
        author: data.author?.trim() || undefined,
        // La fecha se guarda con fecha + hora. El input solo muestra la fecha, así que
        // si no se cambió, conservamos el timestamp original (hora de importación);
        // si se cambió, aplicamos la nueva fecha manteniendo la hora original.
        createdAt: resolveCreatedAt(data.createdAt),
        images: allImages,
        prepTime: Number.isFinite(data.prepTime as number) ? data.prepTime : undefined,
        cookTime: Number.isFinite(data.cookTime as number) ? data.cookTime : undefined,
        servings: Number.isFinite(data.servings as number) ? data.servings : undefined,
        difficulty: normalizeDifficulty(data.difficulty),
        recipeType: data.recipeType,
        dishType: data.dishType?.trim() || undefined,
        country: data.country,
        language: data.language,
        glutenFree: data.glutenFree,
        sugarFree: data.sugarFree,
        keto: data.keto,
        lowCarb: data.lowCarb,
        vegetarian: data.vegetarian,
        proteica: data.proteica,
        sweet: data.sweet,
        savory: data.savory,
        thermomix: shouldSaveThermomixSettings,
        airFryer: data.airFryer,
        featured: data.featured,
        cooked: data.cooked,
        locution: data.locution,
        tags: data.tags,
        calories: num(data.calories),
        protein: num(data.protein),
        carbohydrates: num(data.carbohydrates),
        fat: num(data.fat),
        fiber: num(data.fiber),
        sugar: num(data.sugar),
        sodium: num(data.sodium),
        ingredients: data.ingredients
          .filter(ing => (ing.name || '').trim())
          .map((ing, index) => ({
            name: ing.pasted || (!ing.amount && !ing.unit && ing.name.includes('\n')) ? ing.name : ing.name.trim(),
            amount: ing.amount || '',
            unit: ing.unit,
            section: ing.section || undefined,
            order: index + 1
          })),
        instructions: data.instructions
          .filter(inst => (inst.description || '').trim())
          .map((inst, index) => ({
            step: index + 1,
            description: inst.description.trim(),
            function: shouldSaveThermomixSettings ? inst.function || "" : "",
            time: shouldSaveThermomixSettings ? inst.time || "" : "",
            temperature: shouldSaveThermomixSettings ? inst.temperature || "" : "",
            speed: shouldSaveThermomixSettings ? inst.speed || "" : "",
            section: inst.section || undefined
          }))
      };

      // Check if this is an existing recipe (has ID) or a new/imported recipe
      if (mode === 'create') {
        const createdRecipe = await api.recipes.create(recipeData as any);
        await syncRecipeCollections(createdRecipe.id);
        onRecipeUpdated(createdRecipe);
        const persistedImages = (createdRecipe.images || existingImages);
        setExistingImages(persistedImages);
        setUploadedImages([]);
        setInitialImageCount(persistedImages.length);
        setInitialCollectionIds(selectedCollectionIds);
        reset(data);
        initialFormSnapshot.current = getFormSnapshot(getValues());
        toast({
          title: "¡Receta creada!",
          description: `"${data.title}" se ha guardado exitosamente`,
        });
      } else if (recipe.id) {
        // Existing recipe - update via API
        const updatedRecipe = await api.recipes.update(recipe.id, recipeData as any);
        await syncRecipeCollections(updatedRecipe.id);

        console.log('✅ Recipe updated successfully, calling onRecipeUpdated');
        onRecipeUpdated(updatedRecipe);

        console.log('🎉 Showing edit success toast');
        toast({
          title: "¡Receta actualizada!",
          description: `"${data.title}" se ha actualizado exitosamente`,
        });

        // En edición secuencial pasamos a la siguiente receta; si no, la ventana
        // queda abierta (se cierra con "Finalizar"). Reseteamos el baseline para que
        // el botón vuelva a "Ver receta" hasta que se modifique algo de nuevo.
        if (queue) {
          queue.onNext();
        } else {
          const persistedImages = (updatedRecipe.images || existingImages);
          setExistingImages(persistedImages);
          setUploadedImages([]);
          setInitialImageCount(persistedImages.length);
          setInitialCollectionIds(selectedCollectionIds);
          reset(data);
          initialFormSnapshot.current = getFormSnapshot(getValues());
        }
      } else {
        // Receta sin ID (aún no persistida): solo actualiza el estado local y deja
        // la ventana abierta (se cierra con "Finalizar"), igual que el caso con ID.
        console.log('📝 Updating local recipe data (no ID yet)');
        onRecipeUpdated(recipeData as any);
        if (queue) {
          queue.onNext();
        } else {
          setUploadedImages([]);
          setInitialImageCount(existingImages.length);
          reset(data);
          initialFormSnapshot.current = getFormSnapshot(data);
        }
      }
    } catch (error) {
      console.error('Update recipe error:', error);
      toast({
        title: "Error al actualizar receta",
        description: error instanceof Error ? error.message : "No se pudo actualizar la receta",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    console.log('Closing modal...');

    // Simply close the modal - let the parent handle cleanup
    onClose();
  };

  if (!recipe) return null;

  const totalImages = existingImages.length + uploadedImages.length;
  const thermomixValue = watch('thermomix') as unknown;
  const showThermomixInstructionFields = thermomixValue === true || thermomixValue === 'true';

  return (
    <>
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        style={dragContentStyle}
        className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0"
        closeButtonClassName="right-4 top-4 h-8 w-8 rounded-md bg-primary/65 text-foreground opacity-100 inline-flex items-center justify-center shadow-sm backdrop-blur-sm hover:bg-primary/80 hover:opacity-100 data-[state=open]:bg-primary/65 data-[state=open]:text-foreground"
      >
        {/* Fixed Header (se puede arrastrar para mover el modal) */}
        <DialogHeader className="border-b px-6 pb-4 pt-6" {...dragHandleProps}>
          <DialogTitle className="flex w-full items-center justify-between gap-4 pr-10">
            <span className="flex shrink-0 items-center gap-2">
              <Edit className="h-5 w-5" />
              {mode === 'create' ? 'Nueva Receta' : 'Editar Receta'}
              {queue && (
                <Badge variant="secondary" className="ml-2">
                  Receta {queue.position + 1} de {queue.total}
                </Badge>
              )}
            </span>
            {mode !== 'create' && (
              <span
                className="min-w-0 max-w-[50%] truncate text-right text-base font-semibold text-muted-foreground"
                title={watch('title') || recipe.title || 'Sin titulo'}
              >
                {watch('title') || recipe.title || 'Sin titulo'}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} onFocus={trackFocusField} className="flex flex-col flex-1 min-h-0">
          {/* Fixed Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
            <div className="px-6 pt-4 flex-shrink-0">
              <TabsList className="grid h-auto w-full grid-cols-3 sm:grid-cols-6">
                <TabsTrigger value="info">Informacion</TabsTrigger>
                <TabsTrigger value="classification">Clasificacion</TabsTrigger>
                <TabsTrigger value="ingredients">Ingredientes</TabsTrigger>
                <TabsTrigger value="instructions">Preparacion</TabsTrigger>
                <TabsTrigger value="suggestions">Sugerencias</TabsTrigger>
                <TabsTrigger value="locution">Locucion</TabsTrigger>
              </TabsList>
            </div>

            {activeTab === 'ingredients' && (
              <div className="mx-6 mt-4 flex flex-shrink-0 items-center justify-between gap-3 border-b bg-background px-0 pb-3">
                <Label>Ingredientes</Label>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" onClick={handlePasteIngredients} size="sm" variant="outline">
                    <ClipboardList className="mr-1 h-4 w-4" />
                    Pegar
                  </Button>
                  <Button
                    type="button"
                    onClick={handleAppendIngredient}
                    size="sm"
                    variant="outline"
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Agregar
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setBulkEditingIngredients(prev => !prev);
                      setSelectedIngredientIndexes(new Set());
                      setBulkIngredientSection('__none__');
                      lastSelectedIngredientIndex.current = null;
                    }}
                    size="sm"
                    variant={bulkEditingIngredients ? "default" : "outline"}
                  >
                    <Edit className="mr-1 h-4 w-4" />
                    Editar
                  </Button>
                  <Button
                    type="button"
                    onClick={handleClearIngredients}
                    size="sm"
                    variant="outline"
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    Eliminar
                  </Button>
                </div>
              </div>
            )}

            {activeTab === 'instructions' && (
              <div className="mx-6 mt-4 flex flex-shrink-0 items-center justify-between gap-3 border-b bg-background px-0 pb-3">
                <Label>Preparacion</Label>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" onClick={handlePasteInstructions} size="sm" variant="outline">
                    <ClipboardList className="mr-1 h-4 w-4" />
                    Pegar
                  </Button>
                  <Button
                    type="button"
                    onClick={handleAppendInstruction}
                    size="sm"
                    variant="outline"
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Agregar
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setBulkEditingInstructions(prev => !prev);
                      setSelectedInstructionIndexes(new Set());
                      setBulkInstructionSection('__none__');
                      lastSelectedInstructionIndex.current = null;
                    }}
                    size="sm"
                    variant={bulkEditingInstructions ? "default" : "outline"}
                  >
                    <Edit className="mr-1 h-4 w-4" />
                    Editar
                  </Button>
                  <Button
                    type="button"
                    onClick={handleClearInstructions}
                    size="sm"
                    variant="outline"
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    Eliminar
                  </Button>
                </div>
              </div>
            )}

            {/* Scrollable content area with fixed height */}
            <div ref={formScrollRef} className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
              <TabsContent value="info" className="space-y-6 mt-4 bg-muted/20 p-6 rounded-lg m-0">
              {/* a: Título */}
              <div>
                <Label htmlFor="title">Titulo *</Label>
                <Input
                  id="title"
                  {...register('title', { required: 'El titulo es requerido' })}
                  placeholder="Nombre de tu receta"
                />
                {errors.title && (
                  <p className="text-sm text-destructive mt-1">{errors.title.message}</p>
                )}
              </div>

              {/* b: Descripción */}
              <div>
                <Label htmlFor="description">Descripcion</Label>
                <Textarea
                  id="description"
                  {...register('description')}
                  placeholder="Describi tu receta"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* c: Fuente / URL */}
                <div>
                  <Label>Fuente</Label>
                  <MultiSelectCombobox
                    options={sourceOptions}
                    selected={watch('source') ? [watch('source')] : []}
                    onChange={(next) => setValue('source', next[0] || '', { shouldDirty: true })}
                    placeholder="Elegi una fuente"
                    searchPlaceholder="Buscar o escribir fuente..."
                    singleSelect
                    closeOnSelect
                    allowCreate
                    createLabel="Agregar"
                    onDeleteOption={(value) => {
                      setSourceOptions(prev => prev.filter(option => option !== value));
                      if (watch('source') === value) setValue('source', '', { shouldDirty: true });
                    }}
                  />
                </div>
                <div>
                  <Label htmlFor="sourceUrl">URL</Label>
                  <Input id="sourceUrl" {...register('sourceUrl')} placeholder="Ingresa la URL de la receta" />
                </div>

                {/* d: Origen / Dificultad */}
                <div>
                  <Label>Origen</Label>
                  <CreatableCombobox
                    options={originOptions}
                    value={getImportSourceLabel(watch('importedFrom'))}
                    onChange={(value) => setValue('importedFrom', value ? getImportSourceValue(value) : undefined, { shouldDirty: true })}
                    placeholder="Selecciona de donde proviene la receta"
                    searchPlaceholder="Buscar o escribir origen..."
                    createLabel="Agregar"
                    emptyOptionLabel="Receta propia"
                    triggerClassName="focus:!ring-0 focus:!ring-offset-2 focus:border-primary data-[state=open]:border-primary"
                    onDeleteOption={(value) => {
                      setOriginOptions(prev => prev.filter(option => option !== value));
                      if (getImportSourceLabel(watch('importedFrom')) === value) {
                        setValue('importedFrom', undefined, { shouldDirty: true });
                      }
                    }}
                  />
                </div>
                <div>
                  <Label>Dificultad</Label>
                  <Select value={watch('difficulty')} onValueChange={(value) => setValue('difficulty', value as any, { shouldDirty: true })}>
                    <SelectTrigger className="focus:!ring-0 focus:!ring-offset-2 focus:border-primary data-[state=open]:border-primary">
                      <SelectValue placeholder="Selecciona dificultad de la receta" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Fácil">Fácil</SelectItem>
                      <SelectItem value="Medio">Medio</SelectItem>
                      <SelectItem value="Difícil">Difícil</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* e: Idioma / País */}
                <div>
                  <Label>Idioma</Label>
                  <MultiSelectCombobox
                    options={languageOptions}
                    selected={watch('language') ? [watch('language')] : []}
                    onChange={(next) => setValue('language', next[0] || '', { shouldDirty: true })}
                    placeholder="Elegi un idioma"
                    searchPlaceholder="Buscar o escribir idioma..."
                    singleSelect
                    closeOnSelect
                    allowCreate
                    createLabel="Agregar"
                    onDeleteOption={(value) => {
                      setLanguageOptions(prev => prev.filter(option => option !== value));
                      if (watch('language') === value) setValue('language', '', { shouldDirty: true });
                    }}
                  />
                </div>
                <div>
                  <Label>Pais</Label>
                  <MultiSelectCombobox
                    options={countryOptions}
                    selected={watch('country') ? [watch('country')] : []}
                    onChange={(next) => setValue('country', next[0] || '', { shouldDirty: true })}
                    placeholder="Elegi un pais"
                    searchPlaceholder="Buscar o escribir pais..."
                    singleSelect
                    closeOnSelect
                    allowCreate
                    createLabel="Agregar"
                    onDeleteOption={(value) => {
                      setCountryOptions(prev => prev.filter(option => option !== value));
                      if (watch('country') === value) setValue('country', '', { shouldDirty: true });
                    }}
                  />
                </div>

                {/* Fecha: solo se muestra la fecha; al guardar se conserva fecha + hora. */}
                <div>
                  <Label htmlFor="createdAt">Fecha</Label>
                  <Input id="createdAt" type="date" {...register('createdAt')} />
                </div>
              </div>

              {/* f: Tiempo de preparación / Tiempo total / Porciones */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="prepTime">Tiempo de preparacion (min)</Label>
                  <Input id="prepTime" type="number" {...register('prepTime', { valueAsNumber: true })} />
                </div>
                <div>
                  <Label htmlFor="cookTime">Tiempo total (min)</Label>
                  <Input id="cookTime" type="number" {...register('cookTime', { valueAsNumber: true })} />
                </div>
                <div>
                  <Label htmlFor="servings">Porciones</Label>
                  <Input id="servings" type="number" {...register('servings', { valueAsNumber: true })} />
                </div>
              </div>

              {/* Nutrition Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <Label className="text-lg font-semibold">Informacion Nutricional</Label>
                  <Button
                    type="button"
                    onClick={handleCalculateNutrition}
                    disabled={isCalculating}
                    variant="outline"
                    size="sm"
                  >
                    {isCalculating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Calculando...
                      </>
                    ) : (
                      <>
                        <Calculator className="h-4 w-4 mr-2" />
                        Calcular Nutrientes
                      </>
                    )}
                  </Button>
                </div>

                {/* g.1: Calorías / Proteína / Carbohidratos / Grasa */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor="calories">Calorias</Label>
                    <Input id="calories" type="number" step="0.1" {...register('calories')} placeholder="kcal" />
                  </div>
                    <div>
                      <Label htmlFor="protein">Proteina</Label>
                    <Input id="protein" type="number" step="0.1" {...register('protein')} placeholder="g" />
                  </div>
                  <div>
                    <Label htmlFor="carbohydrates">Carbohidratos</Label>
                    <Input id="carbohydrates" type="number" step="0.1" {...register('carbohydrates')} placeholder="g" />
                  </div>
                  <div>
                    <Label htmlFor="fat">Grasa</Label>
                    <Input id="fat" type="number" step="0.1" {...register('fat')} placeholder="g" />
                  </div>
                </div>
                {/* g.2: Fibra / Azúcar / Sodio (mismo ancho que la fila de Calorías) */}
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="fiber">Fibra</Label>
                    <Input id="fiber" type="number" step="0.1" {...register('fiber')} placeholder="g" />
                  </div>
                  <div>
                    <Label htmlFor="sugar">Azucar</Label>
                    <Input id="sugar" type="number" step="0.1" {...register('sugar')} placeholder="g" />
                  </div>
                  <div>
                    <Label htmlFor="sodium">Sodio</Label>
                    <Input id="sodium" type="number" step="0.1" {...register('sodium')} placeholder="mg" />
                  </div>
                </div>
              </div>

              {/* h: Imágenes (máximo 3) */}
              <div>
                <Label>Imagenes (maximo 3)</Label>

                {/* h.1: mostrar las imágenes (actuales + nuevas) */}
                {(existingImages.length > 0 || uploadedImages.length > 0) && (
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {existingImages.map((img, index) => (
                      <div key={`ex-${index}`} className="relative">
                        <img
                          src={resolveImageUrl(img.url)}
                          alt={img.altText || `Imagen ${index + 1}`}
                          className="w-full h-24 object-cover rounded"
                          loading="lazy"
                          crossOrigin="anonymous"
                        />
                        <button type="button" onClick={() => handleRemoveExistingImage(index)} className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    {uploadedImages.map((img, index) => (
                      <div key={`up-${index}`} className="relative">
                        <img src={img.preview} alt={`Preview ${index + 1}`} className="w-full h-24 object-cover rounded" />
                        <button type="button" onClick={() => handleRemoveNewImage(index)} className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1">
                          <X className="h-3 w-3" />
                        </button>
                        <div className="absolute bottom-1 left-1 bg-primary text-primary-foreground px-1 rounded text-xs">Nueva</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* input oculto para subir desde la PC */}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                  id="image-upload"
                  disabled={totalImages >= 3}
                />

                {/* h.2: recuadro para arrastrar + dos botones */}
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-stretch">
                  <div
                    onDragOver={(e) => { e.preventDefault(); if (totalImages < 3) setIsDraggingImage(true); }}
                    onDragLeave={() => setIsDraggingImage(false)}
                    onDrop={handleImageDrop}
                    className={`relative flex h-28 flex-1 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed p-3 text-center transition-colors ${isDraggingImage ? 'border-primary bg-primary/5' : 'border-gray-300'} ${totalImages >= 3 ? 'opacity-50' : ''}`}
                  >
                    {addingWebImage ? <Loader2 className="h-6 w-6 animate-spin text-gray-400" /> : <Upload className="h-6 w-6 text-gray-400" />}
                    <span className="text-xs text-gray-600">
                      {totalImages >= 3 ? 'Maximo 3 imagenes' : 'Arrastra aqui la imagen desde la pagina web o desde Mi PC'}
                    </span>
                  </div>
                  <div className="flex flex-col items-stretch justify-center gap-2">
                    <Button type="button" variant="outline" size="sm" className="text-xs" disabled={totalImages >= 3} onClick={() => document.getElementById('image-upload')?.click()}>
                      <Upload className="mr-2 h-3.5 w-3.5" />
                      Subir imagen de Mi PC
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="text-xs" disabled={totalImages >= 3 || addingWebImage} onClick={() => setShowWebImageInput(v => !v)}>
                      {addingWebImage ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Globe className="mr-2 h-3.5 w-3.5" />}
                      Subir imagen de la web
                    </Button>
                  </div>
                </div>
                {showWebImageInput && totalImages < 3 && (
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      value={webImageUrl}
                      onChange={(e) => setWebImageUrl(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addWebImageFromUrl(webImageUrl); } }}
                      placeholder="Pega el enlace de la imagen (https://...)"
                      className="h-9"
                      autoFocus
                    />
                    <Button type="button" size="sm" disabled={addingWebImage || !webImageUrl.trim()} onClick={() => void addWebImageFromUrl(webImageUrl)}>
                      {addingWebImage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Globe className="mr-2 h-4 w-4" />}
                      Agregar
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>

              <TabsContent value="classification" className="space-y-4 mt-4 bg-muted/20 px-6 pt-6 pb-1 rounded-lg m-0">
                {/* 1: Tipo de comida / Colección */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Tipo de comida</Label>
                      {(watch('dishType') || '').trim() && (
                        <button type="button" onClick={() => setValue('dishType', '', { shouldDirty: true })} title="Borrar todo" aria-label="Borrar todo" className="flex h-4 w-4 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <MultiSelectCombobox
                      options={dishTypeOptions}
                      selected={(watch('dishType') || '').split(',').map(s => s.trim()).filter(Boolean)}
                      onChange={(next) => setValue('dishType', next.join(', '), { shouldDirty: true })}
                      placeholder="Elegi uno o mas tipos de comida"
                      searchPlaceholder="Buscar o escribir tipo..."
                      closeOnSelect
                      allowCreate
                      createLabel="Agregar"
                      onDeleteOption={(value) => {
                        setDishTypeOptions(prev => prev.filter(option => option !== value));
                        const next = (watch('dishType') || '').split(',').map(s => s.trim()).filter(Boolean).filter(option => option !== value);
                        setValue('dishType', next.join(', '), { shouldDirty: true });
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Coleccion</Label>
                      {selectedCollectionIds.length > 0 && (
                        <button type="button" onClick={() => setSelectedCollectionIds([])} title="Borrar todo" aria-label="Borrar todo" className="flex h-4 w-4 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <MultiSelectCombobox
                      options={collections.map(c => c.name)}
                      selected={selectedCollectionIds.map(id => collections.find(c => c.id === id)?.name).filter(Boolean) as string[]}
                      onChange={(next) => {
                        const ids = next
                          .map(name => collections.find(c => c.name === name)?.id)
                          .filter(Boolean) as string[];
                        setSelectedCollectionIds(ids);
                      }}
                      onCreate={async (name) => {
                        try {
                          const created = await api.collections.create(name);
                          setCollections(prev => [...prev, created]);
                          setSelectedCollectionIds(prev => [...prev, created.id]);
                          toast({ title: 'Coleccion creada', description: `Se creo "${created.name}".` });
                        } catch (error: any) {
                          toast({ title: 'No se pudo crear la coleccion', description: error?.message || 'Intenta nuevamente', variant: 'destructive' });
                        }
                      }}
                      placeholder={isLoadingCollections ? 'Cargando colecciones...' : 'Elegi una o mas colecciones'}
                      searchPlaceholder="Buscar o crear coleccion..."
                      closeOnSelect
                      allowCreate
                      createLabel="Crear coleccion"
                      onDeleteOption={(value) => {
                        const collection = collections.find(c => c.name === value);
                        setCollections(prev => prev.filter(c => c.name !== value));
                        if (collection) {
                          setSelectedCollectionIds(prev => prev.filter(id => id !== collection.id));
                        }
                      }}
                    />
                  </div>
                </div>

                {/* 2: Categoría */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Categoria</Label>
                    {(watch('recipeType') || '').trim() && (
                      <button type="button" onClick={() => setValue('recipeType', '', { shouldDirty: true })} title="Borrar todo" aria-label="Borrar todo" className="flex h-4 w-4 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <MultiSelectCombobox
                    options={categoryOptions}
                    selected={(watch('recipeType') || '').split(',').map(s => s.trim()).filter(Boolean)}
                    onChange={(next) => setValue('recipeType', next.join(', '), { shouldDirty: true })}
                    placeholder="Elegi una o mas categorias"
                    searchPlaceholder="Buscar o escribir categoria..."
                    closeOnSelect
                    allowCreate
                    createLabel="Agregar"
                    onDeleteOption={(value) => {
                      setCategoryOptions(prev => prev.filter(option => option !== value));
                      const next = (watch('recipeType') || '').split(',').map(s => s.trim()).filter(Boolean).filter(option => option !== value);
                      setValue('recipeType', next.join(', '), { shouldDirty: true });
                    }}
                  />
                </div>

                {/* 3: Etiquetas */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Etiquetas</Label>
                    {tags.length > 0 && (
                      <button type="button" onClick={() => setValue('tags', [], { shouldDirty: true })} title="Borrar todo" aria-label="Borrar todo" className="flex h-4 w-4 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2 mb-2">
                    <Input
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      placeholder="Agregar etiqueta"
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                    />
                    <Button type="button" onClick={() => { setNewTag(''); setTagDialogOpen(true); }} size="sm" title="Elegir etiquetas">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {tags.map((tag, index) => (
                      <Badge key={index} variant="secondary" className="flex items-center gap-1">
                        {tag}
                        <button type="button" onClick={() => handleRemoveTag(tag)} className="ml-1 hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* c-f: Características (switches sí/no con ícono) — 4 por renglón, 2 renglones */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {([
                    { field: 'thermomix', label: 'Thermomix', icon: <img src="/thermomix-logo.transparent.png" alt="" aria-hidden="true" className="h-4 w-4 object-contain" /> },
                    { field: 'airFryer', label: 'Air Fryer', icon: <img src="/air-fryer.transparent.png" alt="" aria-hidden="true" className="h-4 w-4 object-contain" /> },
                    { field: 'glutenFree', label: 'Sin Gluten', icon: <WheatOff className="h-4 w-4" /> },
                    { field: 'sugarFree', label: 'Sin Azucar', icon: <CandyOff className="h-4 w-4" /> },
                    { field: 'keto', label: 'Keto', icon: <AvocadoIcon className="h-4 w-4" /> },
                    { field: 'lowCarb', label: 'Low Carb', icon: <img src="/logo-saludable.png" alt="" aria-hidden="true" className="h-4 w-4 object-contain" /> },
                    { field: 'proteica', label: 'Proteica', icon: <Beef className="h-4 w-4" /> },
                    { field: 'vegetarian', label: 'Vegetariana', icon: <Leaf className="h-4 w-4" /> },
                    { field: 'sweet', label: 'Receta dulce', icon: <CakeSlice className="h-4 w-4" /> },
                    { field: 'savory', label: 'Receta salada', icon: <Utensils className="h-4 w-4" /> },
                    { field: 'cooked', label: 'Cocinada', icon: <RecipePreparedIcon className="h-4 w-4" /> },
                    { field: 'featured', label: 'Favorita', icon: <Heart className="h-4 w-4" /> },
                  ] as const).map(({ field, label, icon }) => {
                    const active = Boolean(watch(field as any));
                    return (
                      <label key={field} className="flex min-h-10 cursor-pointer items-center justify-between rounded-md border bg-background px-2.5 py-1.5">
                        <span className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">{icon}</span>
                          {label}
                        </span>
                        <Switch className="scale-[0.85] data-[state=checked]:!bg-[#9eddee]" checked={active} onCheckedChange={(v) => setValue(field as any, v, { shouldDirty: true })} />
                      </label>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent
                value="ingredients"
                className={`m-0 space-y-6 rounded-lg bg-muted/20 px-6 pb-6 ${bulkEditingIngredients ? 'pt-0' : 'pt-6'}`}
              >
              {bulkEditingIngredients && (
                <div className="sticky top-0 z-20 -mx-6 flex flex-wrap items-end gap-3 border-b border-border bg-background/95 px-6 pb-3 pt-0 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/90">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedIngredientIndexes(
                        selectedIngredientIndexes.size === ingredientFields.length
                          ? new Set()
                          : new Set(ingredientFields.map((_, index) => index))
                      );
                      lastSelectedIngredientIndex.current = null;
                    }}
                  >
                    {selectedIngredientIndexes.size === ingredientFields.length ? 'Quitar selección' : 'Seleccionar todos'}
                  </Button>
                  <div className="min-w-56 flex-1 space-y-1">
                    <Label className="text-xs">Sección</Label>
                    <CreatableCombobox
                      value={bulkIngredientSection === '__none__' ? '' : bulkIngredientSection}
                      options={ingredientSectionOptions}
                      onChange={(value) => {
                        const section = value.trim();
                        setBulkIngredientSection(section || '__none__');
                        if (section) {
                          setSavedIngredientSections(prev => Array.from(new Set([...prev, section])));
                        }
                      }}
                      placeholder="Sin sección"
                      searchPlaceholder="Elegir o crear sección..."
                      createLabel="Crear sección"
                      emptyOptionLabel="Sin sección"
                      triggerClassName="h-9"
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleApplyBulkIngredientSection}
                    disabled={selectedIngredientIndexes.size === 0}
                  >
                    <Check className="mr-1 h-4 w-4" />
                    Aplicar a {selectedIngredientIndexes.size || 0}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setBulkEditingIngredients(false);
                      setSelectedIngredientIndexes(new Set());
                      lastSelectedIngredientIndex.current = null;
                    }}
                  >
                    Finalizar edición
                  </Button>
                </div>
              )}
              {/* Ingredients */}
              <div>
                <div className="space-y-2">
                  {ingredientFields.map((field, index) => {
                    const ingredient = watch(`ingredients.${index}`);
                    const isPastedBlock = Boolean(
                      ingredient?.name?.includes('\n')
                      && !ingredient?.amount
                      && !ingredient?.unit
                    );
                    const isPastedIngredient = ingredient?.pasted === true;

                    return (
                    <div
                      key={field.id}
                      className={bulkEditingIngredients
                        ? 'space-y-2 py-1'
                        : 'space-y-2 rounded-lg border p-3'}
                    >
                      {bulkEditingIngredients ? (
                        <div className="grid gap-3 md:grid-cols-[2rem_minmax(0,1fr)_minmax(12rem,0.38fr)] md:items-end">
                          <label className="flex h-9 cursor-pointer items-center text-sm font-medium">
                            <input
                              type="checkbox"
                              checked={selectedIngredientIndexes.has(index)}
                              readOnly
                              onClick={(event) => handleIngredientSelection(index, event)}
                              aria-label={`Seleccionar ingrediente ${index + 1}`}
                              className="h-4 w-4 cursor-pointer accent-primary"
                            />
                          </label>
                          <div className="min-w-0">
                            <Input
                              {...register(`ingredients.${index}.name`)}
                              aria-label={`Ingrediente ${index + 1}`}
                              className="h-9"
                            />
                          </div>
                          <div className="min-w-0">
                            <CreatableCombobox
                              value={ingredient?.section || ''}
                              options={ingredientSectionOptions}
                              onChange={(value) => {
                                const section = value.trim();
                                setValue(`ingredients.${index}.section`, section, { shouldDirty: true });
                                if (section) {
                                  setSavedIngredientSections(prev => Array.from(new Set([...prev, section])));
                                }
                              }}
                              placeholder="Sin sección"
                              searchPlaceholder="Elegir o crear sección..."
                              createLabel="Crear sección"
                              emptyOptionLabel="Sin sección"
                              triggerClassName="h-9"
                            />
                          </div>
                        </div>
                      ) : isPastedBlock ? (
                        <Textarea
                          {...register(`ingredients.${index}.name`)}
                          aria-label="Lista de ingredientes"
                          className="min-h-[180px] whitespace-pre-wrap"
                        />
                      ) : isPastedIngredient ? (
                        <div className="flex items-end gap-2">
                          <Input
                            {...register(`ingredients.${index}.name`)}
                            aria-label={`Ingrediente ${index + 1}`}
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            onClick={() => handleRemovePastedIngredient(index)}
                            size="sm"
                            variant="destructive"
                            className="-translate-y-1 !h-[22px] !w-[22px] !p-0"
                            title="Eliminar ingrediente"
                            aria-label="Eliminar ingrediente"
                          >
                            <X className="!h-[11px] !w-[11px]" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-2 items-end">
                          <div className="flex-1">
                            <Input
                              {...register(`ingredients.${index}.name`)}
                              placeholder="Ingrediente"
                            />
                          </div>
                          <div className="w-24">
                            <Input
                              {...register(`ingredients.${index}.amount`)}
                              placeholder="Cantidad"
                            />
                          </div>
                          <div className="w-20">
                            <Input
                              {...register(`ingredients.${index}.unit`)}
                              placeholder="Unidad"
                            />
                          </div>
                          {ingredientFields.length > 1 && (
                            <Button
                              type="button"
                              onClick={() => removeIngredient(index)}
                              size="sm"
                              variant="destructive"
                              className="-translate-y-1 !h-[22px] !w-[22px] !p-0"
                              title="Eliminar ingrediente"
                              aria-label="Eliminar ingrediente"
                            >
                              <X className="!h-[11px] !w-[11px]" />
                            </Button>
                          )}
                        </div>
                      )}
                      {!bulkEditingIngredients && !isPastedBlock && (
                      <div className="w-full space-y-2">
                        <Label className="text-xs">Seccion (opcional)</Label>
                        {!showNewIngredientSection[index] ? (
                          <Select
                            value={watch(`ingredients.${index}.section`) || '__none__'}
                            onValueChange={(value) => {
                              if (value === '__new__') {
                                setShowNewIngredientSection(prev => ({ ...prev, [index]: true }));
                                setValue(`ingredients.${index}.section`, '', { shouldDirty: true });
                              } else if (value === '__none__') {
                                setValue(`ingredients.${index}.section`, '', { shouldDirty: true });
                              } else {
                                setValue(`ingredients.${index}.section`, value, { shouldDirty: true });
                              }
                            }}
                          >
                            <SelectTrigger className="text-sm">
                              <SelectValue placeholder="Sin seccion" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Sin seccion</SelectItem>
                              {ingredientSectionOptions.map(section => (
                                <SelectItem key={section} value={section}>{section}</SelectItem>
                              ))}
                              <SelectItem value="__new__">+ Nueva seccion</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="flex gap-2">
                            <Input
                              {...register(`ingredients.${index}.section`)}
                              placeholder="Nombre de la nueva seccion"
                              className="text-sm"
                              autoFocus
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault();
                                  handleSaveIngredientSection(index);
                                }
                              }}
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleSaveIngredientSection(index)}
                            >
                              <Check className="mr-1 h-4 w-4" />
                              Guardar
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setValue(`ingredients.${index}.section`, '', { shouldDirty: true });
                                setShowNewIngredientSection(prev => ({ ...prev, [index]: false }));
                              }}
                            >
                              Cancelar
                            </Button>
                          </div>
                        )}
                      </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              </div>
            </TabsContent>

              <TabsContent
                value="instructions"
                className={`m-0 space-y-6 rounded-lg bg-muted/20 px-6 pb-6 ${bulkEditingInstructions ? 'pt-0' : 'pt-6'}`}
              >
              {bulkEditingInstructions && (
                <div className="sticky top-0 z-20 -mx-6 flex flex-wrap items-end gap-3 border-b border-border bg-background/95 px-6 pb-3 pt-0 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/90">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedInstructionIndexes(
                        selectedInstructionIndexes.size === instructionFields.length
                          ? new Set()
                          : new Set(instructionFields.map((_, index) => index))
                      );
                      lastSelectedInstructionIndex.current = null;
                    }}
                  >
                    {selectedInstructionIndexes.size === instructionFields.length ? 'Quitar selección' : 'Seleccionar todos'}
                  </Button>
                  <div className="min-w-56 flex-1 space-y-1">
                    <Label className="text-xs">Sección</Label>
                    <CreatableCombobox
                      value={bulkInstructionSection === '__none__' ? '' : bulkInstructionSection}
                      options={ingredientSectionOptions}
                      onChange={(value) => {
                        const section = value.trim();
                        setBulkInstructionSection(section || '__none__');
                        if (section) {
                          setSavedIngredientSections(prev => Array.from(new Set([...prev, section])));
                        }
                      }}
                      placeholder="Sin sección"
                      searchPlaceholder="Elegir o crear sección..."
                      createLabel="Crear sección"
                      emptyOptionLabel="Sin sección"
                      triggerClassName="h-9"
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleApplyBulkInstructionSection}
                    disabled={selectedInstructionIndexes.size === 0}
                  >
                    <Check className="mr-1 h-4 w-4" />
                    Aplicar a {selectedInstructionIndexes.size || 0}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setBulkEditingInstructions(false);
                      setSelectedInstructionIndexes(new Set());
                      lastSelectedInstructionIndex.current = null;
                    }}
                  >
                    Finalizar edición
                  </Button>
                </div>
              )}
              {/* Instructions */}
              <div>
                <div className={bulkEditingInstructions ? 'space-y-2' : 'space-y-4'}>
                  {instructionFields.map((field, index) => {
                    const instruction = watch(`instructions.${index}`);

                    return (
                    <div
                      key={field.id}
                      className={bulkEditingInstructions
                        ? 'py-1'
                        : 'rounded-lg border p-4'}
                    >
                      {bulkEditingInstructions ? (
                        <div className="grid gap-3 md:grid-cols-[2rem_1.5rem_minmax(0,1fr)_minmax(12rem,0.38fr)] md:items-end">
                          <label className="flex h-9 cursor-pointer items-center text-sm font-medium">
                            <input
                              type="checkbox"
                              checked={selectedInstructionIndexes.has(index)}
                              readOnly
                              onClick={(event) => handleInstructionSelection(index, event)}
                              aria-label={`Seleccionar paso ${index + 1}`}
                              className="h-4 w-4 cursor-pointer accent-primary"
                            />
                          </label>
                          <span className="flex h-9 items-center justify-end text-sm font-medium">
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <Input
                              {...register(`instructions.${index}.description`)}
                              aria-label={`Paso ${index + 1}`}
                              className="h-9"
                            />
                          </div>
                          <div className="min-w-0">
                            <CreatableCombobox
                              value={instruction?.section || ''}
                              options={ingredientSectionOptions}
                              onChange={(value) => {
                                const section = value.trim();
                                setValue(`instructions.${index}.section`, section, { shouldDirty: true });
                                if (section) {
                                  setSavedIngredientSections(prev => Array.from(new Set([...prev, section])));
                                }
                              }}
                              placeholder="Sin sección"
                              searchPlaceholder="Elegir o crear sección..."
                              createLabel="Crear sección"
                              emptyOptionLabel="Sin sección"
                              triggerClassName="h-9"
                            />
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="mb-2 flex items-center justify-between">
                            <Label>Paso {index + 1}</Label>
                            {instructionFields.length > 1 && (
                              <Button
                                type="button"
                                onClick={() => removeInstruction(index)}
                                size="sm"
                                variant="destructive"
                                className="-translate-y-1 !h-[22px] !w-[22px] !p-0"
                                title="Eliminar paso"
                                aria-label="Eliminar paso"
                              >
                                <X className="!h-[11px] !w-[11px]" />
                              </Button>
                            )}
                          </div>
                          <Textarea
                            {...register(`instructions.${index}.description`)}
                            placeholder="Describe el paso..."
                            className="mb-2"
                          />
                          <div className="mb-2">
                            <Label className="text-xs">Seccion (opcional)</Label>
                            {!showNewInstructionSection[index] ? (
                              <Select
                                value={watch(`instructions.${index}.section`) || '__none__'}
                                onValueChange={(value) => {
                                  if (value === '__new__') {
                                    setShowNewInstructionSection(prev => ({ ...prev, [index]: true }));
                                    setValue(`instructions.${index}.section`, '', { shouldDirty: true });
                                  } else if (value === '__none__') {
                                    setValue(`instructions.${index}.section`, '', { shouldDirty: true });
                                  } else {
                                    setValue(`instructions.${index}.section`, value, { shouldDirty: true });
                                    setSavedIngredientSections(prev => Array.from(new Set([...prev, value])));
                                  }
                                }}
                              >
                                <SelectTrigger className="text-sm">
                                  <SelectValue placeholder="Sin seccion" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">Sin seccion</SelectItem>
                                  {ingredientSectionOptions.map(section => (
                                    <SelectItem key={section} value={section}>{section}</SelectItem>
                                  ))}
                                  <SelectItem value="__new__">+ Nueva seccion</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <div className="mb-2 flex gap-2">
                                <Input
                                  {...register(`instructions.${index}.section`)}
                                  placeholder="Nombre de la nueva seccion"
                                  className="text-sm"
                                  autoFocus
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    const section = (getValues(`instructions.${index}.section`) || '').trim();
                                    if (section) {
                                      setValue(`instructions.${index}.section`, section, { shouldDirty: true });
                                      setSavedIngredientSections(prev => Array.from(new Set([...prev, section])));
                                    }
                                    setShowNewInstructionSection(prev => ({ ...prev, [index]: false }));
                                  }}
                                >
                                  Guardar
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setShowNewInstructionSection(prev => ({ ...prev, [index]: false }))}
                                >
                                  Cancelar
                                </Button>
                              </div>
                            )}
                          </div>
                          {showThermomixInstructionFields && (
                            <>
                              <div className="mb-2 grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-xs">Funcion Thermomix</Label>
                                  <Input
                                    {...register(`instructions.${index}.function`)}
                                    placeholder="ej: Amasar, Batir, Picar"
                                    size="sm"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Tiempo</Label>
                                  <Input
                                    {...register(`instructions.${index}.time`)}
                                    placeholder="ej: 5 min"
                                    size="sm"
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-xs">Temperatura</Label>
                                  <Input
                                    {...register(`instructions.${index}.temperature`)}
                                    placeholder="ej: 100 grados"
                                    size="sm"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Velocidad</Label>
                                  <Input
                                    {...register(`instructions.${index}.speed`)}
                                    placeholder="ej: vel 5"
                                    size="sm"
                                  />
                                </div>
                              </div>
                            </>
                          )}
                        </>
                      )}
                    </div>
                    );
                  })}
                </div>
              </div>
            </TabsContent>

              <TabsContent value="suggestions" className="mt-4 space-y-6 rounded-lg bg-muted/20 p-6 m-0">
              <div>
                <Label htmlFor="suggestions">Sugerencias</Label>
                <Textarea
                  id="suggestions"
                  {...register('suggestions')}
                  placeholder="Tips, consejos o notas para preparar la receta"
                  rows={3}
                />
              </div>
            </TabsContent>

              <TabsContent value="locution" className="space-y-6 mt-4 bg-muted/20 p-6 rounded-lg m-0">
              {/* Locution */}
              <div>
                <Label htmlFor="locution">Locucion (Script para TTS)</Label>
                <Textarea
                  id="locution"
                  {...register('locution')}
                  placeholder="Script de chef explicando la receta para reproducir con voz..."
                  rows={4}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Texto que se reproducira cuando se use la funcion de voz. Si esta vacio, se generara automaticamente.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGenerateRecipeAudio}
                    disabled={isGeneratingAudio}
                  >
                    {isGeneratingAudio
                      ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      : <AudioLines className="mr-2 h-4 w-4" />}
                    Generar audio receta
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDeleteRecipeAudio}
                    disabled={isGeneratingAudio || !(watch('locution') || '').trim()}
                    className="!text-[#70716e] hover:!text-[#70716e] [&_svg]:!text-[#70716e]"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Borrar audio receta
                  </Button>
                </div>
              </div>
            </TabsContent>

            {showScrollControls && (
            <div data-scroll-controls className="pointer-events-none sticky bottom-3 z-30 ml-auto mr-1 flex w-fit translate-x-6 flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={scrollFormToTop}
                className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full bg-primary/65 text-foreground shadow-md backdrop-blur-sm transition-all hover:scale-105 hover:bg-primary/80"
                title="Ir al principio"
                aria-label="Ir al principio"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={scrollFormToBottom}
                className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full bg-primary/65 text-foreground shadow-md backdrop-blur-sm transition-all hover:scale-105 hover:bg-primary/80"
                title="Ir al final"
                aria-label="Ir al final"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
            )}
            </div>
            {/* End of scrollable content */}
          </Tabs>

          {/* Fixed Submit Buttons */}
          <div className="flex justify-end gap-2 px-6 py-4 border-t flex-shrink-0">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="button" variant="outline" onClick={handlePasteText}>
              <ClipboardPaste className="h-4 w-4 mr-2" />
              Pegar texto
            </Button>
            {queue && queue.position < queue.total - 1 && (
              <Button type="button" variant="outline" onClick={() => queue.onNext()} disabled={isLoading}>
                Omitir
              </Button>
            )}
            <Button type="submit" disabled={isLoading || !hasChanges}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Actualizando...
                </>
              ) : queue ? (
                queue.position < queue.total - 1 ? 'Guardar y siguiente' : 'Guardar y finalizar'
              ) : (
                'Actualizar Receta'
              )}
            </Button>
            {!queue && onImportAnother && (
              <Button type="button" variant="secondary" onClick={onImportAnother} disabled={isLoading}>
                Importar otra receta
              </Button>
            )}
            {!queue && (
              <Button type="button" onClick={handleClose} disabled={isLoading}>
                Finalizar
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>

    {/* Diálogo para elegir/crear etiquetas */}
    <Dialog open={tagDialogOpen} onOpenChange={setTagDialogOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Etiquetas</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* Nueva etiqueta (primera opción) */}
          <div className="flex items-center gap-2">
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Nueva etiqueta"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateTag(); } }}
              autoFocus
            />
            <Button type="button" size="sm" onClick={handleCreateTag} disabled={!newTag.trim()}>
              <Plus className="mr-1 h-4 w-4" />
              Agregar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Para agregar etiqueta pulsar el +</p>

          {/* Lista de etiquetas existentes (orden alfabético) para marcar */}
          <div className="max-h-60 overflow-y-auto rounded-md border divide-y">
            {tagOptions.length === 0 && (
              <p className="px-3 py-4 text-sm text-muted-foreground">Todavia no hay etiquetas. Crea una arriba.</p>
            )}
            {tagOptions.map((tag) => {
              const checked = tags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50 ${checked ? 'bg-accent/40' : ''}`}
                >
                  <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${checked ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40 text-transparent'}`}>
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{tag}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setTagOptions(prev => prev.filter(option => option !== tag));
                      if (tags.includes(tag)) {
                        setValue('tags', tags.filter(value => value !== tag), { shouldDirty: true });
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      event.stopPropagation();
                      setTagOptions(prev => prev.filter(option => option !== tag));
                      if (tags.includes(tag)) {
                        setValue('tags', tags.filter(value => value !== tag), { shouldDirty: true });
                      }
                    }}
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Eliminar ${tag}`}
                    title="Eliminar de la lista"
                  >
                    <X className="h-3.5 w-3.5" />
                  </span>
                </button>
              );
            })}
          </div>

          {/* Etiquetas marcadas (se van agregando abajo) */}
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Seleccionadas ({tags.length})</p>
            <div className="flex flex-wrap gap-1">
              {tags.length === 0 && <span className="text-xs text-muted-foreground">Ninguna todavia.</span>}
              {tags.map((tag, index) => (
                <Badge key={index} variant="secondary" className="flex items-center gap-1">
                  {tag}
                  <button type="button" onClick={() => handleRemoveTag(tag)} className="ml-1 hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="button" onClick={() => setTagDialogOpen(false)}>Listo</Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};
