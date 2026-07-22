import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { RecipeCard, Recipe } from "@/components/RecipeCard";
import { CollectionsSidebar } from "@/components/CollectionsSidebar";
import { resolveImageUrl } from "@/utils/api";
import { RecipeModal } from "@/components/RecipeModal";
import { NutritionModal } from "@/components/NutritionModal";
import { FilterPanel, RecipeFilters } from "@/components/FilterPanel";
import { ImportRecipeModal } from "@/components/ImportRecipeModal";
import { BulkUrlImportModal } from "@/components/BulkUrlImportModal";
import { BulkEditModal } from "@/components/BulkEditModal";
import { CreateRecipeModal } from "@/components/CreateRecipeModal";
import { EditRecipeModal } from "@/components/EditRecipeModal";
import { DeleteRecipeDialog } from "@/components/DeleteRecipeDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Beef, CakeSlice, CandyOff, Grid3X3, Grid2X2, Grid, Columns, Filter, FilterX, ChevronDown, Trash2, Play, Pause, Search, ChefHat, Heart, Bookmark, WheatOff, Leaf, ArrowUpDown, ArrowUp, ArrowDown, Check, ListChecks, Printer, Loader2, X, ExternalLink, Utensils, UtensilsCrossed, MoreVertical, ImageIcon, User, List, Square, Clock, Plus, Tag, Edit, Menu, Download, Sparkles, PlusCircle, ClipboardPaste } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AvocadoIcon } from "@/components/icons/AvocadoIcon";
import { RecipePreparedIcon } from "@/components/icons/RecipePreparedIcon";
import { PreparationTimeIcon } from "@/components/icons/PreparationTimeIcon";
import { api, RecipeCollection } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { DebugAuth } from "@/components/DebugAuth";
import { AuthPage } from "@/components/auth/AuthPage";
import { isThermomixRecipe } from "@/utils/recipeUtils";
import { MultiSelectCombobox } from "@/components/MultiSelectCombobox";
import { parseCategories } from "@/constants/categories";
import { useRecipeCategories } from "@/hooks/useRecipeCategories";
import { useRecipeDishTypes } from "@/hooks/useRecipeDishTypes";
import { useRecipeSources } from "@/hooks/useRecipeSources";
import { useRecipeTags } from "@/hooks/useRecipeTags";
import { useRecipeAuthors } from "@/hooks/useRecipeAuthors";
import { useVoiceSettings } from "@/hooks/useVoiceSettings";
import { SaveToCollectionModal } from "@/components/SaveToCollectionModal";
import { getRecipeSource } from "@/utils/siteUtils";
import { FilterAutocompleteInput } from "@/components/FilterAutocompleteInput";
import { printRecipesPdf } from "@/utils/pdfUtils";
import { printRecipeCards } from "@/utils/printCards";
import { printRecipeList } from "@/utils/printList";
import { printCollectionCards, printCollectionList, PrintCollectionItem } from "@/utils/printCollections";
import { CoverPicker } from "@/components/CoverPicker";
import { saveRecentCategory } from "@/utils/recentCategories";
import { saveRecentRecipe } from "@/utils/recentRecipes";
import { saveRecentSource } from "@/utils/recentSources";

type RecipeSort = 'title' | 'category' | 'date' | 'collection' | 'source' | 'dishType' | 'difficulty' | 'prepTime' | 'totalTime';
type EditableGalleryKind = 'category' | 'source' | 'tag' | 'dishType';

type EditableGalleryTarget = {
  kind: EditableGalleryKind;
  name: string;
  cover?: string | null;
};

const EDITABLE_GALLERY_LABELS: Record<EditableGalleryKind, string> = {
  category: 'categoria',
  source: 'fuente',
  tag: 'etiqueta',
  dishType: 'tipo de comida',
};

const SORT_LABELS: Partial<Record<RecipeSort, string>> = {
  title: 'Titulo de receta',
  date: 'Fecha',
  source: 'Fuente',
  collection: 'Coleccion',
  category: 'Categoria',
  dishType: 'Tipo de comida',
};

const Index = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const initialAppView = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('view')
    : null;
  const initialSearchValues = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).getAll('buscar').map(term => term.trim()).filter(Boolean)
    : [];
  const initialSearch = initialSearchValues.length <= 1 ? (initialSearchValues[0] || "") : "";
  const initialRecipeTypeFilter = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('filtro')
    : null;
  const recipeToolbarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const { user } = useAuth();
  const { applySettingsToUtterance } = useVoiceSettings();
  const { categories, customCategories, createCategory, reloadCategories } = useRecipeCategories(Boolean(user));
  const { dishTypes: customDishTypes, createDishType, reloadDishTypes } = useRecipeDishTypes(Boolean(user));
  const { sources: customSources, createSource, reloadSources } = useRecipeSources(Boolean(user));
  const { tags: customTags, createTag, reloadTags } = useRecipeTags(Boolean(user));
  const { authors: customAuthors, createAuthor, reloadAuthors } = useRecipeAuthors(Boolean(user));

  const [searchTerm, setSearchTerm] = useState(initialSearch);
  // Palabras clave confirmadas (con Enter) para buscar recetas por varios terminos (AND).
  const [searchTerms, setSearchTerms] = useState<string[]>(initialSearchValues.length > 1 ? initialSearchValues : []);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  // El banner (Hero) ya no se muestra: una sola pagina.
  const [showHero, setShowHero] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showBulkUrlImportModal, setShowBulkUrlImportModal] = useState(false);
  // Panel lateral como cajon (drawer) en mobile/iPad.
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  // Panel lateral fijo en desktop (se puede ocultar con el boton de menu).
  const [showDesktopSidebar, setShowDesktopSidebar] = useState(true);
  // El boton de menu: en desktop (xl) alterna el panel fijo; en mobile/iPad abre el cajon.
  const handleMenuButton = () => {
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1280px)').matches) {
      setShowDesktopSidebar(v => !v);
    } else {
      setShowMobileSidebar(true);
    }
  };
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showNutritionModal, setShowNutritionModal] = useState(false);
  const [recipeToEdit, setRecipeToEdit] = useState<Recipe | null>(null);
  // Cola de recetas a editar de forma secuencial (tras importar varias por URL).
  const [editQueue, setEditQueue] = useState<Recipe[]>([]);
  const [editQueueIndex, setEditQueueIndex] = useState(0);
  const [recipeToDelete, setRecipeToDelete] = useState<Recipe | null>(null);
  const [nutritionRecipe, setNutritionRecipe] = useState<Recipe | null>(null);
  const [collectionRecipe, setCollectionRecipe] = useState<Recipe | null>(null);
  const [collectionRecipeIds, setCollectionRecipeIds] = useState<Set<string>>(new Set());
  const [collections, setCollections] = useState<RecipeCollection[]>([]);
  // Cuando es true, el panel derecho muestra la galeria de colecciones (tarjetas)
  // en lugar de la grilla de recetas.
  const [showCollectionsGallery, setShowCollectionsGallery] = useState(initialAppView === 'colecciones');
  // Igual que la anterior pero para la galeria de categorias.
  const [showCategoriesGallery, setShowCategoriesGallery] = useState(initialAppView === 'categorias');
  // Igual pero para la galeria de fuentes.
  const [showSourcesGallery, setShowSourcesGallery] = useState(initialAppView === 'fuentes');
  const [showTagsGallery, setShowTagsGallery] = useState(false);
  // Igual pero para la galeria de tipos de comida.
  const [showDishTypesGallery, setShowDishTypesGallery] = useState(initialAppView === 'tipo-comida');
  // Igual pero para la galeria de autores.
  const [showAuthorsGallery, setShowAuthorsGallery] = useState(false);
  // Mostrar el boton "volver arriba" cuando se hizo scroll hacia abajo.
  const [showScrollTop, setShowScrollTop] = useState(false);
  // Gestion de colecciones desde la galeria (menu de tres puntitos).
  const [deleteCollectionTarget, setDeleteCollectionTarget] = useState<RecipeCollection | null>(null);
  const [editCollectionTarget, setEditCollectionTarget] = useState<RecipeCollection | null>(null);
  const [editCollectionName, setEditCollectionName] = useState('');
  const [editingCollection, setEditingCollection] = useState(false);
  const [editGalleryTarget, setEditGalleryTarget] = useState<EditableGalleryTarget | null>(null);
  const [editGalleryName, setEditGalleryName] = useState('');
  const [editingGallery, setEditingGallery] = useState(false);
  const [bulkDeleteCollectionsOpen, setBulkDeleteCollectionsOpen] = useState(false);
  // Gestion de tipos de comida desde la galeria (menu de tres puntitos).
  const [deleteDishTypeTarget, setDeleteDishTypeTarget] = useState<string | null>(null);
  const coverChangeDishTypeName = useRef<string | null>(null);
  const dishTypeCoverInputRef = useRef<HTMLInputElement>(null);
  // Gestion de categorias desde la galeria.
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<string | null>(null);
  const coverChangeCategoryName = useRef<string | null>(null);
  const categoryCoverInputRef = useRef<HTMLInputElement>(null);
  // Gestion de fuentes desde la galeria.
  const [deleteSourceTarget, setDeleteSourceTarget] = useState<string | null>(null);
  const coverChangeSourceName = useRef<string | null>(null);
  const sourceCoverInputRef = useRef<HTMLInputElement>(null);
  // Gestion de etiquetas desde la galeria.
  const [deleteTagTarget, setDeleteTagTarget] = useState<string | null>(null);
  const coverChangeTagName = useRef<string | null>(null);
  const tagCoverInputRef = useRef<HTMLInputElement>(null);
  // Gestion de autores desde la galeria.
  const [deleteAuthorTarget, setDeleteAuthorTarget] = useState<string | null>(null);
  const coverChangeAuthorName = useRef<string | null>(null);
  const authorCoverInputRef = useRef<HTMLInputElement>(null);

  // TTS states
  const [playingRecipeId, setPlayingRecipeId] = useState<string | null>(null);
  const [pausedRecipeId, setPausedRecipeId] = useState<string | null>(null);
  const [generatingScript, setGeneratingScript] = useState<string | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoadingRecipes, setIsLoadingRecipes] = useState(true);
  const [filters, setFilters] = useState<RecipeFilters>(() => {
    // Permite abrir en pestana nueva una coleccion/categoria/fuente/tipo:
    // /?collection=<id> | /?categoria=<nombre> | /?fuente=<nombre> | /?tipo=<nombre>
    const params = new URLSearchParams(window.location.search);
    const collectionId = params.get('collection') || undefined;
    const categoria = params.get('categoria') || undefined;
    const fuente = params.get('fuente') || undefined;
    const tipo = params.get('tipo') || undefined;
    const etiqueta = params.get('etiqueta') || undefined;
    if (fuente) saveRecentSource(fuente);
    return {
      difficulty: [],
      prepTimeRange: [0, 180],
      recipeTypes: categoria ? [categoria] : [],
      tags: etiqueta ? [etiqueta] : [],
      ingredients: [],
      featured: undefined,
      thermomixOnly: initialAppView === 'thermomix' || initialRecipeTypeFilter === 'thermomix' ? true : undefined,
      airFryerOnly: initialRecipeTypeFilter === 'air-fryer' ? true : undefined,
      glutenFreeOnly: initialRecipeTypeFilter === 'sin-gluten' ? true : undefined,
      sugarFreeOnly: initialRecipeTypeFilter === 'sin-azucar' ? true : undefined,
      ketoOnly: initialRecipeTypeFilter === 'keto' ? true : undefined,
      lowCarbOnly: initialRecipeTypeFilter === 'low-carb' ? true : undefined,
      proteicaOnly: initialRecipeTypeFilter === 'proteicas' ? true : undefined,
      vegetarianOnly: initialRecipeTypeFilter === 'vegetarianas' ? true : undefined,
      sweetOnly: initialRecipeTypeFilter === 'dulces' ? true : undefined,
      savoryOnly: initialRecipeTypeFilter === 'saladas' ? true : undefined,
      collectionId,
      sources: fuente ? [fuente] : undefined,
      dishType: tipo || undefined,
    };
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const view = params.get('view');
    const keywords = params.getAll('buscar').map(term => term.trim()).filter(Boolean);
    const keyword = keywords.length <= 1 ? (keywords[0] || "") : "";
    const typeFilter = params.get('filtro');
    const categoria = params.get('categoria');

    setSearchTerm(keyword);
    setSearchTerms(keywords.length > 1 ? keywords : []);
    setShowCollectionsGallery(view === 'colecciones');
    setShowCategoriesGallery(view === 'categorias');
    setShowSourcesGallery(view === 'fuentes');
    setShowDishTypesGallery(view === 'tipo-comida');
    setShowTagsGallery(false);
    setShowAuthorsGallery(false);
    setShowFilters(false);
    setActiveBulkPanel(null);
    setSelectedRecipeIds(new Set());

    setFilters({
      difficulty: [],
      prepTimeRange: [0, 180],
      recipeTypes: categoria ? [categoria] : [],
      tags: [],
      ingredients: [],
      featured: typeFilter === 'favoritas' ? true : undefined,
      cookedOnly: typeFilter === 'cocinadas' ? true : undefined,
      thermomixOnly: view === 'thermomix' || typeFilter === 'thermomix' ? true : undefined,
      airFryerOnly: typeFilter === 'air-fryer' ? true : undefined,
      glutenFreeOnly: typeFilter === 'sin-gluten' ? true : undefined,
      sugarFreeOnly: typeFilter === 'sin-azucar' ? true : undefined,
      ketoOnly: typeFilter === 'keto' ? true : undefined,
      lowCarbOnly: typeFilter === 'low-carb' ? true : undefined,
      proteicaOnly: typeFilter === 'proteicas' ? true : undefined,
      vegetarianOnly: typeFilter === 'vegetarianas' ? true : undefined,
      sweetOnly: typeFilter === 'dulces' ? true : undefined,
      savoryOnly: typeFilter === 'saladas' ? true : undefined,
      collectionId: undefined,
      sources: undefined,
      dishType: undefined,
      dishTypes: [],
      author: undefined,
    });
  }, [location.search]);

  const [gridColumns, setGridColumns] = useState<1 | 2 | 3 | 4 | 5>(3); // Default to 3 columns
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'detail' | 'ingredients'>('grid'); // Grilla, lista, detalle o ingredientes
  const [recipeSort, setRecipeSort] = useState<RecipeSort>(() => {
    return (localStorage.getItem('recipe-sort') as RecipeSort) || 'date';
  });
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(() => {
    return (localStorage.getItem('recipe-sort-direction') as 'asc' | 'desc') || 'desc';
  });
  // Orden de la galeria de colecciones (por nombre o por cantidad de recetas).
  const [collectionSort, setCollectionSort] = useState<'name' | 'count'>('name');
  const [collectionSortDirection, setCollectionSortDirection] = useState<'asc' | 'desc'>('asc');
  // Orden de la galeria de tipos de comida (por nombre o por cantidad de recetas).
  const [dishTypeSort, setDishTypeSort] = useState<'name' | 'count'>('name');
  const [dishTypeSortDirection, setDishTypeSortDirection] = useState<'asc' | 'desc'>('asc');
  // Orden de la galeria de categorias (por nombre o por cantidad de recetas).
  const [categorySort, setCategorySort] = useState<'name' | 'count'>('name');
  const [categorySortDirection, setCategorySortDirection] = useState<'asc' | 'desc'>('asc');
  // Orden de la galeria de fuentes (por nombre o por cantidad de recetas).
  const [sourceSort, setSourceSort] = useState<'name' | 'count'>('name');
  const [sourceSortDirection, setSourceSortDirection] = useState<'asc' | 'desc'>('asc');
  // Orden de la galeria de etiquetas (por nombre o por cantidad de recetas).
  const [tagSort, setTagSort] = useState<'name' | 'count'>('name');
  const [tagSortDirection, setTagSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showFilters, setShowFilters] = useState(false);
  // Recordar el ?ltimo orden aplicado entre sesiones.
  useEffect(() => {
    localStorage.setItem('recipe-sort', recipeSort);
    localStorage.setItem('recipe-sort-direction', sortDirection);
  }, [recipeSort, sortDirection]);
  const [activeBulkPanel, setActiveBulkPanel] = useState<'print' | 'delete' | 'edit' | null>(null);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<Set<string>>(new Set());
  const [selectedCollectionBulkIds, setSelectedCollectionBulkIds] = useState<Set<string>>(new Set());
  const [showNewCollectionDialog, setShowNewCollectionDialog] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionCoverFile, setNewCollectionCoverFile] = useState<File | null>(null);
  const [newCollectionCoverUrl, setNewCollectionCoverUrl] = useState<string | null>(null);
  const [newCollectionCoverPreview, setNewCollectionCoverPreview] = useState<string | null>(null);
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [newCollectionCoverLoading, setNewCollectionCoverLoading] = useState(false);
  // Dialogo "Cambiar portada" de una coleccion existente.
  const [changeCoverCollection, setChangeCoverCollection] = useState<RecipeCollection | null>(null);
  const [changeCoverFile, setChangeCoverFile] = useState<File | null>(null);
  const [changeCoverUrl, setChangeCoverUrl] = useState<string | null>(null);
  const [changeCoverPreview, setChangeCoverPreview] = useState<string | null>(null);
  const [changeCoverLoading, setChangeCoverLoading] = useState(false);
  const [changeCoverSaving, setChangeCoverSaving] = useState(false);
  const lastSelectedRecipeId = useRef<string | null>(null); // para seleccion por rango (Shift)
  const lastSelectedCollectionId = useRef<string | null>(null); // seleccion por rango de colecciones (Shift)
  const lastSelectedDishTypeName = useRef<string | null>(null); // seleccion por rango de tipos de comida (Shift)
  const lastSelectedCategoryName = useRef<string | null>(null); // seleccion por rango de categorias (Shift)
  const lastSelectedSourceName = useRef<string | null>(null); // seleccion por rango de fuentes (Shift)
  const lastSelectedTagName = useRef<string | null>(null); // seleccion por rango de etiquetas (Shift)
  // Seleccion masiva / dialogos de la galeria de fuentes (imprimir, eliminar, nuevo).
  const [selectedSourceBulkNames, setSelectedSourceBulkNames] = useState<Set<string>>(new Set());
  const [bulkDeleteSourcesOpen, setBulkDeleteSourcesOpen] = useState(false);
  const [showNewSourceDialog, setShowNewSourceDialog] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceCoverFile, setNewSourceCoverFile] = useState<File | null>(null);
  const [newSourceCoverUrl, setNewSourceCoverUrl] = useState<string | null>(null);
  const [newSourceCoverPreview, setNewSourceCoverPreview] = useState<string | null>(null);
  const [newSourceCoverLoading, setNewSourceCoverLoading] = useState(false);
  const [creatingSource, setCreatingSource] = useState(false);
  // Seleccion masiva / dialogos de la galeria de etiquetas (imprimir, eliminar, nuevo).
  const [selectedTagBulkNames, setSelectedTagBulkNames] = useState<Set<string>>(new Set());
  const [bulkDeleteTagsOpen, setBulkDeleteTagsOpen] = useState(false);
  const [showNewTagDialog, setShowNewTagDialog] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagCoverFile, setNewTagCoverFile] = useState<File | null>(null);
  const [newTagCoverUrl, setNewTagCoverUrl] = useState<string | null>(null);
  const [newTagCoverPreview, setNewTagCoverPreview] = useState<string | null>(null);
  const [newTagCoverLoading, setNewTagCoverLoading] = useState(false);
  const [creatingTag, setCreatingTag] = useState(false);
  // Seleccion masiva / dialogos de la galeria de categorias (imprimir, eliminar, nuevo).
  const [selectedCategoryBulkNames, setSelectedCategoryBulkNames] = useState<Set<string>>(new Set());
  const [bulkDeleteCategoriesOpen, setBulkDeleteCategoriesOpen] = useState(false);
  const [showNewCategoryDialog, setShowNewCategoryDialog] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryCoverFile, setNewCategoryCoverFile] = useState<File | null>(null);
  const [newCategoryCoverUrl, setNewCategoryCoverUrl] = useState<string | null>(null);
  const [newCategoryCoverPreview, setNewCategoryCoverPreview] = useState<string | null>(null);
  const [newCategoryCoverLoading, setNewCategoryCoverLoading] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  // Dialogo de opciones al imprimir tarjetas/lista de colecciones o tipos de comida.
  const [galleryPrint, setGalleryPrint] = useState<{ kind: 'cards' | 'list'; label: string; items: PrintCollectionItem[] } | null>(null);
  const [galleryPrintTitle, setGalleryPrintTitle] = useState('');
  const [galleryPrintHeader, setGalleryPrintHeader] = useState('');
  const [galleryPrintFooter, setGalleryPrintFooter] = useState('');
  const [galleryPrintPageNumber, setGalleryPrintPageNumber] = useState(false);
  const [galleryPrintColumns, setGalleryPrintColumns] = useState(4);
  // Seleccion masiva / dialogos de la galeria de tipos de comida (imprimir, eliminar, nuevo).
  const [selectedDishTypeBulkNames, setSelectedDishTypeBulkNames] = useState<Set<string>>(new Set());
  const [bulkDeleteDishTypesOpen, setBulkDeleteDishTypesOpen] = useState(false);
  const [showNewDishTypeDialog, setShowNewDishTypeDialog] = useState(false);
  const [newDishTypeName, setNewDishTypeName] = useState('');
  const [newDishTypeCoverFile, setNewDishTypeCoverFile] = useState<File | null>(null);
  const [newDishTypeCoverUrl, setNewDishTypeCoverUrl] = useState<string | null>(null);
  const [newDishTypeCoverPreview, setNewDishTypeCoverPreview] = useState<string | null>(null);
  const [newDishTypeCoverLoading, setNewDishTypeCoverLoading] = useState(false);
  const [creatingDishType, setCreatingDishType] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [bulkAction, setBulkAction] = useState<'print' | 'print-cards' | 'print-list' | 'delete' | null>(null);
  const closeRecipeBulkPanel = () => {
    setActiveBulkPanel(null);
    setSelectedRecipeIds(new Set());
    setBulkAction(null);
  };
  const [printCardsDialogOpen, setPrintCardsDialogOpen] = useState(false);
  const [printCardsTitle, setPrintCardsTitle] = useState('');
  const [printCardsHeader, setPrintCardsHeader] = useState('');
  const [printCardsFooter, setPrintCardsFooter] = useState('');
  const [printCardsPageNumber, setPrintCardsPageNumber] = useState(false);
  const [printCardsColumns, setPrintCardsColumns] = useState(5);
  const [printCardsFields, setPrintCardsFields] = useState({
    image: true, title: true, source: false, collection: false, difficulty: false, dishType: false, category: false, times: false, icons: false,
  });
  const printCardsCompactFieldsOnly = printCardsColumns >= 5;
  const [printListDialogOpen, setPrintListDialogOpen] = useState(false);
  const [printListTitle, setPrintListTitle] = useState('');
  const [printListHeader, setPrintListHeader] = useState('');
  const [printListFooter, setPrintListFooter] = useState('');
  const [printListPageNumber, setPrintListPageNumber] = useState(false);
  const [printListVariant, setPrintListVariant] = useState<'list' | 'detail'>('list');
  const [displayedCount, setDisplayedCount] = useState(24); // Start with 24 items
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    const toolbar = recipeToolbarRef.current;
    if (!toolbar) return;

    const updateToolbarHeight = () => {
      document.documentElement.style.setProperty(
        '--tastebox-recipe-toolbar-height',
        `${toolbar.getBoundingClientRect().height}px`
      );
    };

    updateToolbarHeight();
    const observer = new ResizeObserver(updateToolbarHeight);
    observer.observe(toolbar);

    return () => observer.disconnect();
  }, [user]);

  // Clave de orden por coleccion: para cada receta, los nombres de las colecciones a las
  // que pertenece, ordenados y unidos. Las recetas sin coleccion quedan con string vacio.
  const collectionSortKeys = new Map<string, string>();
  recipes.forEach(recipe => {
    const names = collections
      .filter(collection => collection.recipeIds.includes(recipe.id))
      .map(collection => collection.name)
      .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
    collectionSortKeys.set(recipe.id, names.join(', '));
  });

  // Miniatura de portada por coleccion: la imagen de la primera receta (segun el orden
  // guardado) que tenga foto.
  const recipeById = new Map(recipes.map(recipe => [recipe.id, recipe]));
  const collectionCovers: Record<string, string | undefined> = {};
  collections.forEach(collection => {
    // Portada elegida manualmente por el usuario tiene prioridad.
    if (collection.coverImage) {
      collectionCovers[collection.id] = resolveImageUrl(collection.coverImage);
      return;
    }
    const ids = [...collection.recipeIds].sort(
      (a, b) => (collection.recipeOrders?.[a] ?? Number.MAX_SAFE_INTEGER) - (collection.recipeOrders?.[b] ?? Number.MAX_SAFE_INTEGER)
    );
    for (const id of ids) {
      const url = recipeById.get(id)?.images?.[0]?.url;
      if (url) {
        collectionCovers[collection.id] = resolveImageUrl(url);
        break;
      }
    }
  });

  // Lista de categorias usadas por las recetas, con cantidad y miniatura (primera receta
  // de esa categoria que tenga foto).
  const categoryMap = new Map<string, { count: number; cover?: string }>();
  recipes.forEach(recipe => {
    const cover = recipe.images?.[0]?.url ? resolveImageUrl(recipe.images[0].url) : undefined;
    parseCategories(recipe.recipeType).forEach(cat => {
      const entry = categoryMap.get(cat) || { count: 0, cover: undefined };
      entry.count += 1;
      if (!entry.cover && cover) entry.cover = cover;
      categoryMap.set(cat, entry);
    });
  });
  // Incluir categorias creadas manualmente y aplicar portada personalizada.
  customCategories.forEach(({ name, coverImage }) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const entry = categoryMap.get(trimmed) || { count: 0, cover: undefined };
    if (coverImage) entry.cover = resolveImageUrl(coverImage); // la portada manual tiene prioridad
    categoryMap.set(trimmed, entry);
  });
  const categoryList = Array.from(categoryMap.entries())
    .map(([name, { count, cover }]) => ({ name, count, cover }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));

  // Lista de fuentes (derivadas de sourceUrl) con cantidad y miniatura.
  const sourceMap = new Map<string, { count: number; cover?: string }>();
  recipes.forEach(recipe => {
    const name = getRecipeSource(recipe);
    if (!name) return;
    const cover = recipe.images?.[0]?.url ? resolveImageUrl(recipe.images[0].url) : undefined;
    const entry = sourceMap.get(name) || { count: 0, cover: undefined };
    entry.count += 1;
    if (!entry.cover && cover) entry.cover = cover;
    sourceMap.set(name, entry);
  });
  // Incluir fuentes creadas manualmente y aplicar portada personalizada.
  customSources.forEach(({ name, coverImage }) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const entry = sourceMap.get(trimmed) || { count: 0, cover: undefined };
    if (coverImage) entry.cover = resolveImageUrl(coverImage); // la portada manual tiene prioridad
    sourceMap.set(trimmed, entry);
  });
  const sourceList = Array.from(sourceMap.entries())
    .map(([name, { count, cover }]) => ({ name, count, cover }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));

  // Lista de etiquetas (de las recetas) con cantidad y miniatura.
  const tagMap = new Map<string, { count: number; cover?: string }>();
  recipes.forEach(recipe => {
    const cover = recipe.images?.[0]?.url ? resolveImageUrl(recipe.images[0].url) : undefined;
    (recipe.tags || []).forEach((t: any) => {
      const name = (typeof t === 'string' ? t : (t?.tag?.name || t?.name || t?.tag || '')).toString().trim();
      if (!name) return;
      const entry = tagMap.get(name) || { count: 0, cover: undefined };
      entry.count += 1;
      if (!entry.cover && cover) entry.cover = cover;
      tagMap.set(name, entry);
    });
  });
  // Incluir etiquetas creadas manualmente y aplicar portada personalizada.
  customTags.forEach(({ name, coverImage }) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const entry = tagMap.get(trimmed) || { count: 0, cover: undefined };
    if (coverImage) entry.cover = resolveImageUrl(coverImage);
    tagMap.set(trimmed, entry);
  });
  const tagList = Array.from(tagMap.entries())
    .map(([name, { count, cover }]) => ({ name, count, cover }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));

  // Lista de tipos de comida (dishType) con cantidad y miniatura.
  const dishTypeMap = new Map<string, { count: number; cover?: string }>();
  recipes.forEach(recipe => {
    const names = (recipe.dishType || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!names.length) return;
    const cover = recipe.images?.[0]?.url ? resolveImageUrl(recipe.images[0].url) : undefined;
    names.forEach(name => {
      const entry = dishTypeMap.get(name) || { count: 0, cover: undefined };
      entry.count += 1;
      if (!entry.cover && cover) entry.cover = cover;
      dishTypeMap.set(name, entry);
    });
  });
  // Incluir tipos de comida creados manualmente y aplicar portada personalizada.
  customDishTypes.forEach(({ name, coverImage }) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const entry = dishTypeMap.get(trimmed) || { count: 0, cover: undefined };
    if (coverImage) entry.cover = resolveImageUrl(coverImage); // la portada manual tiene prioridad
    dishTypeMap.set(trimmed, entry);
  });
  const dishTypeList = Array.from(dishTypeMap.entries())
    .map(([name, { count, cover }]) => ({ name, count, cover }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));

  // Lista de autores con cantidad y miniatura.
  const authorMap = new Map<string, { count: number; cover?: string }>();
  recipes.forEach(recipe => {
    const name = (recipe.author || '').trim();
    if (!name) return;
    const cover = recipe.images?.[0]?.url ? resolveImageUrl(recipe.images[0].url) : undefined;
    const entry = authorMap.get(name) || { count: 0, cover: undefined };
    entry.count += 1;
    if (!entry.cover && cover) entry.cover = cover;
    authorMap.set(name, entry);
  });
  // Incluir autores creados manualmente y aplicar portada personalizada.
  customAuthors.forEach(({ name, coverImage }) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const entry = authorMap.get(trimmed) || { count: 0, cover: undefined };
    if (coverImage) entry.cover = resolveImageUrl(coverImage); // la portada manual tiene prioridad
    authorMap.set(trimmed, entry);
  });
  const authorList = Array.from(authorMap.entries())
    .map(([name, { count, cover }]) => ({ name, count, cover }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));

  // Apply search and filters, then sort alphabetically (only when user is logged in)
  const allFilteredRecipes = user ? recipes.filter(recipe => {
    // Busqueda - por varias palabras clave (AND): titulo, descripcion, ingredientes,
    // instrucciones, etiquetas, categoria, fuente y colecciones.
    const matchesTerm = (q: string) =>
      (recipe.title || '').toLowerCase().includes(q) ||
      (recipe.description || '').toLowerCase().includes(q) ||
      (recipe.ingredients || []).some(ingredient =>
        (ingredient.name || '').toLowerCase().includes(q) ||
        (ingredient.amount && ingredient.amount.toLowerCase().includes(q)) ||
        (ingredient.unit && ingredient.unit.toLowerCase().includes(q))
      ) ||
      (recipe.instructions || []).some(instruction =>
        (instruction.description || '').toLowerCase().includes(q)
      ) ||
      (recipe.tags || []).some(tag => {
        const tagValue = typeof tag === 'string' ? tag : tag.tag || tag.name || '';
        return tagValue.toLowerCase().includes(q);
      }) ||
      (recipe.recipeType && recipe.recipeType.toLowerCase().includes(q)) ||
      (getRecipeSource(recipe).toLowerCase().includes(q)) ||
      collections.some(col => col.recipeIds.includes(recipe.id) && (col.name || '').toLowerCase().includes(q));

    const allSearchTerms = [...searchTerms, searchTerm]
      .map(t => t.trim().toLowerCase())
      .filter(Boolean);
    const matchesSearch = allSearchTerms.length === 0 || allSearchTerms.every(matchesTerm);

    // Difficulty filter
    const matchesDifficulty = filters.difficulty.length === 0 ||
      filters.difficulty.includes(recipe.difficulty);

    // Prep time filter
    const matchesPrepTime = recipe.prepTime >= (filters.prepTimeRange?.[0] ?? 0) &&
      recipe.prepTime <= (filters.prepTimeRange?.[1] ?? 180);


    // Recipe type filter
    const recipeCategories = parseCategories(recipe.recipeType);
    const matchesRecipeType = filters.recipeTypes.length === 0 ||
      filters.recipeTypes.some(c => recipeCategories.includes(c));

    // Tags filter
    const matchesTags = filters.tags.length === 0 ||
      filters.tags.some(filterTag =>
        (recipe.tags || []).some(recipeTag => {
          const tagValue = typeof recipeTag === 'string' ? recipeTag : recipeTag.tag || recipeTag.name || '';
          return tagValue === filterTag;
        })
      );

    const normalizeIngredient = (value: string) =>
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('es')
        .trim();
    const matchesIngredients = !filters.ingredients?.length ||
      filters.ingredients.every(filterIngredient => {
        const filterValue = normalizeIngredient(filterIngredient);
        return (recipe.ingredients || []).some(ingredient => {
          const ingredientValue = normalizeIngredient(ingredient.name);
          return ingredientValue.includes(filterValue) || filterValue.includes(ingredientValue);
        });
      });

    // Featured filter
    const matchesFeatured = !filters.featured || recipe.featured === true;

    // Cocinadas filter
    const matchesCooked = !filters.cookedOnly || recipe.cooked === true;

    // Thermomix filter
    const matchesThermomix = !filters.thermomixOnly || recipe.thermomix || isThermomixRecipe(recipe);
    const matchesAirFryer = !filters.airFryerOnly || recipe.airFryer === true;

    // Sin gluten / Keto / Low Carb filters
    const matchesGlutenFree = !filters.glutenFreeOnly || recipe.glutenFree === true;
    const matchesSugarFree = !filters.sugarFreeOnly || recipe.sugarFree === true;
    const matchesKeto = !filters.ketoOnly || recipe.keto === true;
    const matchesLowCarb = !filters.lowCarbOnly || recipe.lowCarb === true;
    const matchesProteica = !filters.proteicaOnly || recipe.proteica === true;
    const matchesVegetarian = !filters.vegetarianOnly || recipe.vegetarian === true;
    const matchesSweet = !filters.sweetOnly || recipe.sweet === true;
    const matchesSavory = !filters.savoryOnly || recipe.savory === true;
    const selectedCollection = filters.collectionId
      ? collections.find(collection => collection.id === filters.collectionId)
      : undefined;
    const matchesCollection = !filters.collectionId
      || Boolean(selectedCollection?.recipeIds.includes(recipe.id));
    const matchesSource = !filters.sources?.length
      || filters.sources.includes(getRecipeSource(recipe));
    const selectedDishTypes = [...(filters.dishTypes || []), ...(filters.dishType ? [filters.dishType] : [])];
    const recipeDishTypes = (recipe.dishType || '').split(',').map(s => s.trim()).filter(Boolean);
    const matchesDishType = selectedDishTypes.length === 0 || recipeDishTypes.some(dt => selectedDishTypes.includes(dt));
    const matchesAuthor = !filters.author || (recipe.author || '').trim() === filters.author;

    return matchesSearch && matchesDifficulty && matchesPrepTime && matchesRecipeType && matchesTags && matchesIngredients && matchesFeatured && matchesCooked && matchesThermomix && matchesAirFryer && matchesGlutenFree && matchesSugarFree && matchesKeto && matchesLowCarb && matchesProteica && matchesVegetarian && matchesSweet && matchesSavory && matchesCollection && matchesSource && matchesDishType && matchesAuthor;
  }).sort((a, b) => {
    const directionFactor = sortDirection === 'asc' ? 1 : -1;
    const compareText = (left: string, right: string) =>
      left.localeCompare(right, 'es', { sensitivity: 'base' });
    const titleComparison = compareText(a.title, b.title);

    if (recipeSort === 'category') {
      const categoryA = parseCategories(a.recipeType).join(', ');
      const categoryB = parseCategories(b.recipeType).join(', ');
      return directionFactor * (compareText(categoryA, categoryB) || titleComparison);
    }

    if (recipeSort === 'collection') {
      const collectionA = collectionSortKeys.get(a.id) || '';
      const collectionB = collectionSortKeys.get(b.id) || '';
      // Recetas sin coleccion siempre al final, en cualquier direccion.
      if (!collectionA && collectionB) return 1;
      if (collectionA && !collectionB) return -1;
      return directionFactor * (compareText(collectionA, collectionB) || titleComparison);
    }

    if (recipeSort === 'source') {
      const sourceA = getRecipeSource(a) || 'Receta propia';
      const sourceB = getRecipeSource(b) || 'Receta propia';
      return directionFactor * (compareText(sourceA, sourceB) || titleComparison);
    }

    if (recipeSort === 'dishType') {
      const dishA = (a.dishType || '').trim();
      const dishB = (b.dishType || '').trim();
      // Recetas sin tipo de plato siempre al final.
      if (!dishA && dishB) return 1;
      if (dishA && !dishB) return -1;
      return directionFactor * (compareText(dishA, dishB) || titleComparison);
    }

    if (recipeSort === 'difficulty') {
      const difficultyOrder: Record<string, number> = {
        'Facil': 0,
        'Fácil': 0,
        'Medio': 1,
        'Dificil': 2,
        'Difícil': 2
      };
      const difficultyA = difficultyOrder[a.difficulty || ''] ?? 3;
      const difficultyB = difficultyOrder[b.difficulty || ''] ?? 3;
      return directionFactor * ((difficultyA - difficultyB) || titleComparison);
    }

    if (recipeSort === 'prepTime') {
      const prepTimeA = a.prepTime && a.prepTime > 0 ? a.prepTime : Number.POSITIVE_INFINITY;
      const prepTimeB = b.prepTime && b.prepTime > 0 ? b.prepTime : Number.POSITIVE_INFINITY;
      return directionFactor * ((prepTimeA - prepTimeB) || titleComparison);
    }

    if (recipeSort === 'totalTime') {
      const totalTimeA = a.cookTime || 0;
      const totalTimeB = b.cookTime || 0;
      const comparableTotalA = totalTimeA > 0 ? totalTimeA : Number.POSITIVE_INFINITY;
      const comparableTotalB = totalTimeB > 0 ? totalTimeB : Number.POSITIVE_INFINITY;
      return directionFactor * ((comparableTotalA - comparableTotalB) || titleComparison);
    }

    if (recipeSort === 'date') {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return directionFactor * ((dateA - dateB) || titleComparison);
    }

    return directionFactor * titleComparison;
  }) : [];

  // Get displayed recipes (for pagination)
  const filteredRecipes = allFilteredRecipes.slice(0, displayedCount);
  const selectedRecipeIndex = selectedRecipe
    ? allFilteredRecipes.findIndex(recipe => recipe.id === selectedRecipe.id)
    : -1;

  // Load recipes function (extracted for reuse)
  const loadRecipes = async () => {
    if (!user) return;

    try {
      setIsLoadingRecipes(true);
      const [userRecipes, collections] = await Promise.all([
        api.recipes.getAll(),
        api.collections.getAll(),
      ]);
      setRecipes(userRecipes);
      setCollections(collections);
      setCollectionRecipeIds(new Set(collections.flatMap(collection => collection.recipeIds)));
    } catch (error) {
      console.error('Error loading recipes:', error);
      toast({
        title: "Error al cargar recetas",
        description: "No se pudieron cargar las recetas",
        variant: "destructive"
      });
    } finally {
      setIsLoadingRecipes(false);
    }
  };

  // Load recipes when user is available
  useEffect(() => {
    loadRecipes();
  }, [user, toast]);

  // Mostrar/ocultar el boton "volver arriba" segun el scroll.
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Scroll infinite loading effect
  useEffect(() => {
    if (!user) return; // Skip if not logged in

    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop >=
        document.documentElement.offsetHeight - 1000 && // Load more when 1000px from bottom
        !isLoadingMore &&
        displayedCount < allFilteredRecipes.length
      ) {
        setIsLoadingMore(true);

        // Simulate loading delay
        setTimeout(() => {
          setDisplayedCount(prev => Math.min(prev + 24, allFilteredRecipes.length));
          setIsLoadingMore(false);
        }, 500);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [user, allFilteredRecipes.length, displayedCount, isLoadingMore]);

  // Cerrar el cajon lateral (mobile/iPad) cuando el usuario navega a una seccion/filtro.
  useEffect(() => {
    setShowMobileSidebar(false);
  }, [filters, showCollectionsGallery, showCategoriesGallery, showSourcesGallery, showDishTypesGallery, showTagsGallery, showAuthorsGallery]);

  // Reset displayed count when filters change
  useEffect(() => {
    if (!user) return; // Skip if not logged in
    setDisplayedCount(24);
  }, [user, searchTerm, searchTerms, filters, recipeSort, sortDirection]);

  // If user is not logged in, show auth page
  if (!user) {
    return <AuthPage />;
  }

  const handleViewRecipe = (recipe: Recipe) => {
    saveRecentRecipe(recipe.id);
    setSelectedRecipe(recipe);
  };

  const handleCloseModal = () => {
    // Cleanup TTS states when closing modal
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setPlayingRecipeId(null);
    setPausedRecipeId(null);
    setGeneratingScript(null);
    setSelectedRecipe(null);
  };

  const handleAddRecipe = () => {
    setShowCreateModal(true);
  };

  const handleImportRecipe = () => {
    setShowImportModal(true);
  };

  const handleImportSuccess = (recipe: Recipe) => {
    // Add the imported recipe to the local state
    setRecipes(prev => [recipe, ...prev]);
    // Hide hero to show the recipes list
    setShowHero(false);
    // Clear any active filters to show all recipes including the new one
    setFilters(prev => ({
      difficulty: prev.difficulty || [],
      prepTimeRange: prev.prepTimeRange || [0, 180],
      recipeTypes: prev.recipeTypes || [],
      tags: prev.tags || [],
      ingredients: prev.ingredients || [],
      featured: undefined,
      thermomixOnly: prev.thermomixOnly
    }));
    toast({
      title: "Receta importada exitosamente!",
      description: `"${recipe.title}" ha sido anadida a tu coleccion`,
    });
  };

  const handleRecipeCreated = (recipe: Recipe) => {
    console.log('handleRecipeCreated called with recipe:', recipe.title);
    // Add the new recipe to the local state
    setRecipes(prev => {
      console.log('Adding new recipe to recipes list');
      return [recipe, ...prev];
    });
    // Hide hero to show the recipes list
    console.log('Hiding hero to show recipes list');
    setShowHero(false);
    // Clear any active filters to show all recipes including the new one
    console.log('Clearing featured filter');
    setFilters(prev => ({
      difficulty: prev.difficulty || [],
      prepTimeRange: prev.prepTimeRange || [0, 180],
      recipeTypes: prev.recipeTypes || [],
      tags: prev.tags || [],
      ingredients: prev.ingredients || [],
      featured: undefined,
      thermomixOnly: prev.thermomixOnly
    }));
    console.log('Showing recipe created toast');
    toast({
      title: "Receta creada exitosamente!",
      description: `"${recipe.title}" ha sido guardada en tu coleccion`,
    });
    console.log('handleRecipeCreated completed');
  };

  const handleEditRecipe = (recipe: Recipe) => {
    setEditQueue([]);
    setEditQueueIndex(0);
    setRecipeToEdit(recipe);
    setShowEditModal(true);
  };

  // Activar/desactivar una caracteristica de la receta (favorita, cocinada, thermomix, etc.)
  // con update parcial y actualizacion optimista.
  const handleToggleFeature = async (recipe: Recipe, field: string, value: boolean) => {
    setRecipes(prev => prev.map(r => (r.id === recipe.id ? { ...r, [field]: value } : r)));
    setSelectedRecipe(prev => (prev?.id === recipe.id ? { ...prev, [field]: value } : prev));
    try {
      await api.recipes.bulkUpdate([recipe.id], { [field]: value });
    } catch (error) {
      // Revertir si falla.
      setRecipes(prev => prev.map(r => (r.id === recipe.id ? { ...r, [field]: !value } : r)));
      setSelectedRecipe(prev => (prev?.id === recipe.id ? { ...prev, [field]: !value } : prev));
      toast({ title: 'Error', description: 'No se pudo actualizar la caracteristica', variant: 'destructive' });
    }
  };

  // Guardado inline (vista 1 columna) de Tipo de comida, Categoria y Coleccion.
  const handleInlineSaveFields = async (
    recipeId: string,
    data: { source: string; dishType: string; recipeType: string; collectionIds: string[] }
  ) => {
    try {
      await api.recipes.bulkUpdate([recipeId], { source: data.source || undefined, dishType: data.dishType, recipeType: data.recipeType });
      if (data.source.trim()) {
        try { await api.sources.create(data.source.trim()); } catch { /* no bloquear */ }
      }
      // Colecciones: agregar/quitar segun la diferencia con la pertenencia actual.
      const current = collections.filter(c => c.recipeIds.includes(recipeId)).map(c => c.id);
      const toAdd = data.collectionIds.filter(id => !current.includes(id));
      const toRemove = current.filter(id => !data.collectionIds.includes(id));
      for (const cid of toAdd) { try { await api.collections.addRecipe(cid, recipeId); } catch { /* no bloquear */ } }
      for (const cid of toRemove) { try { await api.collections.removeRecipe(cid, recipeId); } catch { /* no bloquear */ } }
      await Promise.all([loadRecipes(), reloadSources()]);
      toast({ title: 'Receta actualizada', description: 'Se guardaron los campos.' });
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'No se pudo guardar', variant: 'destructive' });
    }
  };

  // Abre las recetas recien importadas (por sus IDs) en modo edicion, una tras otra.
  const handleEditImportedRecipes = async (recipeIds: string[]) => {
    if (recipeIds.length === 0) return;
    try {
      const all = await api.recipes.getAll();
      const byId = new Map(all.map(r => [r.id, r]));
      const queue = recipeIds.map(id => byId.get(id)).filter(Boolean) as Recipe[];
      if (queue.length === 0) return;
      setEditQueue(queue);
      setEditQueueIndex(0);
      setRecipeToEdit(queue[0]);
      setShowEditModal(true);
    } catch (error) {
      console.error('Error preparing recipes to edit:', error);
    }
  };

  // Cierra el modal de edicion y limpia la cola.
  const closeEditModal = () => {
    setShowEditModal(false);
    setEditQueue([]);
    setEditQueueIndex(0);
    setRecipeToEdit(null);
  };

  // Avanza a la siguiente receta de la cola; si no hay mas, cierra el modal.
  const goToNextQueuedRecipe = () => {
    const next = editQueueIndex + 1;
    if (next >= editQueue.length) {
      closeEditModal();
      return;
    }
    setEditQueueIndex(next);
    setRecipeToEdit(editQueue[next]);
  };

  const handleRecipeUpdated = (updatedRecipe: Recipe) => {
    console.log('handleRecipeUpdated called with recipe:', updatedRecipe.title);
    // Update the recipe in the local state
    setRecipes(prev => {
      console.log('Updating recipe in recipes list');
      return prev.map(recipe =>
        recipe.id === updatedRecipe.id ? updatedRecipe : recipe
      );
    });
    // Keep the open detail modal synchronized with the same server response.
    setSelectedRecipe(prev =>
      prev?.id === updatedRecipe.id ? updatedRecipe : prev
    );
    // Mantener el editor abierto sincronizado: refrescar la receta en edicion con la
    // respuesta del servidor (deja el form "limpio" -> el boton vuelve a "Ver receta").
    setRecipeToEdit(prev =>
      prev && prev.id === updatedRecipe.id ? updatedRecipe : prev
    );
    console.log('Showing recipe updated toast');
    toast({
      title: "Receta actualizada!",
      description: `"${updatedRecipe.title}" se ha actualizado exitosamente`,
    });
    console.log('handleRecipeUpdated completed');
  };

  const handleCollectionsUpdated = (updatedCollections: RecipeCollection[]) => {
    setCollections(updatedCollections);
    setCollectionRecipeIds(
      new Set(updatedCollections.flatMap(collection => collection.recipeIds))
    );
  };

  const handleCreateCollection = async (name: string, cover?: { file?: File | null; url?: string | null }) => {
    try {
      let created = await api.collections.create(name);
      let coverImage: string | null = null;
      if (cover?.file) {
        const result = await api.upload.images([cover.file]);
        coverImage = result?.images?.[0]?.url || null;
      } else if (cover?.url) {
        coverImage = cover.url;
      }
      if (coverImage) {
        const updated = await api.collections.update(created.id, { coverImage });
        created = { ...created, coverImage: updated.coverImage };
      }
      setCollections(prev => [...prev, created]);
      toast({ title: "Coleccion creada", description: `Se creo "${created.name}".` });
    } catch (error) {
      toast({
        title: "No se pudo crear la coleccion",
        description: error instanceof Error ? error.message : "Intenta nuevamente",
        variant: "destructive",
      });
    }
  };

  // Limpiar el estado del dialogo "Nueva coleccion".
  const resetNewCollectionDialog = () => {
    setNewCollectionName('');
    setNewCollectionCoverFile(null);
    setNewCollectionCoverUrl(null);
    setNewCollectionCoverPreview(prev => { if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev); return null; });
  };

  // Establecer la portada desde un archivo de la PC.
  const setNewCollectionCoverFromFile = (file: File) => {
    setNewCollectionCoverUrl(null);
    setNewCollectionCoverFile(file);
    setNewCollectionCoverPreview(prev => { if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev); return URL.createObjectURL(file); });
  };

  // Establecer la portada desde una URL de la web (se descarga y optimiza en el server).
  const addNewCollectionCoverFromUrl = async (rawUrl: string) => {
    const url = (rawUrl || '').trim();
    if (!/^httpsi:\/\//i.test(url)) {
      toast({ title: 'URL no valida', description: 'Pega el enlace de una imagen (http...).', variant: 'destructive' });
      return;
    }
    setNewCollectionCoverLoading(true);
    try {
      const res = await api.upload.fromUrl(url);
      setNewCollectionCoverFile(null);
      setNewCollectionCoverUrl(res.image.url);
      setNewCollectionCoverPreview(prev => { if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev); return resolveImageUrl(res.image.url) || res.image.url; });
      toast({ title: 'Portada agregada desde la web' });
    } catch (error) {
      toast({ title: 'No se pudo agregar la imagen', description: error instanceof Error ? error.message : 'Intenta con otra URL', variant: 'destructive' });
    } finally {
      setNewCollectionCoverLoading(false);
    }
  };

  const clearNewCollectionCover = () => {
    setNewCollectionCoverFile(null);
    setNewCollectionCoverUrl(null);
    setNewCollectionCoverPreview(prev => { if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev); return null; });
  };

  // Crear la coleccion con el nombre y la portada elegidos en el dialogo.
  const submitNewCollection = async () => {
    const name = newCollectionName.trim();
    if (!name || creatingCollection) return;
    setCreatingCollection(true);
    await handleCreateCollection(name, { file: newCollectionCoverFile, url: newCollectionCoverUrl });
    setCreatingCollection(false);
    setShowNewCollectionDialog(false);
    resetNewCollectionDialog();
  };

  // --- Dialogo "Nuevo tipo de comida" (con portada, igual que nueva coleccion) ---
  const resetNewDishTypeDialog = () => {
    setNewDishTypeName('');
    setNewDishTypeCoverFile(null);
    setNewDishTypeCoverUrl(null);
    setNewDishTypeCoverPreview(prev => { if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev); return null; });
  };
  const setNewDishTypeCoverFromFile = (file: File) => {
    setNewDishTypeCoverUrl(null);
    setNewDishTypeCoverFile(file);
    setNewDishTypeCoverPreview(prev => { if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev); return URL.createObjectURL(file); });
  };
  const addNewDishTypeCoverFromUrl = async (rawUrl: string) => {
    const url = (rawUrl || '').trim();
    if (!/^httpsi:\/\//i.test(url)) {
      toast({ title: 'URL no valida', description: 'Pega el enlace de una imagen (http...).', variant: 'destructive' });
      return;
    }
    setNewDishTypeCoverLoading(true);
    try {
      const res = await api.upload.fromUrl(url);
      setNewDishTypeCoverFile(null);
      setNewDishTypeCoverUrl(res.image.url);
      setNewDishTypeCoverPreview(prev => { if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev); return resolveImageUrl(res.image.url) || res.image.url; });
      toast({ title: 'Portada agregada desde la web' });
    } catch (error) {
      toast({ title: 'No se pudo agregar la imagen', description: error instanceof Error ? error.message : 'Intenta con otra URL', variant: 'destructive' });
    } finally {
      setNewDishTypeCoverLoading(false);
    }
  };
  const clearNewDishTypeCover = () => {
    setNewDishTypeCoverFile(null);
    setNewDishTypeCoverUrl(null);
    setNewDishTypeCoverPreview(prev => { if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev); return null; });
  };
  const submitNewDishType = async () => {
    const name = newDishTypeName.trim();
    if (!name || creatingDishType) return;
    setCreatingDishType(true);
    await handleCreateDishType(name, { file: newDishTypeCoverFile, url: newDishTypeCoverUrl });
    setCreatingDishType(false);
    setShowNewDishTypeDialog(false);
    resetNewDishTypeDialog();
  };

  // --- Dialogo "Cambiar portada" de una coleccion existente ---
  const openChangeCoverDialog = (collection: RecipeCollection) => {
    setChangeCoverCollection(collection);
    setChangeCoverFile(null);
    setChangeCoverUrl(null);
    setChangeCoverPreview(resolveImageUrl(collection.coverImage) || null);
  };

  const closeChangeCoverDialog = () => {
    setChangeCoverPreview(prev => { if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev); return null; });
    setChangeCoverCollection(null);
    setChangeCoverFile(null);
    setChangeCoverUrl(null);
  };

  const setChangeCoverFromFile = (file: File) => {
    setChangeCoverUrl(null);
    setChangeCoverFile(file);
    setChangeCoverPreview(prev => { if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev); return URL.createObjectURL(file); });
  };

  const addChangeCoverFromUrl = async (rawUrl: string) => {
    const url = (rawUrl || '').trim();
    if (!/^httpsi:\/\//i.test(url)) {
      toast({ title: 'URL no valida', description: 'Pega el enlace de una imagen (http...).', variant: 'destructive' });
      return;
    }
    setChangeCoverLoading(true);
    try {
      const res = await api.upload.fromUrl(url);
      setChangeCoverFile(null);
      setChangeCoverUrl(res.image.url);
      setChangeCoverPreview(prev => { if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev); return resolveImageUrl(res.image.url) || res.image.url; });
      toast({ title: 'Portada agregada desde la web' });
    } catch (error) {
      toast({ title: 'No se pudo agregar la imagen', description: error instanceof Error ? error.message : 'Intenta con otra URL', variant: 'destructive' });
    } finally {
      setChangeCoverLoading(false);
    }
  };

  const clearChangeCover = () => {
    setChangeCoverFile(null);
    setChangeCoverUrl(null);
    setChangeCoverPreview(prev => { if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev); return null; });
  };

  // Guardar la nueva portada de la coleccion.
  const submitChangeCover = async () => {
    if (!changeCoverCollection || changeCoverSaving) return;
    const id = changeCoverCollection.id;
    setChangeCoverSaving(true);
    try {
      if (changeCoverFile) {
        await handleChangeCollectionCover(id, changeCoverFile);
      } else if (changeCoverUrl) {
        const updated = await api.collections.update(id, { coverImage: changeCoverUrl });
        setCollections(prev => prev.map(col => (col.id === id ? { ...col, coverImage: updated.coverImage } : col)));
        toast({ title: 'Portada actualizada' });
      } else {
        // Sin imagen elegida: quitar la portada actual.
        const updated = await api.collections.update(id, { coverImage: null });
        setCollections(prev => prev.map(col => (col.id === id ? { ...col, coverImage: updated.coverImage } : col)));
        toast({ title: 'Portada quitada' });
      }
      closeChangeCoverDialog();
    } catch (error) {
      toast({ title: 'No se pudo cambiar la portada', description: error instanceof Error ? error.message : 'Intenta nuevamente', variant: 'destructive' });
    } finally {
      setChangeCoverSaving(false);
    }
  };

  // Cambiar la portada de una coleccion subiendo una imagen desde la PC.
  const handleChangeCollectionCover = async (id: string, file: File) => {
    try {
      const result = await api.upload.images([file]);
      const url = result?.images?.[0]?.url;
      if (!url) throw new Error('No se pudo subir la imagen');
      const updated = await api.collections.update(id, { coverImage: url });
      setCollections(prev => prev.map(col => (col.id === id ? { ...col, coverImage: updated.coverImage } : col)));
      toast({ title: "Portada actualizada", description: `Se cambi? la portada de "${updated.name}".` });
    } catch (error) {
      toast({
        title: "No se pudo cambiar la portada",
        description: error instanceof Error ? error.message : "Intenta nuevamente",
        variant: "destructive",
      });
    }
  };

  // Eliminar una coleccion (las recetas se mantienen).
  const openEditCollectionDialog = (collection: RecipeCollection) => {
    setEditCollectionTarget(collection);
    setEditCollectionName(collection.name);
  };

  const submitEditCollection = async () => {
    if (!editCollectionTarget || editingCollection) return;

    const name = editCollectionName.trim();
    if (!name) {
      toast({ title: "Nombre requerido", description: "Ingresa un nombre para la coleccion.", variant: "destructive" });
      return;
    }

    setEditingCollection(true);
    try {
      const updated = await api.collections.update(editCollectionTarget.id, { name });
      setCollections(prev => prev.map(col => (col.id === updated.id ? { ...col, name: updated.name, updatedAt: updated.updatedAt } : col)));
      setEditCollectionTarget(null);
      setEditCollectionName('');
      toast({ title: "Coleccion actualizada", description: `Se renombro a "${updated.name}".` });
    } catch (error) {
      toast({
        title: "No se pudo editar la coleccion",
        description: error instanceof Error ? error.message : "Intenta nuevamente",
        variant: "destructive",
      });
    } finally {
      setEditingCollection(false);
    }
  };

  const openEditGalleryDialog = (target: EditableGalleryTarget) => {
    setEditGalleryTarget(target);
    setEditGalleryName(target.name);
  };

  const sameName = (left?: string | null, right?: string | null) =>
    (left || '').trim().toLocaleLowerCase() === (right || '').trim().toLocaleLowerCase();

  const replaceNameInList = (values: string[], oldName: string, newName: string) => {
    const seen = new Set<string>();
    return values
      .map(value => (sameName(value, oldName) ? newName : value))
      .map(value => value.trim())
      .filter(Boolean)
      .filter(value => {
        const key = value.toLocaleLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  };

  const submitEditGallery = async () => {
    if (!editGalleryTarget || editingGallery) return;

    const oldName = editGalleryTarget.name;
    const newName = editGalleryName.trim();
    if (!newName) {
      toast({ title: "Nombre requerido", description: `Ingresa un nombre para la ${EDITABLE_GALLERY_LABELS[editGalleryTarget.kind]}.`, variant: "destructive" });
      return;
    }

    if (sameName(oldName, newName)) {
      setEditGalleryTarget(null);
      setEditGalleryName('');
      return;
    }

    setEditingGallery(true);
    try {
      if (editGalleryTarget.kind === 'category') {
        await api.categories.create(newName);
        if (editGalleryTarget.cover) await api.categories.updateCover(newName, editGalleryTarget.cover);
        const affected = recipes.filter(recipe => parseCategories(recipe.recipeType).some(category => sameName(category, oldName)));
        await Promise.all(affected.map(recipe => api.recipes.update(recipe.id, {
          recipeType: replaceNameInList(parseCategories(recipe.recipeType), oldName, newName).join('|'),
        })));
        await api.categories.remove(oldName);
        if (filters.recipeTypes?.some(value => sameName(value, oldName))) {
          handleFiltersChange({ ...filters, recipeTypes: replaceNameInList(filters.recipeTypes, oldName, newName) });
        }
        await Promise.all([reloadCategories(), loadRecipes()]);
      } else if (editGalleryTarget.kind === 'dishType') {
        await api.dishTypes.create(newName);
        if (editGalleryTarget.cover) await api.dishTypes.updateCover(newName, editGalleryTarget.cover);
        const affected = recipes.filter(recipe => sameName(recipe.dishType, oldName));
        await Promise.all(affected.map(recipe => api.recipes.update(recipe.id, { dishType: newName })));
        await api.dishTypes.remove(oldName);
        if (sameName(filters.dishType, oldName) || filters.dishTypes?.some(value => sameName(value, oldName))) {
          handleFiltersChange({
            ...filters,
            dishType: sameName(filters.dishType, oldName) ? newName : filters.dishType,
            dishTypes: filters.dishTypes ? replaceNameInList(filters.dishTypes, oldName, newName) : filters.dishTypes,
          });
        }
        await Promise.all([reloadDishTypes(), loadRecipes()]);
      } else if (editGalleryTarget.kind === 'source') {
        await api.sources.update(oldName, {
          name: newName,
          coverImage: editGalleryTarget.cover || undefined,
        });
        if (filters.sources?.some(value => sameName(value, oldName))) {
          handleFiltersChange({ ...filters, sources: replaceNameInList(filters.sources, oldName, newName) });
        }
        await Promise.all([reloadSources(), loadRecipes()]);
      } else {
        await api.tags.create(newName);
        if (editGalleryTarget.cover) await api.tags.updateCover(newName, editGalleryTarget.cover);
        const affected = recipes.filter(recipe => (recipe.tags || []).some(tag => sameName(tag, oldName)));
        await Promise.all(affected.map(recipe => api.recipes.update(recipe.id, {
          tags: replaceNameInList(recipe.tags || [], oldName, newName),
        })));
        await api.tags.remove(oldName);
        if (filters.tags?.some(value => sameName(value, oldName))) {
          handleFiltersChange({ ...filters, tags: replaceNameInList(filters.tags, oldName, newName) });
        }
        await Promise.all([reloadTags(), loadRecipes()]);
      }

      toast({ title: "Nombre actualizado", description: `Se renombro "${oldName}" a "${newName}".` });
      setEditGalleryTarget(null);
      setEditGalleryName('');
    } catch (error) {
      toast({
        title: "No se pudo editar",
        description: error instanceof Error ? error.message : "Intenta nuevamente",
        variant: "destructive",
      });
    } finally {
      setEditingGallery(false);
    }
  };

  const handleDeleteCollection = async (id: string) => {
    try {
      await api.collections.remove(id);
      setCollections(prev => prev.filter(col => col.id !== id));
      if (filters.collectionId === id) {
        handleFiltersChange({ ...filters, collectionId: undefined });
      }
      toast({ title: "Coleccion eliminada", description: "Las recetas siguen disponibles en tu lista." });
    } catch (error) {
      toast({
        title: "No se pudo eliminar la coleccion",
        description: error instanceof Error ? error.message : "Intenta nuevamente",
        variant: "destructive",
      });
    } finally {
      setDeleteCollectionTarget(null);
    }
  };

  // Eliminar varias colecciones seleccionadas (las recetas se mantienen).
  const handleBulkDeleteCollections = async () => {
    const ids = Array.from(selectedCollectionBulkIds);
    if (ids.length === 0) return;
    try {
      await Promise.all(ids.map(id => api.collections.remove(id)));
      setCollections(prev => prev.filter(col => !selectedCollectionBulkIds.has(col.id)));
      if (filters.collectionId && selectedCollectionBulkIds.has(filters.collectionId)) {
        handleFiltersChange({ ...filters, collectionId: undefined });
      }
      toast({
        title: ids.length > 1 ? `${ids.length} colecciones eliminadas` : "Coleccion eliminada",
        description: "Las recetas siguen disponibles en tu lista.",
      });
      setSelectedCollectionBulkIds(new Set());
    } catch (error) {
      toast({
        title: "No se pudieron eliminar las colecciones",
        description: error instanceof Error ? error.message : "Intenta nuevamente",
        variant: "destructive",
      });
    } finally {
      setBulkDeleteCollectionsOpen(false);
    }
  };

  // Cambiar la portada de un tipo de comida subiendo una imagen desde la PC.
  const handleChangeDishTypeCover = async (name: string, file: File) => {
    try {
      const result = await api.upload.images([file]);
      const url = result?.images?.[0]?.url;
      if (!url) throw new Error('No se pudo subir la imagen');
      await api.dishTypes.updateCover(name, url);
      await reloadDishTypes();
      toast({ title: "Portada actualizada", description: `Se cambi? la portada de "${name}".` });
    } catch (error) {
      toast({
        title: "No se pudo cambiar la portada",
        description: error instanceof Error ? error.message : "Intenta nuevamente",
        variant: "destructive",
      });
    }
  };

  // Eliminar un tipo de comida (las recetas se mantienen, pierden la etiqueta).
  const handleDeleteDishType = async (name: string) => {
    setDeleteDishTypeTarget(null); // cerrar el dialogo de inmediato
    if (filters.dishType === name || filters.dishTypes?.includes(name)) {
      handleFiltersChange({ ...filters, dishType: filters.dishType === name ? undefined : filters.dishType, dishTypes: (filters.dishTypes || []).filter(t => t !== name) });
    }
    try {
      await api.dishTypes.remove(name);
      await Promise.all([reloadDishTypes(), loadRecipes()]);
      toast({ title: "Tipo de comida eliminado", description: "Las recetas siguen disponibles en tu lista." });
    } catch (error) {
      toast({
        title: "No se pudo eliminar el tipo de comida",
        description: error instanceof Error ? error.message : "Intenta nuevamente",
        variant: "destructive",
      });
    }
  };

  // --- Categorias: portada y eliminacion ---
  const handleChangeCategoryCover = async (name: string, file: File) => {
    try {
      const result = await api.upload.images([file]);
      const url = result?.images?.[0]?.url;
      if (!url) throw new Error('No se pudo subir la imagen');
      await api.categories.updateCover(name, url);
      await reloadCategories();
      toast({ title: "Portada actualizada", description: `Se cambi? la portada de "${name}".` });
    } catch (error) {
      toast({ title: "No se pudo cambiar la portada", description: error instanceof Error ? error.message : "Intenta nuevamente", variant: "destructive" });
    }
  };

  const handleDeleteCategory = async (name: string) => {
    setDeleteCategoryTarget(null); // cerrar el dialogo de inmediato
    if (filters.recipeTypes?.includes(name)) {
      handleFiltersChange({ ...filters, recipeTypes: filters.recipeTypes.filter(t => t !== name) });
    }
    try {
      await api.categories.remove(name);
      await Promise.all([reloadCategories(), loadRecipes()]);
      toast({ title: "Categoria eliminada", description: "Las recetas siguen disponibles en tu lista." });
    } catch (error) {
      toast({ title: "No se pudo eliminar la categoria", description: error instanceof Error ? error.message : "Intenta nuevamente", variant: "destructive" });
    }
  };

  // --- Fuentes: portada y eliminacion ---
  const handleChangeSourceCover = async (name: string, file: File) => {
    try {
      const result = await api.upload.images([file]);
      const url = result?.images?.[0]?.url;
      if (!url) throw new Error('No se pudo subir la imagen');
      await api.sources.updateCover(name, url);
      await reloadSources();
      toast({ title: "Portada actualizada", description: `Se cambi? la portada de "${name}".` });
    } catch (error) {
      toast({ title: "No se pudo cambiar la portada", description: error instanceof Error ? error.message : "Intenta nuevamente", variant: "destructive" });
    }
  };

  const handleDeleteSource = async (name: string) => {
    setDeleteSourceTarget(null); // cerrar el dialogo de inmediato
    if (filters.sources?.includes(name)) {
      const remaining = filters.sources.filter(s => s !== name);
      handleFiltersChange({ ...filters, sources: remaining.length ? remaining : undefined });
    }
    try {
      await api.sources.remove(name);
      await Promise.all([reloadSources(), loadRecipes()]);
      toast({ title: "Fuente eliminada", description: "Las recetas siguen disponibles en tu lista." });
    } catch (error) {
      toast({ title: "No se pudo eliminar la fuente", description: error instanceof Error ? error.message : "Intenta nuevamente", variant: "destructive" });
    }
  };

  // --- Etiquetas: portada y eliminacion ---
  const handleChangeTagCover = async (name: string, file: File) => {
    try {
      const result = await api.upload.images([file]);
      const url = result?.images?.[0]?.url;
      if (!url) throw new Error('No se pudo subir la imagen');
      await api.tags.updateCover(name, url);
      await reloadTags();
      toast({ title: "Portada actualizada", description: `Se cambi? la portada de "${name}".` });
    } catch (error) {
      toast({ title: "No se pudo cambiar la portada", description: error instanceof Error ? error.message : "Intenta nuevamente", variant: "destructive" });
    }
  };

  const handleDeleteTag = async (name: string) => {
    setDeleteTagTarget(null);
    if (filters.tags?.includes(name)) {
      handleFiltersChange({ ...filters, tags: filters.tags.filter(t => t !== name) });
    }
    try {
      await api.tags.remove(name);
      await Promise.all([reloadTags(), loadRecipes()]);
      toast({ title: "Etiqueta eliminada", description: "Las recetas siguen disponibles en tu lista." });
    } catch (error) {
      toast({ title: "No se pudo eliminar la etiqueta", description: error instanceof Error ? error.message : "Intenta nuevamente", variant: "destructive" });
    }
  };

  // --- Autores: portada y eliminacion ---
  const handleChangeAuthorCover = async (name: string, file: File) => {
    try {
      const result = await api.upload.images([file]);
      const url = result?.images?.[0]?.url;
      if (!url) throw new Error('No se pudo subir la imagen');
      await api.authors.updateCover(name, url);
      await reloadAuthors();
      toast({ title: "Portada actualizada", description: `Se cambi? la portada de "${name}".` });
    } catch (error) {
      toast({ title: "No se pudo cambiar la portada", description: error instanceof Error ? error.message : "Intenta nuevamente", variant: "destructive" });
    }
  };

  const handleDeleteAuthor = async (name: string) => {
    setDeleteAuthorTarget(null); // cerrar el dialogo de inmediato
    if (filters.author === name) {
      handleFiltersChange({ ...filters, author: undefined });
    }
    try {
      await api.authors.remove(name);
      await Promise.all([reloadAuthors(), loadRecipes()]);
      toast({ title: "Autor eliminado", description: "Las recetas siguen disponibles en tu lista." });
    } catch (error) {
      toast({ title: "No se pudo eliminar el autor", description: error instanceof Error ? error.message : "Intenta nuevamente", variant: "destructive" });
    }
  };

  const handleCreateCategory = async (name: string, cover?: { file?: File | null; url?: string | null }) => {
    try {
      await createCategory(name);
      let coverImage: string | null = null;
      if (cover?.file) {
        const result = await api.upload.images([cover.file]);
        coverImage = result?.images?.[0]?.url || null;
      } else if (cover?.url) {
        coverImage = cover.url;
      }
      if (coverImage) {
        await api.categories.updateCover(name.trim(), coverImage);
        await reloadCategories();
      }
      toast({
        title: "Categoria creada",
        description: `Se cre? "${name}". Asignala a una receta para que aparezca en la lista.`,
      });
    } catch (error) {
      toast({
        title: "No se pudo crear la categoria",
        description: error instanceof Error ? error.message : "Intenta nuevamente",
        variant: "destructive",
      });
    }
  };

  // --- Dialogo "Nueva categoria" (con portada, igual que nuevo tipo de comida) ---
  const resetNewCategoryDialog = () => {
    setNewCategoryName('');
    setNewCategoryCoverFile(null);
    setNewCategoryCoverUrl(null);
    setNewCategoryCoverPreview(prev => { if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev); return null; });
  };
  const setNewCategoryCoverFromFile = (file: File) => {
    setNewCategoryCoverUrl(null);
    setNewCategoryCoverFile(file);
    setNewCategoryCoverPreview(prev => { if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev); return URL.createObjectURL(file); });
  };
  const addNewCategoryCoverFromUrl = async (rawUrl: string) => {
    const url = (rawUrl || '').trim();
    if (!/^httpsi:\/\//i.test(url)) {
      toast({ title: 'URL no valida', description: 'Pega el enlace de una imagen (http...).', variant: 'destructive' });
      return;
    }
    setNewCategoryCoverLoading(true);
    try {
      const res = await api.upload.fromUrl(url);
      setNewCategoryCoverFile(null);
      setNewCategoryCoverUrl(res.image.url);
      setNewCategoryCoverPreview(prev => { if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev); return resolveImageUrl(res.image.url) || res.image.url; });
      toast({ title: 'Portada agregada desde la web' });
    } catch (error) {
      toast({ title: 'No se pudo agregar la imagen', description: error instanceof Error ? error.message : 'Intenta con otra URL', variant: 'destructive' });
    } finally {
      setNewCategoryCoverLoading(false);
    }
  };
  const clearNewCategoryCover = () => {
    setNewCategoryCoverFile(null);
    setNewCategoryCoverUrl(null);
    setNewCategoryCoverPreview(prev => { if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev); return null; });
  };
  const submitNewCategory = async () => {
    const name = newCategoryName.trim();
    if (!name || creatingCategory) return;
    setCreatingCategory(true);
    await handleCreateCategory(name, { file: newCategoryCoverFile, url: newCategoryCoverUrl });
    setCreatingCategory(false);
    setShowNewCategoryDialog(false);
    resetNewCategoryDialog();
  };

  const handleCreateDishType = async (name: string, cover?: { file?: File | null; url?: string | null }) => {
    try {
      await createDishType(name);
      let coverImage: string | null = null;
      if (cover?.file) {
        const result = await api.upload.images([cover.file]);
        coverImage = result?.images?.[0]?.url || null;
      } else if (cover?.url) {
        coverImage = cover.url;
      }
      if (coverImage) {
        await api.dishTypes.updateCover(name.trim(), coverImage);
        await reloadDishTypes();
      }
      toast({
        title: "Tipo de comida creado",
        description: `Se creo "${name}". Asignalo a una receta para que aparezca en la lista.`,
      });
    } catch (error) {
      toast({
        title: "No se pudo crear el tipo de comida",
        description: error instanceof Error ? error.message : "Intenta nuevamente",
        variant: "destructive",
      });
    }
  };

  const handleCreateSource = async (name: string, cover?: { file?: File | null; url?: string | null }) => {
    try {
      await createSource(name);
      let coverImage: string | null = null;
      if (cover?.file) {
        const result = await api.upload.images([cover.file]);
        coverImage = result?.images?.[0]?.url || null;
      } else if (cover?.url) {
        coverImage = cover.url;
      }
      if (coverImage) {
        await api.sources.updateCover(name.trim(), coverImage);
        await reloadSources();
      }
      toast({
        title: "Fuente creada",
        description: `Se cre? "${name}". Asignala a una receta para que aparezca en la lista.`,
      });
    } catch (error) {
      toast({
        title: "No se pudo crear la fuente",
        description: error instanceof Error ? error.message : "Intenta nuevamente",
        variant: "destructive",
      });
    }
  };

  // --- Dialogo "Nueva fuente" (con portada, igual que nueva categoria) ---
  const resetNewSourceDialog = () => {
    setNewSourceName('');
    setNewSourceCoverFile(null);
    setNewSourceCoverUrl(null);
    setNewSourceCoverPreview(prev => { if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev); return null; });
  };
  const setNewSourceCoverFromFile = (file: File) => {
    setNewSourceCoverUrl(null);
    setNewSourceCoverFile(file);
    setNewSourceCoverPreview(prev => { if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev); return URL.createObjectURL(file); });
  };
  const addNewSourceCoverFromUrl = async (rawUrl: string) => {
    const url = (rawUrl || '').trim();
    if (!/^httpsi:\/\//i.test(url)) {
      toast({ title: 'URL no valida', description: 'Pega el enlace de una imagen (http...).', variant: 'destructive' });
      return;
    }
    setNewSourceCoverLoading(true);
    try {
      const res = await api.upload.fromUrl(url);
      setNewSourceCoverFile(null);
      setNewSourceCoverUrl(res.image.url);
      setNewSourceCoverPreview(prev => { if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev); return resolveImageUrl(res.image.url) || res.image.url; });
      toast({ title: 'Portada agregada desde la web' });
    } catch (error) {
      toast({ title: 'No se pudo agregar la imagen', description: error instanceof Error ? error.message : 'Intenta con otra URL', variant: 'destructive' });
    } finally {
      setNewSourceCoverLoading(false);
    }
  };
  const clearNewSourceCover = () => {
    setNewSourceCoverFile(null);
    setNewSourceCoverUrl(null);
    setNewSourceCoverPreview(prev => { if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev); return null; });
  };
  const submitNewSource = async () => {
    const name = newSourceName.trim();
    if (!name || creatingSource) return;
    setCreatingSource(true);
    await handleCreateSource(name, { file: newSourceCoverFile, url: newSourceCoverUrl });
    setCreatingSource(false);
    setShowNewSourceDialog(false);
    resetNewSourceDialog();
  };

  const handleCreateTag = async (name: string, cover?: { file?: File | null; url?: string | null }) => {
    try {
      await createTag(name);
      let coverImage: string | null = null;
      if (cover?.file) {
        const result = await api.upload.images([cover.file]);
        coverImage = result?.images?.[0]?.url || null;
      } else if (cover?.url) {
        coverImage = cover.url;
      }
      if (coverImage) {
        await api.tags.updateCover(name.trim(), coverImage);
        await reloadTags();
      }
      toast({
        title: "Etiqueta creada",
        description: `Se cre? "${name}". Asignala a una receta para que aparezca en la lista.`,
      });
    } catch (error) {
      toast({
        title: "No se pudo crear la etiqueta",
        description: error instanceof Error ? error.message : "Intenta nuevamente",
        variant: "destructive",
      });
    }
  };

  // --- Dialogo "Nueva etiqueta" (con portada, igual que nueva fuente) ---
  const resetNewTagDialog = () => {
    setNewTagName('');
    setNewTagCoverFile(null);
    setNewTagCoverUrl(null);
    setNewTagCoverPreview(prev => { if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev); return null; });
  };
  const setNewTagCoverFromFile = (file: File) => {
    setNewTagCoverUrl(null);
    setNewTagCoverFile(file);
    setNewTagCoverPreview(prev => { if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev); return URL.createObjectURL(file); });
  };
  const addNewTagCoverFromUrl = async (rawUrl: string) => {
    const url = (rawUrl || '').trim();
    if (!/^httpsi:\/\//i.test(url)) {
      toast({ title: 'URL no valida', description: 'Pega el enlace de una imagen (http...).', variant: 'destructive' });
      return;
    }
    setNewTagCoverLoading(true);
    try {
      const res = await api.upload.fromUrl(url);
      setNewTagCoverFile(null);
      setNewTagCoverUrl(res.image.url);
      setNewTagCoverPreview(prev => { if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev); return resolveImageUrl(res.image.url) || res.image.url; });
      toast({ title: 'Portada agregada desde la web' });
    } catch (error) {
      toast({ title: 'No se pudo agregar la imagen', description: error instanceof Error ? error.message : 'Intenta con otra URL', variant: 'destructive' });
    } finally {
      setNewTagCoverLoading(false);
    }
  };
  const clearNewTagCover = () => {
    setNewTagCoverFile(null);
    setNewTagCoverUrl(null);
    setNewTagCoverPreview(prev => { if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev); return null; });
  };
  const submitNewTag = async () => {
    const name = newTagName.trim();
    if (!name || creatingTag) return;
    setCreatingTag(true);
    await handleCreateTag(name, { file: newTagCoverFile, url: newTagCoverUrl });
    setCreatingTag(false);
    setShowNewTagDialog(false);
    resetNewTagDialog();
  };

  const handleCreateAuthor = async (name: string) => {
    try {
      await createAuthor(name);
      toast({
        title: "Autor creado",
        description: `Se cre? "${name}". Asignalo a una receta para que aparezca en la lista.`,
      });
    } catch (error) {
      toast({
        title: "No se pudo crear el autor",
        description: error instanceof Error ? error.message : "Intenta nuevamente",
        variant: "destructive",
      });
    }
  };

  const handleDeleteRecipe = (recipe: Recipe) => {
    setRecipeToDelete(recipe);
    setShowDeleteDialog(true);
  };

  const handleShowNutrition = (recipe: Recipe) => {
    setNutritionRecipe(recipe);
    setShowNutritionModal(true);
  };

  const handleNutritionUpdate = (updatedRecipe: Recipe) => {
    // Update the recipe in the main recipes list
    setRecipes(prev => prev.map(recipe =>
      recipe.id === updatedRecipe.id ? updatedRecipe : recipe
    ));

    // Update the nutrition recipe state to reflect changes
    setNutritionRecipe(updatedRecipe);
  };

  const handleRecipeDeleted = (recipeId: string) => {
    // Remove the recipe from the local state
    setRecipes(prev => prev.filter(recipe => recipe.id !== recipeId));
    setSelectedRecipe(prev => prev?.id === recipeId ? null : prev);
    setRecipeToDelete(null);
  };

  const selectedActionRecipes = recipes.filter(recipe => selectedRecipeIds.has(recipe.id));

  const handleToggleRecipeSelection = (
    recipe: Recipe,
    modifiers: { shift?: boolean; ctrl?: boolean }
  ) => {
    const id = recipe.id;

    // SHIFT: seleccionar el rango consecutivo desde la ultima receta clickeada.
    if (modifiers?.shift && lastSelectedRecipeId.current) {
      const ids = filteredRecipes.map(r => r.id);
      const from = ids.indexOf(lastSelectedRecipeId.current);
      const to = ids.indexOf(id);
      if (from !== -1 && to !== -1) {
        const [start, end] = from < to ? [from, to] : [to, from];
        const rangeIds = ids.slice(start, end + 1);
        setSelectedRecipeIds(prev => {
          const next = new Set(prev);
          rangeIds.forEach(rid => next.add(rid));
          return next;
        });
        lastSelectedRecipeId.current = id;
        return;
      }
    }

    // CTRL o click normal: alternar individualmente (no consecutivas).
    setSelectedRecipeIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    lastSelectedRecipeId.current = id;
  };

  const handleToggleAllVisibleRecipes = () => {
    const visibleIds = filteredRecipes.map(recipe => recipe.id);
    const allVisibleSelected = visibleIds.length > 0
      && visibleIds.every(recipeId => selectedRecipeIds.has(recipeId));

    setSelectedRecipeIds(prev => {
      const next = new Set(prev);
      visibleIds.forEach(recipeId => {
        if (allVisibleSelected) {
          next.delete(recipeId);
        } else {
          next.add(recipeId);
        }
      });
      return next;
    });
  };

  // Selecciona/deselecciona TODAS las recetas que coinciden con los filtros actuales.
  const handleSelectAllRecipes = () => {
    const allIds = allFilteredRecipes.map(recipe => recipe.id);
    const allSelected = allIds.length > 0 && allIds.every(id => selectedRecipeIds.has(id));
    if (allSelected) {
      setSelectedRecipeIds(new Set());
    } else {
      setSelectedRecipeIds(new Set(allIds));
    }
  };

  // Imprime las recetas directamente (sin dialogo).
  const handleBulkPrint = async () => {
    if (!selectedActionRecipes.length) return;

    setBulkAction('print');
    try {
      await printRecipesPdf(selectedActionRecipes);
      toast({
        title: "PDF listo para imprimir",
        description: `Se combinaron ${selectedActionRecipes.length} receta${selectedActionRecipes.length > 1 ? "s" : ""} en un solo PDF.`,
      });
    } catch (error) {
      toast({
        title: "Error al imprimir",
        description: error instanceof Error ? error.message : "No se pudieron imprimir las recetas",
        variant: "destructive",
      });
    } finally {
      setBulkAction(null);
    }
  };

  // Abre el dialogo de tarjetas con los campos vacios.
  const handleBulkPrintCards = () => {
    if (!selectedActionRecipes.length) return;
    setPrintCardsTitle('');
    setPrintCardsHeader('');
    setPrintCardsFooter('');
    setPrintCardsPageNumber(false);
    setPrintCardsColumns(5);
    setPrintCardsFields({ image: true, title: true, source: false, collection: false, difficulty: false, dishType: false, category: false, times: false, icons: false });
    setPrintCardsDialogOpen(true);
  };

  // Imprime las tarjetas con el titulo y pie ingresados.
  const doPrintCards = async () => {
    setPrintCardsDialogOpen(false);
    if (!selectedActionRecipes.length) return;

    setBulkAction('print-cards');
    try {
      const recipesWithCollections = selectedActionRecipes.map(recipe => ({
        ...recipe,
        collectionNames: collections
          .filter(collection => collection.recipeIds.includes(recipe.id))
          .map(collection => collection.name),
      }));
      const fieldsForPrint = printCardsColumns >= 5
        ? { image: true, title: true, source: printCardsFields.source, collection: false, difficulty: false, dishType: false, category: false, times: false, icons: false }
        : printCardsFields;
      await printRecipeCards(recipesWithCollections, { title: printCardsTitle, header: printCardsHeader, footer: printCardsFooter, pageNumber: printCardsPageNumber, columns: printCardsColumns, fields: fieldsForPrint });
    } catch (error) {
      toast({
        title: "Error al imprimir tarjetas",
        description: error instanceof Error ? error.message : "No se pudieron imprimir las tarjetas",
        variant: "destructive",
      });
    } finally {
      setBulkAction(null);
    }
  };

  // Abre el dialogo de lista con los campos vacios.
  const handleBulkPrintList = () => {
    if (!selectedActionRecipes.length) return;
    setPrintListTitle('');
    setPrintListHeader('');
    setPrintListFooter('');
    setPrintListPageNumber(false);
    setPrintListVariant('list');
    setPrintListDialogOpen(true);
  };

  const doPrintList = async () => {
    setPrintListDialogOpen(false);
    if (!selectedActionRecipes.length) return;
    setBulkAction('print-list');
    try {
      await printRecipeList(selectedActionRecipes, { title: printListTitle, header: printListHeader, footer: printListFooter, pageNumber: printListPageNumber, variant: printListVariant });
    } catch (error) {
      toast({
        title: "Error al imprimir lista",
        description: error instanceof Error ? error.message : "No se pudo imprimir la lista",
        variant: "destructive",
      });
    } finally {
      setBulkAction(null);
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedActionRecipes.length) return;

    setBulkAction('delete');
    try {
      const results = await Promise.allSettled(
        selectedActionRecipes.map(recipe => api.recipes.delete(recipe.id))
      );
      const deletedIds = new Set(
        selectedActionRecipes
          .filter((_, index) => results[index].status === 'fulfilled')
          .map(recipe => recipe.id)
      );
      const failedIds = new Set(
        selectedActionRecipes
          .filter((_, index) => results[index].status === 'rejected')
          .map(recipe => recipe.id)
      );

      setRecipes(prev => prev.filter(recipe => !deletedIds.has(recipe.id)));
      setCollections(prev => prev.map(collection => {
        const recipeIds = collection.recipeIds.filter(recipeId => !deletedIds.has(recipeId));
        return {
          ...collection,
          recipeIds,
          recipeOrders: Object.fromEntries(
            Object.entries(collection.recipeOrders || {}).filter(([recipeId]) => !deletedIds.has(recipeId))
          ),
          recipeCount: recipeIds.length,
        };
      }));
      setCollectionRecipeIds(prev => {
        const next = new Set(prev);
        deletedIds.forEach(recipeId => next.delete(recipeId));
        return next;
      });
      setSelectedRecipeIds(failedIds);

      if (failedIds.size === 0) {
        setShowBulkDeleteDialog(false);
        toast({
          title: "Recetas eliminadas",
          description: `Se eliminaron ${deletedIds.size} receta${deletedIds.size > 1 ? "s" : ""}.`,
        });
      } else {
        toast({
          title: "Algunas recetas no se eliminaron",
          description: `Se eliminaron ${deletedIds.size} y quedaron ${failedIds.size} pendientes.`,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error al eliminar",
        description: error instanceof Error ? error.message : "No se pudieron eliminar las recetas",
        variant: "destructive",
      });
    } finally {
      setBulkAction(null);
    }
  };

  const handleToggleFavorite = async (recipe: Recipe) => {
    console.log('Starting handleToggleFavorite for recipe:', recipe.title, 'Current featured:', recipe.featured);

    try {
      // Optimistically update UI first
      const newFeaturedState = !recipe.featured;
      console.log('Optimistically updating UI, newFeaturedState:', newFeaturedState);

      setRecipes(prev => {
        const updated = prev.map(r =>
          r.id === recipe.id ? { ...r, featured: newFeaturedState } : r
        );
        console.log('Recipe state updated optimistically');
        return updated;
      });
      setSelectedRecipe(prev =>
        prev?.id === recipe.id ? { ...prev, featured: newFeaturedState } : prev
      );

      // Clean instructions to handle null values
      const cleanedInstructions = recipe.instructions.map(instruction => ({
        ...instruction,
        time: instruction.time || "",
        temperature: instruction.temperature || "",
        speed: instruction.speed || ""
      }));
      console.log('Instructions cleaned:', cleanedInstructions.length, 'instructions');

      // Clean tags to handle both string and object formats
      const cleanedTags = recipe.tags.map(tag => {
        if (typeof tag === 'string') {
          return { tag, tagId: tag }; // Convert string to object format
        }
        return tag; // Already an object
      });

      console.log('Calling API to update recipe...');
      const updatedRecipe = await api.recipes.update(recipe.id, {
        title: recipe.title,
        description: recipe.description,
        prepTime: recipe.prepTime,
        cookTime: recipe.cookTime,
        servings: recipe.servings,
        difficulty: recipe.difficulty,
        images: recipe.images,
        ingredients: recipe.ingredients,
        instructions: cleanedInstructions,
        tags: cleanedTags,
        sourceUrl: recipe.sourceUrl,
        recipeType: recipe.recipeType,
        featured: newFeaturedState
      });

      console.log('API call successful! Updated recipe featured state:', updatedRecipe.featured);

      // Update with the server response (in case of discrepancies)
      setRecipes(prev => {
        const final = prev.map(r =>
          r.id === recipe.id ? updatedRecipe : r
        );
        console.log('Final state update with server response');
        return final;
      });
      setSelectedRecipe(prev =>
        prev?.id === recipe.id ? updatedRecipe : prev
      );

      console.log('Showing success toast');
      toast({
        title: updatedRecipe.featured ? "Anadida a favoritos!" : "Eliminada de favoritos",
        description: `"${updatedRecipe.title}" ${updatedRecipe.featured ? 'se anadio a' : 'se elimino de'} tus favoritos`,
      });

      console.log('handleToggleFavorite completed successfully');
    } catch (error) {
      console.error('Error in handleToggleFavorite:', error);

      // Revert optimistic update on error
      console.log('Reverting optimistic update due to error');
      setRecipes(prev => prev.map(r =>
        r.id === recipe.id ? recipe : r
      ));
      setSelectedRecipe(prev =>
        prev?.id === recipe.id ? recipe : prev
      );

      console.log('Showing error toast');
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado de favorito",
        variant: "destructive"
      });
    }
  };

  const handleToggleCooked = async (recipe: Recipe) => {
    const newCookedState = !recipe.cooked;

    // Optimistically update UI first
    setRecipes(prev => prev.map(r =>
      r.id === recipe.id ? { ...r, cooked: newCookedState } : r
    ));
    setSelectedRecipe(prev =>
      prev?.id === recipe.id ? { ...prev, cooked: newCookedState } : prev
    );

    try {
      const cleanedInstructions = recipe.instructions.map(instruction => ({
        ...instruction,
        time: instruction.time || "",
        temperature: instruction.temperature || "",
        speed: instruction.speed || ""
      }));

      const cleanedTags = recipe.tags.map(tag =>
        typeof tag === 'string' ? { tag, tagId: tag } : tag
      );

      const updatedRecipe = await api.recipes.update(recipe.id, {
        title: recipe.title,
        description: recipe.description,
        prepTime: recipe.prepTime,
        cookTime: recipe.cookTime,
        servings: recipe.servings,
        difficulty: recipe.difficulty,
        images: recipe.images,
        ingredients: recipe.ingredients,
        instructions: cleanedInstructions,
        tags: cleanedTags,
        sourceUrl: recipe.sourceUrl,
        recipeType: recipe.recipeType,
        cooked: newCookedState
      });

      setRecipes(prev => prev.map(r =>
        r.id === recipe.id ? updatedRecipe : r
      ));
      setSelectedRecipe(prev =>
        prev?.id === recipe.id ? updatedRecipe : prev
      );

      toast({
        title: updatedRecipe.cooked ? "?Marcada como cocinada!" : "Marca de cocinada quitada",
        description: `"${updatedRecipe.title}" ${updatedRecipe.cooked ? 'se marca como cocinada' : 'ya no est? marcada como cocinada'}`,
      });
    } catch (error) {
      console.error('Error in handleToggleCooked:', error);

      // Revert optimistic update on error
      setRecipes(prev => prev.map(r =>
        r.id === recipe.id ? recipe : r
      ));
      setSelectedRecipe(prev =>
        prev?.id === recipe.id ? recipe : prev
      );

      toast({
        title: "Error",
        description: "No se pudo actualizar el estado de cocinada",
        variant: "destructive"
      });
    }
  };

  const handleGetStarted = () => {
    setShowHero(false);
    localStorage.setItem('hero-dismissed', 'true');
  };

  // Al hacer click en el logo: no hacer nada (app de una sola pagina).
  const handleLogoClick = () => {
    // Intencionalmente vacio.
  };

  const handleViewFeatured = () => {
    setShowHero(false);
    localStorage.setItem('hero-dismissed', 'true');
    // Filter to show only featured recipes
    setFilters(prev => ({
      difficulty: prev.difficulty || [],
      prepTimeRange: prev.prepTimeRange || [0, 180],
      recipeTypes: prev.recipeTypes || [],
      tags: prev.tags || [],
      ingredients: prev.ingredients || [],
      featured: true,
      thermomixOnly: prev.thermomixOnly
    }));
  };

  const handleFiltersChange = (newFilters: RecipeFilters) => {
    setFilters(newFilters);
  };

  // "Mis Recetas": mostrar todas las recetas (sin filtros) y ocultar el banner.
  const handleViewAll = () => {
    setShowHero(false);
    setShowCollectionsGallery(false);
    setShowCategoriesGallery(false);
    setShowSourcesGallery(false);
    setShowDishTypesGallery(false); setShowTagsGallery(false); setShowAuthorsGallery(false);
    localStorage.setItem('hero-dismissed', 'true');
    handleClearFilters();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const hasActiveFilters =
    filters.difficulty.length > 0
    || filters.recipeTypes.length > 0
    || filters.tags.length > 0
    || Boolean(filters.ingredients?.length)
    || (filters.prepTimeRange?.[0] ?? 0) > 0
    || (filters.prepTimeRange?.[1] ?? 180) < 180
    || (filters.cookTimeRange?.[0] ?? 0) > 0
    || (filters.cookTimeRange?.[1] ?? 120) < 120
    || filters.featured === true
    || filters.cookedOnly === true
    || filters.thermomixOnly === true
    || filters.airFryerOnly === true
    || filters.glutenFreeOnly === true
    || filters.sugarFreeOnly === true
    || filters.ketoOnly === true
    || filters.lowCarbOnly === true
    || filters.proteicaOnly === true
    || filters.vegetarianOnly === true
    || filters.sweetOnly === true
    || filters.savoryOnly === true
    || Boolean(filters.collectionId)
    || Boolean(filters.sources?.length)
    || Boolean(filters.dishType)
    || Boolean(filters.dishTypes?.length)
    || Boolean(filters.author);

  // Chips de filtros activos para mostrar en la barra "Recetas de Pauli".
  // Cada chip incluye onRemove para quitar solo ese filtro.
  const activeFilterChips: { label?: string; value: string; onRemove: () => void }[] = [];
  if (filters.collectionId) {
    activeFilterChips.push({ label: 'Coleccion', value: collections.find(c => c.id === filters.collectionId)?.name || '', onRemove: () => handleFiltersChange({ ...filters, collectionId: undefined }) });
  }
  const activeDishTypes = [...(filters.dishTypes || []), ...(filters.dishType ? [filters.dishType] : [])];
  if (activeDishTypes.length) activeFilterChips.push({ label: 'Tipo de comida', value: activeDishTypes.join(', '), onRemove: () => handleFiltersChange({ ...filters, dishTypes: [], dishType: undefined }) });
  if (filters.recipeTypes?.length) activeFilterChips.push({ label: 'Categoria', value: filters.recipeTypes.join(', '), onRemove: () => handleFiltersChange({ ...filters, recipeTypes: [] }) });
  if (filters.sources?.length) activeFilterChips.push({ label: 'Fuente', value: filters.sources.join(', '), onRemove: () => handleFiltersChange({ ...filters, sources: undefined }) });
  if (filters.tags?.length) activeFilterChips.push({ label: 'Etiquetas', value: filters.tags.join(', '), onRemove: () => handleFiltersChange({ ...filters, tags: [] }) });
  if (filters.ingredients?.length) activeFilterChips.push({ label: 'Ingredientes', value: filters.ingredients.join(', '), onRemove: () => handleFiltersChange({ ...filters, ingredients: [] }) });
  if (filters.author) activeFilterChips.push({ label: 'Autor', value: filters.author, onRemove: () => handleFiltersChange({ ...filters, author: undefined }) });
  if (filters.featured) activeFilterChips.push({ value: 'Favoritos', onRemove: () => handleFiltersChange({ ...filters, featured: undefined }) });
  if (filters.cookedOnly) activeFilterChips.push({ value: 'Cocinadas', onRemove: () => handleFiltersChange({ ...filters, cookedOnly: undefined }) });
  if (filters.thermomixOnly) activeFilterChips.push({ value: 'Thermomix', onRemove: () => handleFiltersChange({ ...filters, thermomixOnly: undefined }) });
  if (filters.airFryerOnly) activeFilterChips.push({ value: 'Air Fryer', onRemove: () => handleFiltersChange({ ...filters, airFryerOnly: undefined }) });
  if (filters.glutenFreeOnly) activeFilterChips.push({ value: 'Sin Gluten', onRemove: () => handleFiltersChange({ ...filters, glutenFreeOnly: undefined }) });
  if (filters.sugarFreeOnly) activeFilterChips.push({ value: 'Sin Azucar', onRemove: () => handleFiltersChange({ ...filters, sugarFreeOnly: undefined }) });
  if (filters.ketoOnly) activeFilterChips.push({ value: 'Keto', onRemove: () => handleFiltersChange({ ...filters, ketoOnly: undefined }) });
  if (filters.lowCarbOnly) activeFilterChips.push({ value: 'Low Carb', onRemove: () => handleFiltersChange({ ...filters, lowCarbOnly: undefined }) });
  if (filters.proteicaOnly) activeFilterChips.push({ value: 'Proteicas', onRemove: () => handleFiltersChange({ ...filters, proteicaOnly: undefined }) });
  if (filters.vegetarianOnly) activeFilterChips.push({ value: 'Vegetarianas', onRemove: () => handleFiltersChange({ ...filters, vegetarianOnly: undefined }) });
  if (filters.sweetOnly) activeFilterChips.push({ value: 'Recetas Dulces', onRemove: () => handleFiltersChange({ ...filters, sweetOnly: undefined }) });
  if (filters.savoryOnly) activeFilterChips.push({ value: 'Recetas Saladas', onRemove: () => handleFiltersChange({ ...filters, savoryOnly: undefined }) });

  const handleClearFilters = () => {
    setFilters({
      difficulty: [],
      prepTimeRange: [0, 180],
      recipeTypes: [],
      tags: [],
      ingredients: [],
      featured: undefined,
      cookedOnly: undefined,
      thermomixOnly: undefined,
      airFryerOnly: undefined,
      glutenFreeOnly: undefined,
      sugarFreeOnly: undefined,
      ketoOnly: undefined,
      lowCarbOnly: undefined,
      proteicaOnly: undefined,
      vegetarianOnly: undefined,
      sweetOnly: undefined,
      savoryOnly: undefined,
      collectionId: undefined,
      sources: undefined,
      dishType: undefined,
      dishTypes: [],
      author: undefined
    });
  };

  const handlePlayTTS = async (recipe: Recipe) => {
    try {
      // If already playing this recipe, pause it
      if (playingRecipeId === recipe.id) {
        window.speechSynthesis.pause();
        setPlayingRecipeId(null);
        setPausedRecipeId(recipe.id);
        toast({
          title: "Audio pausado",
          description: `"${recipe.title}"`,
        });
        return;
      }

      if (pausedRecipeId === recipe.id && window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setPlayingRecipeId(recipe.id);
        setPausedRecipeId(null);
        toast({
          title: "Audio reanudado",
          description: `"${recipe.title}"`,
        });
        return;
      }

      // If playing another recipe, stop it first
      if (playingRecipeId) {
        window.speechSynthesis.cancel();
        setPlayingRecipeId(null);
        setPausedRecipeId(null);
        // Small delay to ensure cancel is processed
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (pausedRecipeId) {
        window.speechSynthesis.cancel();
        setPausedRecipeId(null);
      }

      if (!('speechSynthesis' in window)) {
        toast({
          title: "No compatible",
          description: "TTS no es soportado en este navegador",
          variant: "destructive",
        });
        return;
      }

      let scriptText = recipe.locution;

      // Generate script if it doesn't exist
      if (!scriptText?.trim()) {
        setGeneratingScript(recipe.id);

        // Group ingredients and instructions by section
        const ingredientsBySection = new Map<string | null, typeof recipe.ingredients>();
        recipe.ingredients.forEach(ing => {
          const section = ing.section || null;
          if (!ingredientsBySection.has(section)) {
            ingredientsBySection.set(section, []);
          }
          ingredientsBySection.get(section)!.push(ing);
        });

        const instructionsBySection = new Map<string | null, typeof recipe.instructions>();
        recipe.instructions.forEach(inst => {
          const section = inst.section || null;
          if (!instructionsBySection.has(section)) {
            instructionsBySection.set(section, []);
          }
          instructionsBySection.get(section)!.push(inst);
        });

        // Format ingredients with sections
        let ingredientsText = '';
        Array.from(ingredientsBySection.entries()).forEach(([section, ingredients]) => {
          if (section) {
            ingredientsText += `\n${section}:\n`;
          }
          ingredients.forEach(ing => {
            ingredientsText += `- ${ing.amount} ${ing.unit || ''} ${ing.name}\n`;
          });
        });

        // Format instructions with sections
        let instructionsText = '';
        let stepCounter = 1;
        Array.from(instructionsBySection.entries()).forEach(([section, instructions]) => {
          if (section) {
            instructionsText += `\n${section}:\n`;
          }
          instructions.forEach(inst => {
            instructionsText += `${stepCounter}. ${inst.description}\n`;
            stepCounter++;
          });
        });

        const prompt = `Genera un script para explicar esta receta de cocina. El script debe ser natural, entusiasta y facil de seguir. NO te presentes ni menciones tu nombre, simplemente explica la receta directamente. Los datos de la receta son:

Titulo: ${recipe.title}
Descripcion: ${recipe.description || 'Sin descripcion'}
Tiempo de preparacion: ${recipe.prepTime} minutos
Tiempo de coccion: ${recipe.cookTime || 'No especificado'} minutos
Porciones: ${recipe.servings}
Dificultad: ${recipe.difficulty}

Ingredientes:
${ingredientsText}

Instrucciones:
${instructionsText}

IMPORTANTE: Si hay secciones en los ingredientes o instrucciones (por ejemplo "Para la masa", "Para el relleno"), mencionalas claramente en el script para que el oyente entienda que esta receta tiene multiples partes. Por ejemplo: "Para la masa necesitaremos..." o "Ahora vamos con el relleno...".

Genera un script natural y conversacional explicando la receta paso a paso. Comienza directamente con la receta sin presentarte. Que sea fluido y agradable de escuchar.`;

        try {
          const response = await api.llm.generateScript(prompt);
          if (response && response.success && response.script) {
            scriptText = response.script;

            // Save the generated script to the recipe
            const updatedRecipe = { ...recipe, locution: scriptText };

            // Clean the recipe data to match backend schema
            const cleanedRecipe = {
              title: updatedRecipe.title,
              description: updatedRecipe.description,
              prepTime: updatedRecipe.prepTime,
              cookTime: updatedRecipe.cookTime,
              servings: updatedRecipe.servings,
              difficulty: updatedRecipe.difficulty,
              recipeType: updatedRecipe.recipeType,
              locution: updatedRecipe.locution,
              images: updatedRecipe.images,
              ingredients: updatedRecipe.ingredients.map(ing => ({
                name: ing.name,
                amount: ing.amount || "",
                unit: ing.unit || "",
                section: ing.section || undefined,
                order: ing.order
              })),
              instructions: updatedRecipe.instructions.map(inst => ({
                step: inst.step,
                description: inst.description,
                time: inst.thermomixSettings?.time || "",
                temperature: inst.thermomixSettings?.temperature || "",
                speed: inst.thermomixSettings?.speed || "",
                section: inst.section || undefined
              })),
              tags: updatedRecipe.tags.map(tag =>
                typeof tag === 'string' ? tag : tag.tag || tag.name || String(tag)
              ).filter(tag => tag && tag.length > 0)
            };

            await api.recipes.update(recipe.id, cleanedRecipe);

            // Update local state
            setRecipes(prev => prev.map(r => r.id === recipe.id ? updatedRecipe : r));
          }
        } catch (error) {
          console.error('Error generating TTS script:', error);
          toast({
            title: "Error",
            description: "No se pudo generar el script automaticamente",
            variant: "destructive",
          });
          return;
        } finally {
          setGeneratingScript(null);
        }
      }

      if (!scriptText?.trim()) {
        toast({
          title: "Sin contenido",
          description: "No hay texto para reproducir",
          variant: "destructive",
        });
        return;
      }

      // Create utterance and apply voice settings
      const utterance = new SpeechSynthesisUtterance(scriptText);

      // Apply voice settings
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      utterance.lang = 'es-AR';

      utterance.onstart = () => {
        setPlayingRecipeId(recipe.id);
        setPausedRecipeId(null);
        toast({
          title: "Reproduciendo receta",
          description: `"${recipe.title}"`,
        });
      };

      utterance.onend = () => {
        setPlayingRecipeId(null);
        setPausedRecipeId(null);
      };

      utterance.onerror = (event) => {
        setPlayingRecipeId(null);
        setPausedRecipeId(null);
        if (event.error === 'canceled' || event.error === 'interrupted') return;
        console.error('Speech synthesis error:', event.error);
        toast({
          title: "Error de reproduccion",
          description: "No se pudo reproducir el audio",
          variant: "destructive",
        });
      };

      window.speechSynthesis.speak(utterance);

    } catch (error) {
      console.error('Error in TTS playback:', error);
      setPlayingRecipeId(null);
      setGeneratingScript(null);
      toast({
        title: "Error",
        description: "Error al reproducir la receta",
        variant: "destructive",
      });
    }
  };

  // Get grid class based on column count
  const getGridClass = () => {
    switch (gridColumns) {
      case 1:
        return 'grid grid-cols-1 gap-6';
      case 2:
        return 'grid grid-cols-1 md:grid-cols-2 gap-6';
      case 3:
        // En iPad (md-lg) queda en 2 columnas; 3 columnas recien en desktop (xl).
        return 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6';
      case 4:
        return 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6';
      case 5:
        return 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5 gap-6';
      default:
        return 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6';
    }
  };

  const getColumnIcon = (columns: number) => {
    switch (columns) {
      case 1:
        return <Square className="h-4 w-4" />;
      case 2:
        return <Grid2X2 className="h-4 w-4" />;
      case 3:
        return <Grid3X3 className="h-4 w-4" />;
      case 4:
        return <Grid className="h-4 w-4" />;
      case 5:
        return <Columns className="h-4 w-4" />;
      default:
        return <Grid3X3 className="h-4 w-4" />;
    }
  };

  // En las galerias (colecciones, categorias, etc.) solo aplican columnas + Lista,
  // no las vistas especificas de recetas (Detalles, Ingredientes).
  const inGallery = showCollectionsGallery || showCategoriesGallery || showSourcesGallery || showDishTypesGallery || showTagsGallery || showAuthorsGallery;

  // Colecciones a mostrar en la galeria: filtradas por el buscador (solo nombre) y ordenadas.
  const galleryCollections = (() => {
    let list = collections;
    if (showCollectionsGallery && searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }
    const dir = collectionSortDirection === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (collectionSort === 'count') {
        return dir * ((a.recipeCount - b.recipeCount) || a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
      }
      return dir * a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
    });
  })();

  // Seleccion masiva de colecciones (imprimir/eliminar), analoga a la de recetas.
  const collectionSelectionMode = showCollectionsGallery && activeBulkPanel !== null;
  const selectedActionCollections = collections.filter((c) => selectedCollectionBulkIds.has(c.id));
  const handleToggleCollectionSelection = (
    id: string,
    modifiersi: { shift?: boolean; ctrl?: boolean }
  ) => {
    // SHIFT: seleccionar el rango consecutivo desde la ultima coleccion clickeada.
    if (modifiers?.shift && lastSelectedCollectionId.current) {
      const ids = galleryCollections.map((c) => c.id);
      const from = ids.indexOf(lastSelectedCollectionId.current);
      const to = ids.indexOf(id);
      if (from !== -1 && to !== -1) {
        const [start, end] = from < to ? [from, to] : [to, from];
        const rangeIds = ids.slice(start, end + 1);
        setSelectedCollectionBulkIds((prev) => {
          const next = new Set(prev);
          rangeIds.forEach((rid) => next.add(rid));
          return next;
        });
        lastSelectedCollectionId.current = id;
        return;
      }
    }

    // CTRL o click normal: alternar individualmente (no consecutivas).
    setSelectedCollectionBulkIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    lastSelectedCollectionId.current = id;
  };
  const handleToggleAllVisibleCollections = () => {
    const ids = galleryCollections.map((c) => c.id);
    const allSel = ids.length > 0 && ids.every((id) => selectedCollectionBulkIds.has(id));
    setSelectedCollectionBulkIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => { if (allSel) next.delete(id); else next.add(id); });
      return next;
    });
  };
  const handleSelectAllCollections = () => {
    const ids = collections.map((c) => c.id);
    const allSel = ids.length > 0 && ids.every((id) => selectedCollectionBulkIds.has(id));
    setSelectedCollectionBulkIds(allSel ? new Set() : new Set(ids));
  };
  const collectionsForPrint = () => selectedActionCollections.map((c) => ({ name: c.name, count: c.recipeCount, cover: collectionCovers[c.id] }));
  // Abrir el dialogo de opciones de impresion (titulo, encabezado, pie, numero de pagina y columnas).
  const openGalleryPrint = (kind: 'cards' | 'list', label: string, items: PrintCollectionItem[]) => {
    if (!items.length) return;
    setGalleryPrintTitle('');
    setGalleryPrintHeader('');
    setGalleryPrintFooter('');
    setGalleryPrintPageNumber(false);
    setGalleryPrintColumns(4);
    setGalleryPrint({ kind, label, items });
  };
  const confirmGalleryPrint = () => {
    if (!galleryPrint) return;
    const opts = {
      title: galleryPrintTitle.trim() || undefined,
      header: galleryPrintHeader.trim() || undefined,
      footer: galleryPrintFooter.trim() || undefined,
      pageNumber: galleryPrintPageNumber,
    };
    if (galleryPrint.kind === 'cards') {
      void printCollectionCards(galleryPrint.items, { ...opts, columns: galleryPrintColumns });
    } else {
      void printCollectionList(galleryPrint.items, opts);
    }
    setGalleryPrint(null);
  };
  const handleBulkPrintCollectionCards = () => openGalleryPrint('cards', 'colecciones', collectionsForPrint());
  const handleBulkPrintCollectionList = () => openGalleryPrint('list', 'colecciones', collectionsForPrint());

  // --- Galeria de tipos de comida: busqueda, orden y seleccion masiva (igual que colecciones) ---
  const galleryDishTypes = (() => {
    let list = dishTypeList;
    if (showDishTypesGallery && searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter((d) => d.name.toLowerCase().includes(q));
    }
    const dir = dishTypeSortDirection === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (dishTypeSort === 'count') {
        return dir * ((a.count - b.count) || a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
      }
      return dir * a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
    });
  })();
  const dishTypeSelectionMode = showDishTypesGallery && activeBulkPanel !== null;
  const selectedActionDishTypes = dishTypeList.filter((d) => selectedDishTypeBulkNames.has(d.name));
  const handleToggleDishTypeSelection = (
    name: string,
    modifiersi: { shift?: boolean; ctrl?: boolean }
  ) => {
    if (modifiers?.shift && lastSelectedDishTypeName.current) {
      const names = galleryDishTypes.map((d) => d.name);
      const from = names.indexOf(lastSelectedDishTypeName.current);
      const to = names.indexOf(name);
      if (from !== -1 && to !== -1) {
        const [start, end] = from < to ? [from, to] : [to, from];
        const rangeNames = names.slice(start, end + 1);
        setSelectedDishTypeBulkNames((prev) => {
          const next = new Set(prev);
          rangeNames.forEach((n) => next.add(n));
          return next;
        });
        lastSelectedDishTypeName.current = name;
        return;
      }
    }
    setSelectedDishTypeBulkNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
    lastSelectedDishTypeName.current = name;
  };
  const handleSelectAllDishTypes = () => {
    const names = dishTypeList.map((d) => d.name);
    const allSel = names.length > 0 && names.every((n) => selectedDishTypeBulkNames.has(n));
    setSelectedDishTypeBulkNames(allSel ? new Set() : new Set(names));
  };
  const dishTypesForPrint = () => selectedActionDishTypes.map((d) => ({ name: d.name, count: d.count, cover: d.cover }));
  const handleBulkPrintDishTypeCards = () => openGalleryPrint('cards', 'tipos de comida', dishTypesForPrint());
  const handleBulkPrintDishTypeList = () => openGalleryPrint('list', 'tipos de comida', dishTypesForPrint());

  // --- Galeria de categorias: busqueda, orden y seleccion masiva (igual que tipos de comida) ---
  const galleryCategories = (() => {
    let list = categoryList;
    if (showCategoriesGallery && searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }
    const dir = categorySortDirection === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (categorySort === 'count') {
        return dir * ((a.count - b.count) || a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
      }
      return dir * a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
    });
  })();
  const categorySelectionMode = showCategoriesGallery && activeBulkPanel !== null;
  const selectedActionCategories = categoryList.filter((c) => selectedCategoryBulkNames.has(c.name));
  const handleToggleCategorySelection = (
    name: string,
    modifiersi: { shift?: boolean; ctrl?: boolean }
  ) => {
    if (modifiers?.shift && lastSelectedCategoryName.current) {
      const names = galleryCategories.map((c) => c.name);
      const from = names.indexOf(lastSelectedCategoryName.current);
      const to = names.indexOf(name);
      if (from !== -1 && to !== -1) {
        const [start, end] = from < to ? [from, to] : [to, from];
        const rangeNames = names.slice(start, end + 1);
        setSelectedCategoryBulkNames((prev) => {
          const next = new Set(prev);
          rangeNames.forEach((n) => next.add(n));
          return next;
        });
        lastSelectedCategoryName.current = name;
        return;
      }
    }
    setSelectedCategoryBulkNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
    lastSelectedCategoryName.current = name;
  };
  const handleSelectAllCategories = () => {
    const names = categoryList.map((c) => c.name);
    const allSel = names.length > 0 && names.every((n) => selectedCategoryBulkNames.has(n));
    setSelectedCategoryBulkNames(allSel ? new Set() : new Set(names));
  };
  const categoriesForPrint = () => selectedActionCategories.map((c) => ({ name: c.name, count: c.count, cover: c.cover }));
  const handleBulkPrintCategoryCards = () => openGalleryPrint('cards', 'categorias', categoriesForPrint());
  const handleBulkPrintCategoryList = () => openGalleryPrint('list', 'categorias', categoriesForPrint());

  // --- Galeria de fuentes: busqueda, orden y seleccion masiva (igual que categorias) ---
  const gallerySources = (() => {
    let list = sourceList;
    if (showSourcesGallery && searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter((s) => s.name.toLowerCase().includes(q));
    }
    const dir = sourceSortDirection === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sourceSort === 'count') {
        return dir * ((a.count - b.count) || a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
      }
      return dir * a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
    });
  })();
  const sourceSelectionMode = showSourcesGallery && activeBulkPanel !== null;
  const selectedActionSources = sourceList.filter((s) => selectedSourceBulkNames.has(s.name));
  const handleToggleSourceSelection = (
    name: string,
    modifiersi: { shift?: boolean; ctrl?: boolean }
  ) => {
    if (modifiers?.shift && lastSelectedSourceName.current) {
      const names = gallerySources.map((s) => s.name);
      const from = names.indexOf(lastSelectedSourceName.current);
      const to = names.indexOf(name);
      if (from !== -1 && to !== -1) {
        const [start, end] = from < to ? [from, to] : [to, from];
        const rangeNames = names.slice(start, end + 1);
        setSelectedSourceBulkNames((prev) => {
          const next = new Set(prev);
          rangeNames.forEach((n) => next.add(n));
          return next;
        });
        lastSelectedSourceName.current = name;
        return;
      }
    }
    setSelectedSourceBulkNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
    lastSelectedSourceName.current = name;
  };
  const handleSelectAllSources = () => {
    const names = sourceList.map((s) => s.name);
    const allSel = names.length > 0 && names.every((n) => selectedSourceBulkNames.has(n));
    setSelectedSourceBulkNames(allSel ? new Set() : new Set(names));
  };
  const sourcesForPrint = () => selectedActionSources.map((s) => ({ name: s.name, count: s.count, cover: s.cover }));
  const handleBulkPrintSourceCards = () => openGalleryPrint('cards', 'fuentes', sourcesForPrint());
  const handleBulkPrintSourceList = () => openGalleryPrint('list', 'fuentes', sourcesForPrint());

  // --- Galeria de etiquetas: busqueda, orden y seleccion masiva (igual que fuentes) ---
  const galleryTags = (() => {
    let list = tagList;
    if (showTagsGallery && searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter((t) => t.name.toLowerCase().includes(q));
    }
    const dir = tagSortDirection === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (tagSort === 'count') {
        return dir * ((a.count - b.count) || a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
      }
      return dir * a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
    });
  })();
  const tagSelectionMode = showTagsGallery && activeBulkPanel !== null;
  const selectedActionTags = tagList.filter((t) => selectedTagBulkNames.has(t.name));
  const handleToggleTagSelection = (
    name: string,
    modifiersi: { shift?: boolean; ctrl?: boolean }
  ) => {
    if (modifiers?.shift && lastSelectedTagName.current) {
      const names = galleryTags.map((t) => t.name);
      const from = names.indexOf(lastSelectedTagName.current);
      const to = names.indexOf(name);
      if (from !== -1 && to !== -1) {
        const [start, end] = from < to ? [from, to] : [to, from];
        const rangeNames = names.slice(start, end + 1);
        setSelectedTagBulkNames((prev) => {
          const next = new Set(prev);
          rangeNames.forEach((n) => next.add(n));
          return next;
        });
        lastSelectedTagName.current = name;
        return;
      }
    }
    setSelectedTagBulkNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
    lastSelectedTagName.current = name;
  };
  const handleSelectAllTags = () => {
    const names = tagList.map((t) => t.name);
    const allSel = names.length > 0 && names.every((n) => selectedTagBulkNames.has(n));
    setSelectedTagBulkNames(allSel ? new Set() : new Set(names));
  };
  const tagsForPrint = () => selectedActionTags.map((t) => ({ name: t.name, count: t.count, cover: t.cover }));
  const handleBulkPrintTagCards = () => openGalleryPrint('cards', 'etiquetas', tagsForPrint());
  const handleBulkPrintTagList = () => openGalleryPrint('list', 'etiquetas', tagsForPrint());
  // Eliminar varias etiquetas seleccionadas (las recetas se mantienen).
  const handleBulkDeleteTags = async () => {
    const names = Array.from(selectedTagBulkNames);
    if (names.length === 0) return;
    if (names.some((n) => filters.tags?.includes(n))) {
      handleFiltersChange({ ...filters, tags: (filters.tags || []).filter((t) => !names.includes(t)) });
    }
    try {
      await Promise.all(names.map((n) => api.tags.remove(n)));
      await Promise.all([reloadTags(), loadRecipes()]);
      toast({
        title: names.length > 1 ? `${names.length} etiquetas eliminadas` : "Etiqueta eliminada",
        description: "Las recetas siguen disponibles en tu lista.",
      });
      setSelectedTagBulkNames(new Set());
    } catch (error) {
      toast({
        title: "No se pudieron eliminar las etiquetas",
        description: error instanceof Error ? error.message : "Intenta nuevamente",
        variant: "destructive",
      });
    } finally {
      setBulkDeleteTagsOpen(false);
    }
  };
  // Eliminar varias fuentes seleccionadas (las recetas se mantienen).
  const handleBulkDeleteSources = async () => {
    const names = Array.from(selectedSourceBulkNames);
    if (names.length === 0) return;
    if (names.some((n) => filters.sources?.includes(n))) {
      const remaining = (filters.sources || []).filter((s) => !names.includes(s));
      handleFiltersChange({ ...filters, sources: remaining.length ? remaining : undefined });
    }
    try {
      await Promise.all(names.map((n) => api.sources.remove(n)));
      await Promise.all([reloadSources(), loadRecipes()]);
      toast({
        title: names.length > 1 ? `${names.length} fuentes eliminadas` : "Fuente eliminada",
        description: "Las recetas siguen disponibles en tu lista.",
      });
      setSelectedSourceBulkNames(new Set());
    } catch (error) {
      toast({
        title: "No se pudieron eliminar las fuentes",
        description: error instanceof Error ? error.message : "Intenta nuevamente",
        variant: "destructive",
      });
    } finally {
      setBulkDeleteSourcesOpen(false);
    }
  };
  // Eliminar varias categorias seleccionadas (las recetas se mantienen).
  const handleBulkDeleteCategories = async () => {
    const names = Array.from(selectedCategoryBulkNames);
    if (names.length === 0) return;
    if (names.some((n) => filters.recipeTypes?.includes(n))) {
      handleFiltersChange({ ...filters, recipeTypes: (filters.recipeTypes || []).filter((t) => !names.includes(t)) });
    }
    try {
      await Promise.all(names.map((n) => api.categories.remove(n)));
      await Promise.all([reloadCategories(), loadRecipes()]);
      toast({
        title: names.length > 1 ? `${names.length} categorias eliminadas` : "Categoria eliminada",
        description: "Las recetas siguen disponibles en tu lista.",
      });
      setSelectedCategoryBulkNames(new Set());
    } catch (error) {
      toast({
        title: "No se pudieron eliminar las categorias",
        description: error instanceof Error ? error.message : "Intenta nuevamente",
        variant: "destructive",
      });
    } finally {
      setBulkDeleteCategoriesOpen(false);
    }
  };
  // Eliminar varios tipos de comida seleccionados (las recetas se mantienen).
  const handleBulkDeleteDishTypes = async () => {
    const names = Array.from(selectedDishTypeBulkNames);
    if (names.length === 0) return;
    if (names.some((n) => filters.dishType === n || filters.dishTypes?.includes(n))) {
      handleFiltersChange({
        ...filters,
        dishType: filters.dishType && names.includes(filters.dishType) ? undefined : filters.dishType,
        dishTypes: (filters.dishTypes || []).filter((t) => !names.includes(t)),
      });
    }
    try {
      await Promise.all(names.map((n) => api.dishTypes.remove(n)));
      await Promise.all([reloadDishTypes(), loadRecipes()]);
      toast({
        title: names.length > 1 ? `${names.length} tipos de comida eliminados` : "Tipo de comida eliminado",
        description: "Las recetas siguen disponibles en tu lista.",
      });
      setSelectedDishTypeBulkNames(new Set());
    } catch (error) {
      toast({
        title: "No se pudieron eliminar los tipos de comida",
        description: error instanceof Error ? error.message : "Intenta nuevamente",
        variant: "destructive",
      });
    } finally {
      setBulkDeleteDishTypesOpen(false);
    }
  };

  // Vista simplificada al abrir en ventana nueva (coleccion/categoria/fuente/tipo):
  // header solo con logo + Cerrar y sin sidebar (el toolbar con titulo y botones si se muestra).
  const isItemWindow = ['collection', 'categoria', 'fuente', 'tipo', 'etiqueta'].some(
    (k) => new URLSearchParams(window.location.search).has(k)
  );

  // Panel lateral reutilizable (aside en desktop + cajon en mobile/iPad).
  const collectionsSidebarNode = (
    <CollectionsSidebar
      collections={collections}
      covers={collectionCovers}
      activeCollectionId={filters.collectionId}
      onSelectCollection={(id) => {
        setShowCollectionsGallery(false);
        setShowCategoriesGallery(false);
        setShowSourcesGallery(false);
        setShowDishTypesGallery(false); setShowTagsGallery(false); setShowAuthorsGallery(false);
        if (id) {
          handleFiltersChange({ ...filters, collectionId: id, recipeTypes: [], sources: undefined, dishType: undefined, dishTypes: [] });
        } else {
          handleClearFilters();
          setSearchTerm('');
          setSearchTerms([]);
        }
      }}
      onShowCollections={() => { setShowHero(false); setShowCategoriesGallery(false); setShowSourcesGallery(false); setShowDishTypesGallery(false); setShowTagsGallery(false); setShowAuthorsGallery(false); setShowCollectionsGallery(true); setShowFilters(false); setActiveBulkPanel(null); setSelectedRecipeIds(new Set()); handleFiltersChange({ ...filters, collectionId: undefined, recipeTypes: [], sources: undefined, dishType: undefined, dishTypes: [] }); }}
      onCreateCollection={handleCreateCollection}
      totalRecipes={recipes.length}
      allRecipesActive={!hasActiveFilters && !showCollectionsGallery && !showCategoriesGallery && !showSourcesGallery && !showDishTypesGallery && !showTagsGallery && !showAuthorsGallery && !searchTerm && searchTerms.length === 0}
      favoritesActive={filters.featured === true}
      favoritesCount={recipes.filter((r) => r.featured).length}
      onSelectFavorites={() => { setShowCollectionsGallery(false); setShowCategoriesGallery(false); setShowSourcesGallery(false); setShowDishTypesGallery(false); setShowTagsGallery(false); setShowAuthorsGallery(false); handleFiltersChange({ ...filters, featured: filters.featured === true ? undefined : true }); }}
      cookedActive={filters.cookedOnly === true}
      cookedCount={recipes.filter((r) => r.cooked).length}
      onSelectCooked={() => { setShowCollectionsGallery(false); setShowCategoriesGallery(false); setShowSourcesGallery(false); setShowDishTypesGallery(false); setShowTagsGallery(false); setShowAuthorsGallery(false); handleFiltersChange({ ...filters, cookedOnly: filters.cookedOnly ? undefined : true }); }}
      thermomixActive={filters.thermomixOnly === true}
      thermomixCount={recipes.filter((r) => r.thermomix || isThermomixRecipe(r)).length}
      onSelectThermomix={() => { setShowCollectionsGallery(false); setShowCategoriesGallery(false); setShowSourcesGallery(false); setShowDishTypesGallery(false); setShowTagsGallery(false); setShowAuthorsGallery(false); handleFiltersChange({ ...filters, thermomixOnly: filters.thermomixOnly ? undefined : true }); }}
      airFryerActive={filters.airFryerOnly === true}
      airFryerCount={recipes.filter((r) => r.airFryer === true).length}
      onSelectAirFryer={() => { setShowCollectionsGallery(false); setShowCategoriesGallery(false); setShowSourcesGallery(false); setShowDishTypesGallery(false); setShowTagsGallery(false); setShowAuthorsGallery(false); handleFiltersChange({ ...filters, airFryerOnly: filters.airFryerOnly ? undefined : true }); }}
      glutenFreeActive={filters.glutenFreeOnly === true}
      glutenFreeCount={recipes.filter((r) => r.glutenFree === true).length}
      onSelectGlutenFree={() => { setShowCollectionsGallery(false); setShowCategoriesGallery(false); setShowSourcesGallery(false); setShowDishTypesGallery(false); setShowTagsGallery(false); setShowAuthorsGallery(false); handleFiltersChange({ ...filters, glutenFreeOnly: filters.glutenFreeOnly ? undefined : true }); }}
      sugarFreeActive={filters.sugarFreeOnly === true}
      sugarFreeCount={recipes.filter((r) => r.sugarFree === true).length}
      onSelectSugarFree={() => { setShowCollectionsGallery(false); setShowCategoriesGallery(false); setShowSourcesGallery(false); setShowDishTypesGallery(false); setShowTagsGallery(false); setShowAuthorsGallery(false); handleFiltersChange({ ...filters, sugarFreeOnly: filters.sugarFreeOnly ? undefined : true }); }}
      ketoActive={filters.ketoOnly === true}
      ketoCount={recipes.filter((r) => r.keto === true).length}
      onSelectKeto={() => { setShowCollectionsGallery(false); setShowCategoriesGallery(false); setShowSourcesGallery(false); setShowDishTypesGallery(false); setShowTagsGallery(false); setShowAuthorsGallery(false); handleFiltersChange({ ...filters, ketoOnly: filters.ketoOnly ? undefined : true }); }}
      healthyActive={filters.lowCarbOnly === true}
      healthyCount={recipes.filter((r) => r.lowCarb === true).length}
      onSelectHealthy={() => { setShowCollectionsGallery(false); setShowCategoriesGallery(false); setShowSourcesGallery(false); setShowDishTypesGallery(false); setShowTagsGallery(false); setShowAuthorsGallery(false); handleFiltersChange({ ...filters, lowCarbOnly: filters.lowCarbOnly ? undefined : true }); }}
      proteicaActive={filters.proteicaOnly === true}
      proteicaCount={recipes.filter((r) => r.proteica === true).length}
      onSelectProteica={() => { setShowCollectionsGallery(false); setShowCategoriesGallery(false); setShowSourcesGallery(false); setShowDishTypesGallery(false); setShowTagsGallery(false); setShowAuthorsGallery(false); handleFiltersChange({ ...filters, proteicaOnly: filters.proteicaOnly ? undefined : true }); }}
      vegetarianActive={filters.vegetarianOnly === true}
      vegetarianCount={recipes.filter((r) => r.vegetarian === true).length}
      onSelectVegetarian={() => { setShowCollectionsGallery(false); setShowCategoriesGallery(false); setShowSourcesGallery(false); setShowDishTypesGallery(false); setShowTagsGallery(false); setShowAuthorsGallery(false); handleFiltersChange({ ...filters, vegetarianOnly: filters.vegetarianOnly ? undefined : true }); }}
      sweetActive={filters.sweetOnly === true}
      sweetCount={recipes.filter((r) => r.sweet === true).length}
      onSelectSweet={() => { setShowCollectionsGallery(false); setShowCategoriesGallery(false); setShowSourcesGallery(false); setShowDishTypesGallery(false); setShowTagsGallery(false); setShowAuthorsGallery(false); handleFiltersChange({ ...filters, sweetOnly: filters.sweetOnly ? undefined : true }); }}
      savoryActive={filters.savoryOnly === true}
      savoryCount={recipes.filter((r) => r.savory === true).length}
      onSelectSavory={() => { setShowCollectionsGallery(false); setShowCategoriesGallery(false); setShowSourcesGallery(false); setShowDishTypesGallery(false); setShowTagsGallery(false); setShowAuthorsGallery(false); handleFiltersChange({ ...filters, savoryOnly: filters.savoryOnly ? undefined : true }); }}
      categories={categoryList}
      activeCategory={filters.recipeTypes?.length === 1 ? filters.recipeTypes[0] : undefined}
      onSelectCategory={(name) => {
        saveRecentCategory(name);
        setShowCollectionsGallery(false);
        setShowCategoriesGallery(false);
        setShowSourcesGallery(false);
        setShowDishTypesGallery(false); setShowTagsGallery(false); setShowAuthorsGallery(false);
        const current = filters.recipeTypes || [];
        const isActive = current.length === 1 && current[0] === name;
        handleFiltersChange({ ...filters, recipeTypes: isActive ? [] : [name], collectionId: undefined, sources: undefined, dishType: undefined, dishTypes: [] });
      }}
      onShowCategories={() => { setShowHero(false); setShowCollectionsGallery(false); setShowSourcesGallery(false); setShowDishTypesGallery(false); setShowTagsGallery(false); setShowAuthorsGallery(false); setShowCategoriesGallery(true); setShowFilters(false); setActiveBulkPanel(null); setSelectedRecipeIds(new Set()); handleFiltersChange({ ...filters, collectionId: undefined, recipeTypes: [], sources: undefined, dishType: undefined, dishTypes: [] }); }}
      onCreateCategory={handleCreateCategory}
      sources={sourceList}
      activeSource={filters.sources?.length === 1 ? filters.sources[0] : undefined}
      onSelectSource={(name) => {
        setShowCollectionsGallery(false);
        setShowCategoriesGallery(false);
        setShowSourcesGallery(false);
        setShowDishTypesGallery(false); setShowTagsGallery(false); setShowAuthorsGallery(false);
        const isActive = filters.sources?.length === 1 && filters.sources[0] === name;
        if (!isActive) saveRecentSource(name);
        handleFiltersChange({ ...filters, sources: isActive ? undefined : [name], collectionId: undefined, recipeTypes: [], dishType: undefined, dishTypes: [] });
      }}
      onShowSources={() => { setShowHero(false); setShowCollectionsGallery(false); setShowCategoriesGallery(false); setShowDishTypesGallery(false); setShowTagsGallery(false); setShowAuthorsGallery(false); setShowSourcesGallery(true); setShowFilters(false); setActiveBulkPanel(null); setSelectedRecipeIds(new Set()); handleFiltersChange({ ...filters, collectionId: undefined, recipeTypes: [], sources: undefined, dishType: undefined, dishTypes: [] }); }}
      onCreateSource={handleCreateSource}
      dishTypes={dishTypeList}
      activeDishType={filters.dishType}
      onSelectDishType={(name) => {
        setShowCollectionsGallery(false);
        setShowCategoriesGallery(false);
        setShowSourcesGallery(false);
        setShowDishTypesGallery(false); setShowTagsGallery(false); setShowAuthorsGallery(false);
        handleFiltersChange({ ...filters, dishType: filters.dishType === name ? undefined : name, dishTypes: [], collectionId: undefined, recipeTypes: [], sources: undefined });
      }}
      onShowDishTypes={() => { setShowHero(false); setShowCollectionsGallery(false); setShowCategoriesGallery(false); setShowSourcesGallery(false); setShowAuthorsGallery(false); setShowDishTypesGallery(true); setShowFilters(false); setActiveBulkPanel(null); setSelectedRecipeIds(new Set()); handleFiltersChange({ ...filters, collectionId: undefined, recipeTypes: [], sources: undefined, dishType: undefined, dishTypes: [] }); }}
      onCreateDishType={handleCreateDishType}
    />
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header
        onAddRecipe={handleAddRecipe}
        onImportRecipe={handleImportRecipe}
        onRecipeAdded={loadRecipes}
        onViewRecipe={handleViewRecipe}
        onLogoClick={handleLogoClick}
        minimal={isItemWindow}
      />

      {showHero && (
        <Hero onGetStarted={handleGetStarted} onViewFeatured={handleViewFeatured} />
      )}
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-0 pb-8">
        <div
          ref={recipeToolbarRef}
          className="sticky z-30 -mx-4 flex flex-col gap-2 border-b border-border/50 bg-background px-4 pt-1 pb-2.5 shadow-sm sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 xl:flex-row xl:items-center xl:justify-between xl:gap-3"
          style={{ top: 'var(--tastebox-header-height, 113px)' }}
        >
          <div className="text-left xl:w-[300px] xl:shrink-0">
            {/* En tablet (iPad portrait): titulo a la izquierda y "Mostrando" a la derecha, en una linea.
                En desktop (lg+) el titulo queda a la izquierda y los botones a la derecha. */}
            <div className="flex items-start gap-2">
            <button
              type="button"
              onClick={handleMenuButton}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Mostrar/ocultar secciones (colecciones, categorias, favoritas, etc.)"
              aria-label="Mostrar u ocultar secciones"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
            <h2 className="truncate whitespace-nowrap text-lg font-bold text-foreground xl:text-2xl">
              {showCollectionsGallery
                ? 'Mis Colecciones'
                : showCategoriesGallery
                  ? 'Categorias'
                  : showSourcesGallery
                    ? 'Fuentes'
                    : showDishTypesGallery
                      ? 'Tipos de comidas'
                      : showTagsGallery
                        ? 'Etiquetas'
                      : showAuthorsGallery
                        ? 'Autores'
                        : filters.collectionId
                          ? `Coleccion ${collections.find(c => c.id === filters.collectionId)?.name ?? ''}`
                          : `Recetas de ${user?.alias || user?.name || 'Usuario'}`}
            </h2>
            <p className="truncate whitespace-nowrap text-xs text-muted-foreground mt-0.5">
              {showCollectionsGallery
                ? `${collections.length} coleccion${collections.length !== 1 ? 'es' : ''}`
                : showCategoriesGallery
                  ? `${categoryList.length} categoria${categoryList.length !== 1 ? 's' : ''}`
                  : showSourcesGallery
                    ? `${sourceList.length} fuente${sourceList.length !== 1 ? 's' : ''}`
                    : showDishTypesGallery
                      ? `${dishTypeList.length} tipo${dishTypeList.length !== 1 ? 's' : ''} de receta`
                      : showTagsGallery
                        ? `${tagList.length} etiqueta${tagList.length !== 1 ? 's' : ''}`
                      : showAuthorsGallery
                        ? `${authorList.length} autor${authorList.length !== 1 ? 'es' : ''}`
                        : `Mostrando ${filteredRecipes.length} de ${allFilteredRecipes.length} receta${allFilteredRecipes.length !== 1 ? 's' : ''}`}
            </p>
            </div>
            </div>
            {!showCollectionsGallery && !showCategoriesGallery && !showSourcesGallery && !showDishTypesGallery && !showTagsGallery && !showAuthorsGallery && activeFilterChips.length > 0 && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="flex h-6 w-6 items-center justify-center rounded-md border border-destructive/40 text-destructive transition-colors hover:bg-destructive/10"
                  title="Quitar filtros"
                  aria-label="Quitar filtros"
                >
                  <FilterX className="h-4 w-4" />
                </button>
                {activeFilterChips.map((chip, i) => (
                  <span key={i} className="filter-chip inline-flex items-center gap-1 rounded-full bg-primary/10 py-0.5 pl-2 pr-1 text-xs font-medium text-primary">
                    <span>{chip.label ? <span className="font-semibold">{chip.label}:&nbsp;</span> : null}{chip.value}</span>
                    <button
                      type="button"
                      onClick={chip.onRemove}
                      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-primary/70 transition-colors hover:bg-primary/20 hover:text-primary"
                      title="Quitar este filtro"
                      aria-label={`Quitar filtro ${chip.value}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className={`grid w-full gap-x-4 gap-y-1 pt-1.5 ${showCollectionsGallery || showDishTypesGallery || showCategoriesGallery || showSourcesGallery || showTagsGallery ? 'grid-cols-[1fr_auto_auto]' : 'grid-cols-[1fr_auto_auto_auto]'}`}>
            {/* Search input (multi-palabra: escrib? y Enter agrega una palabra clave) */}
            <div className={`flex flex-col gap-1 ${showCollectionsGallery || showDishTypesGallery ? 'col-span-1' : 'col-span-1'} ml-0 md:ml-1 xl:ml-2`}>
              <div className={`toolbar-search-field relative rounded-md border border-input bg-background transition-all duration-200 hover:scale-105 hover:shadow-md ${showCollectionsGallery || showDishTypesGallery || showCategoriesGallery || showSourcesGallery || showTagsGallery ? 'md:w-full xl:w-[330px]' : 'md:w-full xl:w-[330px]'}`}>
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={showCollectionsGallery ? "Buscar coleccion" : showDishTypesGallery ? "Buscar tipo de comida" : showCategoriesGallery ? "Buscar categoria" : showSourcesGallery ? "Buscar fuente" : showTagsGallery ? "Buscar por etiqueta" : "Buscar por receta, ingrediente, etc"}
                  title="Escribi una palabra o frase y pulsa Enter para agregarla. Podes sumar varias."
                  value={searchTerm}
                  onChange={(e) => { if (e.target.value && !showCollectionsGallery && !showDishTypesGallery && !showCategoriesGallery && !showSourcesGallery && !showTagsGallery) { setShowCategoriesGallery(false); setShowSourcesGallery(false); setShowDishTypesGallery(false); setShowTagsGallery(false); setShowAuthorsGallery(false); } setSearchTerm(e.target.value); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const term = searchTerm.trim();
                      const inGallery = showCollectionsGallery || showDishTypesGallery || showCategoriesGallery || showSourcesGallery || showTagsGallery;
                      if (term && !inGallery) {
                        setSearchTerms(prev => prev.some(t => t.toLowerCase() === term.toLowerCase()) ? prev : [...prev, term]);
                        setSearchTerm('');
                      }
                    }
                  }}
                  className="h-full w-full border-0 bg-transparent pl-10 pr-9 font-medium shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Borrar busqueda"
                    title="Borrar busqueda"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {/* Palabras clave agregadas */}
              {searchTerms.length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  {searchTerms.map((term, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-0.5 pl-2 pr-1 text-xs font-medium text-primary">
                      {term}
                      <button
                        type="button"
                        onClick={() => setSearchTerms(prev => prev.filter((_, idx) => idx !== i))}
                        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-primary/70 transition-colors hover:bg-primary/20 hover:text-primary"
                        aria-label={`Quitar ${term}`}
                        title="Quitar"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSearchTerms([])}
                    className="ml-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  >
                    Limpiar
                  </button>
                </div>
              )}
            </div>

            {/* Nueva Receta button - only show in recipes view */}
            {!showCollectionsGallery && !showDishTypesGallery && !showCategoriesGallery && !showSourcesGallery && !showTagsGallery && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="toolbar-new-button px-4 transition-all duration-200 hover:scale-105 hover:shadow-md whitespace-nowrap row-start-2 col-start-1 w-full xl:w-[330px] flex items-center justify-start ml-0 md:ml-1 xl:ml-2 rounded-md">
                    <PlusCircle className="h-4 w-4 mr-2" />
                    <span>Nueva Receta</span>
                    <ChevronDown className="ml-auto h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => { navigate(`/app?accion=nueva&_=${Date.now()}`); }}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Nueva Receta
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { navigate(`/app?accion=importar&_=${Date.now()}`); }}>
                    <Download className="mr-2 h-4 w-4" />
                    Importar receta
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { navigate(`/app?accion=importar-texto&_=${Date.now()}`); }}>
                    <ClipboardPaste className="mr-2 h-4 w-4" />
                    Importar texto
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { navigate(`/app?accion=busqueda-inteligente&_=${Date.now()}`); }}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Buscador inteligente
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Column selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className={`h-10 px-2 transition-all duration-200 hover:scale-105 hover:shadow-md whitespace-nowrap col-start-2`}>
                  {viewMode === 'list' || viewMode === 'detail' || viewMode === 'ingredients' ? <List className="h-4 w-4" /> : getColumnIcon(gridColumns)}
                  <span className="ml-2">Ver</span>
                  <ChevronDown className="ml-1 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => { setViewMode('grid'); setGridColumns(1); }}
                  className={viewMode === 'grid' && gridColumns === 1 ? "bg-accent" : ""}
                >
                  <Square className="h-4 w-4 mr-2" />
                  1 columna
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => { setViewMode('grid'); setGridColumns(2); }}
                  className={`hidden sm:flex ${viewMode === 'grid' && gridColumns === 2 ? "bg-accent" : ""}`}
                >
                  <Grid2X2 className="h-4 w-4 mr-2" />
                  2 columnas
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => { setViewMode('grid'); setGridColumns(3); }}
                  className={`hidden sm:flex md:hidden xl:flex ${viewMode === 'grid' && gridColumns === 3 ? "bg-accent" : ""}`}
                >
                  <Grid3X3 className="h-4 w-4 mr-2" />
                  3 columnas
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => { setViewMode('grid'); setGridColumns(4); }}
                  className={`hidden xl:flex ${viewMode === 'grid' && gridColumns === 4 ? "bg-accent" : ""}`}
                >
                  <Grid className="h-4 w-4 mr-2" />
                  4 columnas
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => { setViewMode('grid'); setGridColumns(5); }}
                  className={`hidden xl:flex ${viewMode === 'grid' && gridColumns === 5 ? "bg-accent" : ""}`}
                >
                  <Columns className="h-4 w-4 mr-2" />
                  5 columnas
                </DropdownMenuItem>
                {!inGallery && (
                  <DropdownMenuItem
                    onClick={() => setViewMode('detail')}
                    className={`hidden sm:flex ${viewMode === 'detail' ? "bg-accent" : ""}`}
                  >
                    <ListChecks className="h-4 w-4 mr-2" />
                    Detalles
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => setViewMode('list')}
                  className={viewMode === 'list' ? "bg-accent" : ""}
                >
                  <List className="h-4 w-4 mr-2" />
                  Lista
                </DropdownMenuItem>
                {!inGallery && (
                  <DropdownMenuItem
                    onClick={() => setViewMode('ingredients')}
                    className={`hidden sm:flex ${viewMode === 'ingredients' ? "bg-accent" : ""}`}
                  >
                    <UtensilsCrossed className="h-4 w-4 mr-2" />
                    Ingredientes
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            {/* Sort selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className={`h-10 px-2 transition-all duration-200 hover:scale-105 hover:shadow-md whitespace-nowrap col-start-3`}>
                  <ArrowUpDown className="h-4 w-4" />
                  <span className="ml-2">Ordenar</span>
                  <ChevronDown className="ml-1 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {showCollectionsGallery ? (
                  ([
                    { key: 'name' as const, label: 'Nombre' },
                    { key: 'count' as const, label: 'Cantidad de recetas' },
                  ]).map(({ key, label }) => {
                    const isActive = collectionSort === key;
                    return (
                      <DropdownMenuItem
                        key={key}
                        onSelect={(event) => event.preventDefault()}
                        onClick={() => {
                          if (isActive) {
                            setCollectionSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
                          } else {
                            setCollectionSort(key);
                            setCollectionSortDirection('asc');
                          }
                        }}
                        className={`flex items-center ${isActive ? "bg-accent" : ""}`}
                      >
                        <Check className={`mr-2 h-4 w-4 ${isActive ? 'opacity-100' : 'opacity-0'}`} />
                        <span className="flex-1">{label}</span>
                        {isActive ? (
                          collectionSortDirection === 'asc'
                            ? <ArrowUp className="ml-2 h-4 w-4" />
                            : <ArrowDown className="ml-2 h-4 w-4" />
                        ) : (
                          <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />
                        )}
                      </DropdownMenuItem>
                    );
                  })
                ) : showSourcesGallery ? (
                  ([
                    { key: 'name' as const, label: 'Nombre' },
                    { key: 'count' as const, label: 'Cantidad de recetas' },
                  ]).map(({ key, label }) => {
                    const isActive = sourceSort === key;
                    return (
                      <DropdownMenuItem
                        key={key}
                        onSelect={(event) => event.preventDefault()}
                        onClick={() => {
                          if (isActive) {
                            setSourceSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
                          } else {
                            setSourceSort(key);
                            setSourceSortDirection('asc');
                          }
                        }}
                        className={`flex items-center ${isActive ? "bg-accent" : ""}`}
                      >
                        <Check className={`mr-2 h-4 w-4 ${isActive ? 'opacity-100' : 'opacity-0'}`} />
                        <span className="flex-1">{label}</span>
                        {isActive ? (
                          sourceSortDirection === 'asc'
                            ? <ArrowUp className="ml-2 h-4 w-4" />
                            : <ArrowDown className="ml-2 h-4 w-4" />
                        ) : (
                          <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />
                        )}
                      </DropdownMenuItem>
                    );
                  })
                ) : showTagsGallery ? (
                  ([
                    { key: 'name' as const, label: 'Nombre' },
                    { key: 'count' as const, label: 'Cantidad de recetas' },
                  ]).map(({ key, label }) => {
                    const isActive = tagSort === key;
                    return (
                      <DropdownMenuItem
                        key={key}
                        onSelect={(event) => event.preventDefault()}
                        onClick={() => {
                          if (isActive) {
                            setTagSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
                          } else {
                            setTagSort(key);
                            setTagSortDirection('asc');
                          }
                        }}
                        className={`flex items-center ${isActive ? "bg-accent" : ""}`}
                      >
                        <Check className={`mr-2 h-4 w-4 ${isActive ? 'opacity-100' : 'opacity-0'}`} />
                        <span className="flex-1">{label}</span>
                        {isActive ? (
                          tagSortDirection === 'asc'
                            ? <ArrowUp className="ml-2 h-4 w-4" />
                            : <ArrowDown className="ml-2 h-4 w-4" />
                        ) : (
                          <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />
                        )}
                      </DropdownMenuItem>
                    );
                  })
                ) : showCategoriesGallery ? (
                  ([
                    { key: 'name' as const, label: 'Nombre' },
                    { key: 'count' as const, label: 'Cantidad de recetas' },
                  ]).map(({ key, label }) => {
                    const isActive = categorySort === key;
                    return (
                      <DropdownMenuItem
                        key={key}
                        onSelect={(event) => event.preventDefault()}
                        onClick={() => {
                          if (isActive) {
                            setCategorySortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
                          } else {
                            setCategorySort(key);
                            setCategorySortDirection('asc');
                          }
                        }}
                        className={`flex items-center ${isActive ? "bg-accent" : ""}`}
                      >
                        <Check className={`mr-2 h-4 w-4 ${isActive ? 'opacity-100' : 'opacity-0'}`} />
                        <span className="flex-1">{label}</span>
                        {isActive ? (
                          categorySortDirection === 'asc'
                            ? <ArrowUp className="ml-2 h-4 w-4" />
                            : <ArrowDown className="ml-2 h-4 w-4" />
                        ) : (
                          <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />
                        )}
                      </DropdownMenuItem>
                    );
                  })
                ) : showDishTypesGallery ? (
                  ([
                    { key: 'name' as const, label: 'Nombre' },
                    { key: 'count' as const, label: 'Cantidad de recetas' },
                  ]).map(({ key, label }) => {
                    const isActive = dishTypeSort === key;
                    return (
                      <DropdownMenuItem
                        key={key}
                        onSelect={(event) => event.preventDefault()}
                        onClick={() => {
                          if (isActive) {
                            setDishTypeSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
                          } else {
                            setDishTypeSort(key);
                            setDishTypeSortDirection('asc');
                          }
                        }}
                        className={`flex items-center ${isActive ? "bg-accent" : ""}`}
                      >
                        <Check className={`mr-2 h-4 w-4 ${isActive ? 'opacity-100' : 'opacity-0'}`} />
                        <span className="flex-1">{label}</span>
                        {isActive ? (
                          dishTypeSortDirection === 'asc'
                            ? <ArrowUp className="ml-2 h-4 w-4" />
                            : <ArrowDown className="ml-2 h-4 w-4" />
                        ) : (
                          <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />
                        )}
                      </DropdownMenuItem>
                    );
                  })
                ) : (
                  (Object.keys(SORT_LABELS) as RecipeSort[]).map((sort) => {
                  const isActive = recipeSort === sort;
                  return (
                    <DropdownMenuItem
                      key={sort}
                      onSelect={(event) => event.preventDefault()}
                      onClick={() => {
                        if (isActive) {
                          setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
                        } else {
                          setRecipeSort(sort);
                          setSortDirection('asc');
                        }
                      }}
                      className={`flex items-center ${isActive ? "bg-accent" : ""}`}
                    >
                      <Check className={`mr-2 h-4 w-4 ${isActive ? 'opacity-100' : 'opacity-0'}`} />
                      <span className="flex-1">{SORT_LABELS[sort]}</span>
                      {isActive ? (
                        sortDirection === 'asc'
                          ? <ArrowUp className="ml-2 h-4 w-4" />
                          : <ArrowDown className="ml-2 h-4 w-4" />
                      ) : (
                        <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />
                      )}
                    </DropdownMenuItem>
                  );
                  })
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            {/* Filter button (no aplica en colecciones) */}
            <Button
              variant={showFilters ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setShowFilters(prev => !prev);
                setActiveBulkPanel(null);
                setSelectedRecipeIds(new Set());
              }}
              className={`h-10 transition-all duration-200 hover:scale-105 hover:shadow-md col-start-4 ${showCollectionsGallery || showDishTypesGallery || showCategoriesGallery || showSourcesGallery || showTagsGallery ? 'hidden' : ''}`}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filtrar
              <ChevronDown className={`h-4 w-4 ml-2 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </Button>
            {/* Salto de fila ANTES de Editar (vista de recetas): fila 1 Buscar/Ver/Ordenar/Filtrar;
                fila 2 Editar/Imprimir/Eliminar. */}
            <div className="hidden" aria-hidden="true" />
            {/* Segunda fila: Editar, Imprimir, Eliminar. */}
            <div className="hidden" aria-hidden="true" />
            <Button
              variant={activeBulkPanel === 'edit' ? "default" : "outline"}
              size="sm"
              className={`h-10 transition-all duration-200 hover:scale-105 hover:shadow-md row-start-2 col-start-2 ${showCollectionsGallery || showDishTypesGallery || showCategoriesGallery || showSourcesGallery || showTagsGallery ? 'hidden' : ''}`}
              onClick={() => {
                if (activeBulkPanel === 'edit') {
                  setActiveBulkPanel(null);
                  setSelectedRecipeIds(new Set());
                } else {
                  setActiveBulkPanel('edit');
                  setShowFilters(false);
                }
              }}
            >
              <Edit className="h-4 w-4 mr-2" />
              Editar
              <ChevronDown className={`h-4 w-4 ml-2 transition-transform ${activeBulkPanel === 'edit' ? 'rotate-180' : ''}`} />
            </Button>
            <Button
              variant={activeBulkPanel === 'print' ? "default" : "outline"}
              size="sm"
              className={`h-10 px-2 transition-all duration-200 hover:scale-105 hover:shadow-md whitespace-nowrap row-start-2 col-start-3 ${showCollectionsGallery || showDishTypesGallery || showCategoriesGallery || showSourcesGallery || showTagsGallery ? 'row-start-2 col-start-2' : ''}`}
              onClick={() => {
                if (activeBulkPanel === 'print') {
                  setActiveBulkPanel(null);
                  setSelectedRecipeIds(new Set());
                } else {
                  setActiveBulkPanel('print');
                  setShowFilters(false);
                }
              }}
            >
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
              <ChevronDown className={`h-4 w-4 ml-2 transition-transform ${activeBulkPanel === 'print' ? 'rotate-180' : ''}`} />
            </Button>
            <Button
              variant={activeBulkPanel === 'delete' ? "default" : "outline"}
              size="sm"
              className={`h-10 px-2 transition-all duration-200 hover:scale-105 hover:shadow-md whitespace-nowrap row-start-2 col-start-4 ${showCollectionsGallery || showDishTypesGallery || showCategoriesGallery || showSourcesGallery || showTagsGallery ? 'row-start-2 col-start-3' : ''}`}
              onClick={() => {
                if (activeBulkPanel === 'delete') {
                  setActiveBulkPanel(null);
                  setSelectedRecipeIds(new Set());
                } else {
                  setActiveBulkPanel('delete');
                  setShowFilters(false);
                }
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
              <ChevronDown className={`h-4 w-4 ml-2 transition-transform ${activeBulkPanel === 'delete' ? 'rotate-180' : ''}`} />
            </Button>
            {showCollectionsGallery && (
              <Button
                variant="outline"
                size="sm"
                className="toolbar-new-button px-4 transition-all duration-200 hover:scale-105 hover:shadow-md whitespace-nowrap row-start-2 col-start-1 w-full xl:w-[330px] flex items-center justify-start ml-0 md:ml-1 xl:ml-2 rounded-md"
                onClick={() => { setNewCollectionName(''); setShowNewCollectionDialog(true); }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nueva coleccion
              </Button>
            )}
            {showDishTypesGallery && (
              <Button
                variant="outline"
                size="sm"
                className="toolbar-new-button px-4 transition-all duration-200 hover:scale-105 hover:shadow-md whitespace-nowrap row-start-2 col-start-1 w-full xl:w-[330px] flex items-center justify-start ml-0 md:ml-1 xl:ml-2 rounded-md"
                onClick={() => { resetNewDishTypeDialog(); setShowNewDishTypeDialog(true); }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nuevo tipo de comida
              </Button>
            )}
            {showCategoriesGallery && (
              <Button
                variant="outline"
                size="sm"
                className="toolbar-new-button px-4 transition-all duration-200 hover:scale-105 hover:shadow-md whitespace-nowrap row-start-2 col-start-1 w-full xl:w-[330px] flex items-center justify-start ml-0 md:ml-1 xl:ml-2 rounded-md"
                onClick={() => { resetNewCategoryDialog(); setShowNewCategoryDialog(true); }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nueva categoria
              </Button>
            )}
            {showSourcesGallery && (
              <Button
                variant="outline"
                size="sm"
                className="toolbar-new-button px-4 transition-all duration-200 hover:scale-105 hover:shadow-md whitespace-nowrap row-start-2 col-start-1 w-full xl:w-[330px] flex items-center justify-start ml-0 md:ml-1 xl:ml-2 rounded-md"
                onClick={() => { resetNewSourceDialog(); setShowNewSourceDialog(true); }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nueva fuente
              </Button>
            )}
            {showTagsGallery && (
              <Button
                variant="outline"
                size="sm"
                className="toolbar-new-button px-4 transition-all duration-200 hover:scale-105 hover:shadow-md whitespace-nowrap row-start-2 col-start-1 w-full xl:w-[330px] flex items-center justify-start ml-0 md:ml-1 xl:ml-2 rounded-md"
                onClick={() => { resetNewTagDialog(); setShowNewTagDialog(true); }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nueva etiqueta
              </Button>
            )}
          </div>
        </div>

        {/* Horizontal Filter Panel */}
        {showFilters && (
            <div
              className="sticky z-30 max-h-[calc(100vh-10rem)] overflow-y-auto bg-muted rounded-lg px-4 pt-1.5 pb-3 mb-4 shadow-sm"
              style={{ top: 'calc(var(--tastebox-header-height, 113px) + var(--tastebox-recipe-toolbar-height, 75px))' }}
            >
              <div className="flex items-center justify-between -mb-2">
                <h3 className="font-medium text-foreground">Filtros</h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant={hasActiveFilters ? "default" : "ghost"}
                    size="sm"
                    onClick={handleClearFilters}
                    className="h-8 px-3 text-[13px]"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Quitar filtros
                  </Button>
                  <button
                    type="button"
                    onClick={() => setShowFilters(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Cerrar filtros"
                    title="Cerrar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Fila 1: Coleccion + Tipo de comida + Categorias (renglon 1) / Fuente + Etiquetas + Ingredientes (renglon 2) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-3 gap-y-0 [&_button]:text-[13px] [&_input]:text-[13px] [&_.justify-between]:h-9 [&_input]:h-9">
                <div>
                  <div className="-mb-1.5 flex items-center justify-between">
                    <Label className="text-[13px] font-medium">Coleccion</Label>
                    {filters.collectionId && (
                      <button type="button" onClick={() => handleFiltersChange({ ...filters, collectionId: undefined })} className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Limpiar" title="Limpiar">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <Select
                    value={filters.collectionId || "all"}
                    onValueChange={(value) => handleFiltersChange({
                      ...filters,
                      collectionId: value === "all" ? undefined : value,
                    })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Todas las colecciones" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las colecciones</SelectItem>
                      {collections.map(collection => (
                        <SelectItem key={collection.id} value={collection.id}>
                          <span className="flex items-center gap-2">
                            <Bookmark className="h-4 w-4" />
                            {collection.name} ({collection.recipeCount})
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <div className="-mb-1.5 flex items-center justify-between">
                    <Label className="text-[13px] font-medium">Tipo de comida</Label>
                    {(!!filters.dishTypes?.length || filters.dishType) && (
                      <button type="button" onClick={() => handleFiltersChange({ ...filters, dishType: undefined, dishTypes: [] })} className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Limpiar" title="Limpiar">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <MultiSelectCombobox
                    options={dishTypeList.map(dt => dt.name)}
                    selected={[...(filters.dishTypes || []), ...(filters.dishType ? [filters.dishType] : [])]}
                    onChange={(newTypes) => handleFiltersChange({ ...filters, dishTypes: newTypes, dishType: undefined })}
                    placeholder="Filtrar por tipo de comida"
                    searchPlaceholder="Buscar tipo..."
                    closeOnSelect
                  />
                </div>

                <div>
                  <div className="-mb-1.5 flex items-center justify-between">
                    <Label className="text-[13px] font-medium">Categorias</Label>
                    {filters.recipeTypes.length > 0 && (
                      <button type="button" onClick={() => handleFiltersChange({ ...filters, recipeTypes: [] })} className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Limpiar" title="Limpiar">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <MultiSelectCombobox
                    options={categories}
                    selected={filters.recipeTypes}
                    onChange={(newTypes) => handleFiltersChange({ ...filters, recipeTypes: newTypes })}
                    placeholder="Filtrar por categoria"
                    searchPlaceholder="Buscar categoria..."
                    closeOnSelect
                  />
                </div>

                <div>
                  <div className="-mb-1.5 flex items-center justify-between">
                    <Label className="text-[13px] font-medium">Fuente</Label>
                    {!!filters.sources?.length && (
                      <button type="button" onClick={() => handleFiltersChange({ ...filters, sources: undefined })} className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Limpiar" title="Limpiar">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <Select
                    value={filters.sources?.[0] || "all"}
                    onValueChange={(value) => handleFiltersChange({ ...filters, sources: value === "all" ? undefined : [value] })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Filtrar por fuente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las fuentes</SelectItem>
                      {Array.from(new Set(
                        recipes
                          .map(recipe => getRecipeSource(recipe))
                          .filter(source => source.length > 0)
                      )).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' })).map(source => (
                        <SelectItem key={source} value={source}>{source}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <div className="-mb-1.5 flex items-center justify-between">
                    <Label className="text-[13px] font-medium">Etiquetas</Label>
                    {filters.tags.length > 0 && (
                      <button type="button" onClick={() => handleFiltersChange({ ...filters, tags: [] })} className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Limpiar" title="Limpiar">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <MultiSelectCombobox
                    options={Array.from(new Set(
                      recipes.flatMap(recipe =>
                        recipe.tags.map(tag => typeof tag === 'string' ? tag : tag.tag || tag.name || '')
                      ).filter(tag => tag.length > 0)
                    )).sort()}
                    selected={filters.tags}
                    onChange={(newTags) => handleFiltersChange({ ...filters, tags: newTags })}
                    placeholder="Filtrar por etiqueta"
                    searchPlaceholder="Buscar etiqueta..."
                    closeOnSelect
                  />
                </div>

                <div>
                  <div className="-mb-1.5 flex items-center justify-between">
                    <Label className="text-[13px] font-medium">Ingredientes</Label>
                    {!!filters.ingredients?.length && (
                      <button type="button" onClick={() => handleFiltersChange({ ...filters, ingredients: [] })} className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Limpiar" title="Limpiar">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <FilterAutocompleteInput
                    options={Array.from(new Set(
                      recipes.flatMap(recipe =>
                        (recipe.ingredients || []).map(ingredient => ingredient.name.trim())
                      ).filter(Boolean)
                    )).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))}
                    selected={filters.ingredients || []}
                    onChange={(next) => handleFiltersChange({ ...filters, ingredients: next })}
                    placeholder="Escribir ingrediente..."
                  />
                </div>
              </div>

              {/* Toggles (Favoritos, Cocinadas, Thermomix, etc.) al final del bloque: 4 y 4 en iPad */}
              <div className="mt-2 grid grid-cols-2 justify-items-center gap-2 sm:grid-cols-4 xl:grid-cols-6 [&>button]:w-[94%] [&>button]:px-2 [&>button]:text-[13px]">
                <Button
                  variant={filters.featured === true ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleFiltersChange({ ...filters, featured: filters.featured === true ? undefined : true })}
                  className="h-8"
                >
                  <Heart className={`h-4 w-4 mr-2 ${filters.featured === true ? 'fill-current' : ''}`} />
                  Favoritos
                </Button>
                <Button
                  variant={filters.cookedOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleFiltersChange({ ...filters, cookedOnly: filters.cookedOnly ? undefined : true })}
                  className="h-8 [&_svg]:!h-6 [&_svg]:!w-6"
                >
                  <RecipePreparedIcon className="mr-2" />
                  Cocinadas
                </Button>
                <Button
                  variant={filters.thermomixOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleFiltersChange({ ...filters, thermomixOnly: filters.thermomixOnly ? undefined : true })}
                  className="h-8"
                >
                  <img
                    src="/thermomix-logo.transparent.png"
                    alt=""
                    aria-hidden="true"
                    className="mr-1 h-6 w-6 object-contain"
                  />
                  Thermomix
                </Button>
                <Button
                  variant={filters.airFryerOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleFiltersChange({ ...filters, airFryerOnly: filters.airFryerOnly ? undefined : true })}
                  className="h-8"
                >
                  <img
                    src="/air-fryer.transparent.png"
                    alt=""
                    aria-hidden="true"
                    className="mr-2 h-5 w-5 object-contain"
                  />
                  Air Fryer
                </Button>
                <Button
                  variant={filters.glutenFreeOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleFiltersChange({ ...filters, glutenFreeOnly: filters.glutenFreeOnly ? undefined : true })}
                  className="h-8"
                >
                  <WheatOff className="h-4 w-4 mr-2" />
                  Sin Gluten
                </Button>
                <Button
                  variant={filters.sugarFreeOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleFiltersChange({ ...filters, sugarFreeOnly: filters.sugarFreeOnly ? undefined : true })}
                  className="h-8"
                >
                  <CandyOff className="h-4 w-4 mr-2" />
                  Sin Azucar
                </Button>
                <Button
                  variant={filters.ketoOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleFiltersChange({ ...filters, ketoOnly: filters.ketoOnly ? undefined : true })}
                  className="h-8 [&_svg]:!h-6 [&_svg]:!w-6"
                >
                  <AvocadoIcon className="mr-2" />
                  Keto
                </Button>
                <Button
                  variant={filters.lowCarbOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleFiltersChange({ ...filters, lowCarbOnly: filters.lowCarbOnly ? undefined : true })}
                  className="h-8"
                >
                  <img
                    src="/logo-saludable.png"
                    alt=""
                    aria-hidden="true"
                    className={`mr-2 h-5 w-5 object-contain ${filters.lowCarbOnly ? '' : 'grayscale opacity-70'}`}
                  />
                  Low Carb
                </Button>
                <Button
                  variant={filters.proteicaOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleFiltersChange({ ...filters, proteicaOnly: filters.proteicaOnly ? undefined : true })}
                  className="h-8"
                >
                  <Beef className="h-4 w-4 mr-2" />
                  Proteicas
                </Button>
                <Button
                  variant={filters.vegetarianOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleFiltersChange({
                    ...filters,
                    vegetarianOnly: filters.vegetarianOnly ? undefined : true,
                  })}
                  className="h-8"
                >
                  <Leaf className="h-4 w-4 mr-2" />
                  Vegetarianas
                </Button>
                <Button
                  variant={filters.sweetOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleFiltersChange({ ...filters, sweetOnly: filters.sweetOnly ? undefined : true })}
                  className="h-8"
                >
                  <CakeSlice className="h-4 w-4 mr-2" />
                  Recetas Dulces
                </Button>
                <Button
                  variant={filters.savoryOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleFiltersChange({ ...filters, savoryOnly: filters.savoryOnly ? undefined : true })}
                  className="h-8"
                >
                  <Utensils className="h-4 w-4 mr-2" />
                  Recetas Saladas
                </Button>
              </div>
            </div>
        )}

        {/* Panel de impresion de COLECCIONES */}
        {showCollectionsGallery && activeBulkPanel === 'print' && (
            <div
              className="relative sticky z-30 bg-muted rounded-lg px-4 py-3 mb-4 shadow-sm"
              style={{ top: 'calc(var(--tastebox-header-height, 113px) + var(--tastebox-recipe-toolbar-height, 75px))' }}
            >
              <button
                type="button"
                onClick={() => { setActiveBulkPanel(null); setSelectedCollectionBulkIds(new Set()); }}
                className="absolute right-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                aria-label="Cerrar acciones"
                title="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="relative flex items-center justify-center px-8">
                <div className="absolute left-0 top-1/2 hidden -translate-y-1/2 lg:block">
                  <h3 className="flex items-center gap-2 font-medium text-foreground">
                    <Printer className="h-4 w-4" />
                    Imprimir colecciones
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedCollectionBulkIds.size
                      ? `${selectedCollectionBulkIds.size} coleccion${selectedCollectionBulkIds.size > 1 ? "es seleccionadas" : " seleccionada"}`
                      : "Selecciona las colecciones"}
                  </p>
                </div>
                <div className="flex flex-col gap-4">
                  {/* Fila 1: seleccion */}
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-auto text-xs sm:w-44 xl:w-48"
                      onClick={handleSelectAllCollections}
                      disabled={collections.length === 0}
                    >
                      <ListChecks className="mr-2 h-4 w-4 shrink-0" />
                      {(() => {
                        const allSel = collections.length > 0 && collections.every(c => selectedCollectionBulkIds.has(c.id));
                        return allSel ? "Quitar todas" : "Seleccionar todas";
                      })()}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-auto px-2 text-xs sm:w-44 sm:px-3 xl:w-48"
                      onClick={() => setSelectedCollectionBulkIds(new Set())}
                      disabled={selectedCollectionBulkIds.size === 0}
                      title="Quitar seleccion"
                      aria-label="Quitar seleccion"
                    >
                      <X className="h-4 w-4 shrink-0 sm:mr-2" />
                      <span className="hidden sm:inline">Quitar seleccion</span>
                    </Button>
                  </div>
                  {/* Fila 2: imprimir tarjetas / lista */}
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-auto text-xs sm:w-44 xl:w-48"
                      onClick={handleBulkPrintCollectionCards}
                      disabled={selectedCollectionBulkIds.size === 0}
                    >
                      <Printer className="mr-2 h-4 w-4" />
                      Imprimir tarjetas
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-auto text-xs sm:w-44 xl:w-48"
                      onClick={handleBulkPrintCollectionList}
                      disabled={selectedCollectionBulkIds.size === 0}
                    >
                      <List className="mr-2 h-4 w-4" />
                      Imprimir lista
                    </Button>
                  </div>
                </div>
              </div>
            </div>
        )}

        {/* Panel de eliminacion de COLECCIONES */}
        {showCollectionsGallery && activeBulkPanel === 'delete' && (
            <div
              className="relative sticky z-30 bg-muted rounded-lg px-4 py-3 mb-4 shadow-sm"
              style={{ top: 'calc(var(--tastebox-header-height, 113px) + var(--tastebox-recipe-toolbar-height, 75px))' }}
            >
              <button
                type="button"
                onClick={() => { setActiveBulkPanel(null); setSelectedCollectionBulkIds(new Set()); }}
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Cerrar acciones"
                title="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="relative flex items-center justify-center px-8">
                <div className="absolute left-0 top-1/2 hidden -translate-y-1/2 lg:block">
                  <h3 className="flex items-center gap-2 font-medium text-foreground">
                    <Trash2 className="h-4 w-4" />
                    Eliminar colecciones
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedCollectionBulkIds.size
                      ? `${selectedCollectionBulkIds.size} coleccion${selectedCollectionBulkIds.size > 1 ? "es seleccionadas" : " seleccionada"}`
                      : "Selecciona las colecciones"}
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-auto text-xs sm:w-44 xl:w-48"
                    onClick={handleSelectAllCollections}
                    disabled={collections.length === 0}
                  >
                    <ListChecks className="mr-2 h-4 w-4 shrink-0" />
                    {(() => {
                      const allSel = collections.length > 0 && collections.every(c => selectedCollectionBulkIds.has(c.id));
                      return allSel ? "Quitar todas" : "Seleccionar todas";
                    })()}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-auto px-2 text-xs sm:w-44 sm:px-3 xl:w-48"
                    onClick={() => setSelectedCollectionBulkIds(new Set())}
                    disabled={selectedCollectionBulkIds.size === 0}
                    title="Quitar seleccion"
                    aria-label="Quitar seleccion"
                  >
                    <X className="h-4 w-4 shrink-0 sm:mr-2" />
                    <span className="hidden sm:inline">Quitar seleccion</span>
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="w-auto text-xs sm:w-44 xl:w-48"
                    onClick={() => setBulkDeleteCollectionsOpen(true)}
                    disabled={selectedCollectionBulkIds.size === 0}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar
                  </Button>
                </div>
              </div>
            </div>
        )}

        {/* Panel de impresion de TIPOS DE RECETA */}
        {showDishTypesGallery && activeBulkPanel === 'print' && (
            <div
              className="sticky z-[60] bg-muted rounded-lg px-4 py-3 mb-4 shadow-sm"
              style={{ top: 'calc(var(--tastebox-header-height, 113px) + var(--tastebox-recipe-toolbar-height, 75px))' }}
            >
              <button
                type="button"
                onClick={() => { setActiveBulkPanel(null); setSelectedDishTypeBulkNames(new Set()); }}
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Cerrar acciones"
                title="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="relative flex items-center justify-center px-8">
                <div className="absolute left-0 top-1/2 hidden -translate-y-1/2 lg:block">
                  <h3 className="flex items-center gap-2 font-medium text-foreground">
                    <Printer className="h-4 w-4" />
                    Imprimir tipos de comida
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedDishTypeBulkNames.size
                      ? `${selectedDishTypeBulkNames.size} tipo${selectedDishTypeBulkNames.size > 1 ? "s seleccionados" : " seleccionado"}`
                      : "Selecciona los tipos de comida"}
                  </p>
                </div>
                <div className="flex flex-col gap-4">
                  {/* Fila 1: seleccion */}
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-auto text-xs sm:w-44 xl:w-48"
                      onClick={handleSelectAllDishTypes}
                      disabled={dishTypeList.length === 0}
                    >
                      <ListChecks className="mr-2 h-4 w-4 shrink-0" />
                      {(() => {
                        const allSel = dishTypeList.length > 0 && dishTypeList.every(d => selectedDishTypeBulkNames.has(d.name));
                        return allSel ? "Quitar todos" : "Seleccionar todos";
                      })()}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-auto px-2 text-xs sm:w-44 sm:px-3 xl:w-48"
                      onClick={() => setSelectedDishTypeBulkNames(new Set())}
                      disabled={selectedDishTypeBulkNames.size === 0}
                      title="Quitar seleccion"
                      aria-label="Quitar seleccion"
                    >
                      <X className="h-4 w-4 shrink-0 sm:mr-2" />
                      <span className="hidden sm:inline">Quitar seleccion</span>
                    </Button>
                  </div>
                  {/* Fila 2: imprimir tarjetas / lista */}
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-auto text-xs sm:w-44 xl:w-48"
                      onClick={handleBulkPrintDishTypeCards}
                      disabled={selectedDishTypeBulkNames.size === 0}
                    >
                      <Printer className="mr-2 h-4 w-4" />
                      Imprimir tarjetas
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-auto text-xs sm:w-44 xl:w-48"
                      onClick={handleBulkPrintDishTypeList}
                      disabled={selectedDishTypeBulkNames.size === 0}
                    >
                      <List className="mr-2 h-4 w-4" />
                      Imprimir lista
                    </Button>
                  </div>
                </div>
              </div>
            </div>
        )}

        {/* Panel de eliminacion de TIPOS DE RECETA */}
        {showDishTypesGallery && activeBulkPanel === 'delete' && (
            <div
              className="sticky z-30 bg-muted rounded-lg px-4 py-3 mb-4 shadow-sm"
              style={{ top: 'calc(var(--tastebox-header-height, 113px) + var(--tastebox-recipe-toolbar-height, 75px))' }}
            >
              <button
                type="button"
                onClick={() => { setActiveBulkPanel(null); setSelectedDishTypeBulkNames(new Set()); }}
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Cerrar acciones"
                title="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="relative flex items-center justify-center px-8">
                <div className="absolute left-0 top-1/2 hidden -translate-y-1/2 lg:block">
                  <h3 className="flex items-center gap-2 font-medium text-foreground">
                    <Trash2 className="h-4 w-4" />
                    Eliminar tipos de comida
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedDishTypeBulkNames.size
                      ? `${selectedDishTypeBulkNames.size} tipo${selectedDishTypeBulkNames.size > 1 ? "s seleccionados" : " seleccionado"}`
                      : "Selecciona los tipos de comida"}
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-auto text-xs sm:w-44 xl:w-48"
                    onClick={handleSelectAllDishTypes}
                    disabled={dishTypeList.length === 0}
                  >
                    <ListChecks className="mr-2 h-4 w-4 shrink-0" />
                    {(() => {
                      const allSel = dishTypeList.length > 0 && dishTypeList.every(d => selectedDishTypeBulkNames.has(d.name));
                      return allSel ? "Quitar todos" : "Seleccionar todos";
                    })()}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-auto px-2 text-xs sm:w-44 sm:px-3 xl:w-48"
                    onClick={() => setSelectedDishTypeBulkNames(new Set())}
                    disabled={selectedDishTypeBulkNames.size === 0}
                    title="Quitar seleccion"
                    aria-label="Quitar seleccion"
                  >
                    <X className="h-4 w-4 shrink-0 sm:mr-2" />
                    <span className="hidden sm:inline">Quitar seleccion</span>
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="w-auto text-xs sm:w-44 xl:w-48"
                    onClick={() => setBulkDeleteDishTypesOpen(true)}
                    disabled={selectedDishTypeBulkNames.size === 0}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar
                  </Button>
                </div>
              </div>
            </div>
        )}

        {/* Panel de impresion de CATEGORIAS */}
        {showCategoriesGallery && activeBulkPanel === 'print' && (
            <div
              className="sticky z-30 bg-muted rounded-lg px-4 py-3 mb-4 shadow-sm"
              style={{ top: 'calc(var(--tastebox-header-height, 113px) + var(--tastebox-recipe-toolbar-height, 75px))' }}
            >
              <button
                type="button"
                onClick={() => { setActiveBulkPanel(null); setSelectedCategoryBulkNames(new Set()); }}
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Cerrar acciones"
                title="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="relative flex items-center justify-center px-8">
                <div className="absolute left-0 top-1/2 hidden -translate-y-1/2 lg:block">
                  <h3 className="flex items-center gap-2 font-medium text-foreground">
                    <Printer className="h-4 w-4" />
                    Imprimir categorias
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedCategoryBulkNames.size
                      ? `${selectedCategoryBulkNames.size} categoria${selectedCategoryBulkNames.size > 1 ? "s seleccionadas" : " seleccionada"}`
                      : "Selecciona las categorias"}
                  </p>
                </div>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-auto text-xs sm:w-44 xl:w-48"
                      onClick={handleSelectAllCategories}
                      disabled={categoryList.length === 0}
                    >
                      <ListChecks className="mr-2 h-4 w-4 shrink-0" />
                      {(() => {
                        const allSel = categoryList.length > 0 && categoryList.every(c => selectedCategoryBulkNames.has(c.name));
                        return allSel ? "Quitar todas" : "Seleccionar todas";
                      })()}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-auto px-2 text-xs sm:w-44 sm:px-3 xl:w-48"
                      onClick={() => setSelectedCategoryBulkNames(new Set())}
                      disabled={selectedCategoryBulkNames.size === 0}
                      title="Quitar seleccion"
                      aria-label="Quitar seleccion"
                    >
                      <X className="h-4 w-4 shrink-0 sm:mr-2" />
                      <span className="hidden sm:inline">Quitar seleccion</span>
                    </Button>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-auto text-xs sm:w-44 xl:w-48"
                      onClick={handleBulkPrintCategoryCards}
                      disabled={selectedCategoryBulkNames.size === 0}
                    >
                      <Printer className="mr-2 h-4 w-4" />
                      Imprimir tarjetas
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-auto text-xs sm:w-44 xl:w-48"
                      onClick={handleBulkPrintCategoryList}
                      disabled={selectedCategoryBulkNames.size === 0}
                    >
                      <List className="mr-2 h-4 w-4" />
                      Imprimir lista
                    </Button>
                  </div>
                </div>
              </div>
            </div>
        )}

        {/* Panel de eliminacion de CATEGORIAS */}
        {showCategoriesGallery && activeBulkPanel === 'delete' && (
            <div
              className="sticky z-30 bg-muted rounded-lg px-4 py-3 mb-4 shadow-sm"
              style={{ top: 'calc(var(--tastebox-header-height, 113px) + var(--tastebox-recipe-toolbar-height, 75px))' }}
            >
              <button
                type="button"
                onClick={() => { setActiveBulkPanel(null); setSelectedCategoryBulkNames(new Set()); }}
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Cerrar acciones"
                title="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="relative flex items-center justify-center px-8">
                <div className="absolute left-0 top-1/2 hidden -translate-y-1/2 lg:block">
                  <h3 className="flex items-center gap-2 font-medium text-foreground">
                    <Trash2 className="h-4 w-4" />
                    Eliminar categorias
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedCategoryBulkNames.size
                      ? `${selectedCategoryBulkNames.size} categoria${selectedCategoryBulkNames.size > 1 ? "s seleccionadas" : " seleccionada"}`
                      : "Selecciona las categorias"}
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-auto text-xs sm:w-44 xl:w-48"
                    onClick={handleSelectAllCategories}
                    disabled={categoryList.length === 0}
                  >
                    <ListChecks className="mr-2 h-4 w-4 shrink-0" />
                    {(() => {
                      const allSel = categoryList.length > 0 && categoryList.every(c => selectedCategoryBulkNames.has(c.name));
                      return allSel ? "Quitar todas" : "Seleccionar todas";
                    })()}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-auto px-2 text-xs sm:w-44 sm:px-3 xl:w-48"
                    onClick={() => setSelectedCategoryBulkNames(new Set())}
                    disabled={selectedCategoryBulkNames.size === 0}
                    title="Quitar seleccion"
                    aria-label="Quitar seleccion"
                  >
                    <X className="h-4 w-4 shrink-0 sm:mr-2" />
                    <span className="hidden sm:inline">Quitar seleccion</span>
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="w-auto text-xs sm:w-44 xl:w-48"
                    onClick={() => setBulkDeleteCategoriesOpen(true)}
                    disabled={selectedCategoryBulkNames.size === 0}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar
                  </Button>
                </div>
              </div>
            </div>
        )}

        {/* Panel de impresion de FUENTES */}
        {showSourcesGallery && activeBulkPanel === 'print' && (
            <div
              className="sticky z-30 bg-muted rounded-lg px-4 py-3 mb-4 shadow-sm"
              style={{ top: 'calc(var(--tastebox-header-height, 113px) + var(--tastebox-recipe-toolbar-height, 75px))' }}
            >
              <button
                type="button"
                onClick={() => { setActiveBulkPanel(null); setSelectedSourceBulkNames(new Set()); }}
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Cerrar acciones"
                title="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="relative flex items-center justify-center px-8">
                <div className="absolute left-0 top-1/2 hidden -translate-y-1/2 lg:block">
                  <h3 className="flex items-center gap-2 font-medium text-foreground">
                    <Printer className="h-4 w-4" />
                    Imprimir fuentes
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedSourceBulkNames.size
                      ? `${selectedSourceBulkNames.size} fuente${selectedSourceBulkNames.size > 1 ? "s seleccionadas" : " seleccionada"}`
                      : "Selecciona las fuentes"}
                  </p>
                </div>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-auto text-xs sm:w-44 xl:w-48"
                      onClick={handleSelectAllSources}
                      disabled={sourceList.length === 0}
                    >
                      <ListChecks className="mr-2 h-4 w-4 shrink-0" />
                      {(() => {
                        const allSel = sourceList.length > 0 && sourceList.every(s => selectedSourceBulkNames.has(s.name));
                        return allSel ? "Quitar todas" : "Seleccionar todas";
                      })()}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-auto px-2 text-xs sm:w-44 sm:px-3 xl:w-48"
                      onClick={() => setSelectedSourceBulkNames(new Set())}
                      disabled={selectedSourceBulkNames.size === 0}
                      title="Quitar seleccion"
                      aria-label="Quitar seleccion"
                    >
                      <X className="h-4 w-4 shrink-0 sm:mr-2" />
                      <span className="hidden sm:inline">Quitar seleccion</span>
                    </Button>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-auto text-xs sm:w-44 xl:w-48"
                      onClick={handleBulkPrintSourceCards}
                      disabled={selectedSourceBulkNames.size === 0}
                    >
                      <Printer className="mr-2 h-4 w-4" />
                      Imprimir tarjetas
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-auto text-xs sm:w-44 xl:w-48"
                      onClick={handleBulkPrintSourceList}
                      disabled={selectedSourceBulkNames.size === 0}
                    >
                      <List className="mr-2 h-4 w-4" />
                      Imprimir lista
                    </Button>
                  </div>
                </div>
              </div>
            </div>
        )}

        {/* Panel de eliminacion de FUENTES */}
        {showSourcesGallery && activeBulkPanel === 'delete' && (
            <div
              className="sticky z-30 bg-muted rounded-lg px-4 py-3 mb-4 shadow-sm"
              style={{ top: 'calc(var(--tastebox-header-height, 113px) + var(--tastebox-recipe-toolbar-height, 75px))' }}
            >
              <button
                type="button"
                onClick={() => { setActiveBulkPanel(null); setSelectedSourceBulkNames(new Set()); }}
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Cerrar acciones"
                title="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="relative flex items-center justify-center px-8">
                <div className="absolute left-0 top-1/2 hidden -translate-y-1/2 lg:block">
                  <h3 className="flex items-center gap-2 font-medium text-foreground">
                    <Trash2 className="h-4 w-4" />
                    Eliminar fuentes
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedSourceBulkNames.size
                      ? `${selectedSourceBulkNames.size} fuente${selectedSourceBulkNames.size > 1 ? "s seleccionadas" : " seleccionada"}`
                      : "Selecciona las fuentes"}
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-auto text-xs sm:w-44 xl:w-48"
                    onClick={handleSelectAllSources}
                    disabled={sourceList.length === 0}
                  >
                    <ListChecks className="mr-2 h-4 w-4 shrink-0" />
                    {(() => {
                      const allSel = sourceList.length > 0 && sourceList.every(s => selectedSourceBulkNames.has(s.name));
                      return allSel ? "Quitar todas" : "Seleccionar todas";
                    })()}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-auto px-2 text-xs sm:w-44 sm:px-3 xl:w-48"
                    onClick={() => setSelectedSourceBulkNames(new Set())}
                    disabled={selectedSourceBulkNames.size === 0}
                    title="Quitar seleccion"
                    aria-label="Quitar seleccion"
                  >
                    <X className="h-4 w-4 shrink-0 sm:mr-2" />
                    <span className="hidden sm:inline">Quitar seleccion</span>
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="w-auto text-xs sm:w-44 xl:w-48"
                    onClick={() => setBulkDeleteSourcesOpen(true)}
                    disabled={selectedSourceBulkNames.size === 0}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar
                  </Button>
                </div>
              </div>
            </div>
        )}

        {/* Panel de impresion de ETIQUETAS */}
        {showTagsGallery && activeBulkPanel === 'print' && (
            <div
              className="sticky z-30 bg-muted rounded-lg px-4 py-3 mb-4 shadow-sm"
              style={{ top: 'calc(var(--tastebox-header-height, 113px) + var(--tastebox-recipe-toolbar-height, 75px))' }}
            >
              <button
                type="button"
                onClick={() => { setActiveBulkPanel(null); setSelectedTagBulkNames(new Set()); }}
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Cerrar acciones"
                title="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="relative flex items-center justify-center px-8">
                <div className="absolute left-0 top-1/2 hidden -translate-y-1/2 lg:block">
                  <h3 className="flex items-center gap-2 font-medium text-foreground">
                    <Printer className="h-4 w-4" />
                    Imprimir etiquetas
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedTagBulkNames.size
                      ? `${selectedTagBulkNames.size} etiqueta${selectedTagBulkNames.size > 1 ? "s seleccionadas" : " seleccionada"}`
                      : "Selecciona las etiquetas"}
                  </p>
                </div>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-auto text-xs sm:w-44 xl:w-48"
                      onClick={handleSelectAllTags}
                      disabled={tagList.length === 0}
                    >
                      <ListChecks className="mr-2 h-4 w-4 shrink-0" />
                      {(() => {
                        const allSel = tagList.length > 0 && tagList.every(t => selectedTagBulkNames.has(t.name));
                        return allSel ? "Quitar todas" : "Seleccionar todas";
                      })()}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-auto px-2 text-xs sm:w-44 sm:px-3 xl:w-48"
                      onClick={() => setSelectedTagBulkNames(new Set())}
                      disabled={selectedTagBulkNames.size === 0}
                      title="Quitar seleccion"
                      aria-label="Quitar seleccion"
                    >
                      <X className="h-4 w-4 shrink-0 sm:mr-2" />
                      <span className="hidden sm:inline">Quitar seleccion</span>
                    </Button>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-auto text-xs sm:w-44 xl:w-48"
                      onClick={handleBulkPrintTagCards}
                      disabled={selectedTagBulkNames.size === 0}
                    >
                      <Printer className="mr-2 h-4 w-4" />
                      Imprimir tarjetas
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-auto text-xs sm:w-44 xl:w-48"
                      onClick={handleBulkPrintTagList}
                      disabled={selectedTagBulkNames.size === 0}
                    >
                      <List className="mr-2 h-4 w-4" />
                      Imprimir lista
                    </Button>
                  </div>
                </div>
              </div>
            </div>
        )}

        {/* Panel de eliminacion de ETIQUETAS */}
        {showTagsGallery && activeBulkPanel === 'delete' && (
            <div
              className="sticky z-30 bg-muted rounded-lg px-4 py-3 mb-4 shadow-sm"
              style={{ top: 'calc(var(--tastebox-header-height, 113px) + var(--tastebox-recipe-toolbar-height, 75px))' }}
            >
              <button
                type="button"
                onClick={() => { setActiveBulkPanel(null); setSelectedTagBulkNames(new Set()); }}
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Cerrar acciones"
                title="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="relative flex items-center justify-center px-8">
                <div className="absolute left-0 top-1/2 hidden -translate-y-1/2 lg:block">
                  <h3 className="flex items-center gap-2 font-medium text-foreground">
                    <Trash2 className="h-4 w-4" />
                    Eliminar etiquetas
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedTagBulkNames.size
                      ? `${selectedTagBulkNames.size} etiqueta${selectedTagBulkNames.size > 1 ? "s seleccionadas" : " seleccionada"}`
                      : "Selecciona las etiquetas"}
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-auto text-xs sm:w-44 xl:w-48"
                    onClick={handleSelectAllTags}
                    disabled={tagList.length === 0}
                  >
                    <ListChecks className="mr-2 h-4 w-4 shrink-0" />
                    {(() => {
                      const allSel = tagList.length > 0 && tagList.every(t => selectedTagBulkNames.has(t.name));
                      return allSel ? "Quitar todas" : "Seleccionar todas";
                    })()}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-auto px-2 text-xs sm:w-44 sm:px-3 xl:w-48"
                    onClick={() => setSelectedTagBulkNames(new Set())}
                    disabled={selectedTagBulkNames.size === 0}
                    title="Quitar seleccion"
                    aria-label="Quitar seleccion"
                  >
                    <X className="h-4 w-4 shrink-0 sm:mr-2" />
                    <span className="hidden sm:inline">Quitar seleccion</span>
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="w-auto text-xs sm:w-44 xl:w-48"
                    onClick={() => setBulkDeleteTagsOpen(true)}
                    disabled={selectedTagBulkNames.size === 0}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar
                  </Button>
                </div>
              </div>
            </div>
        )}

        {activeBulkPanel !== null && !showCollectionsGallery && !showDishTypesGallery && !showCategoriesGallery && !showSourcesGallery && !showTagsGallery && (
            <div
              className="sticky z-30 bg-muted rounded-lg px-4 py-3 mb-4 shadow-sm"
              style={{ top: 'calc(var(--tastebox-header-height, 113px) + var(--tastebox-recipe-toolbar-height, 75px))' }}
            >
              <button
                type="button"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  closeRecipeBulkPanel();
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  closeRecipeBulkPanel();
                }}
                className="absolute right-2 top-2 z-[70] flex h-8 w-8 items-center justify-center rounded-md bg-background/70 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                aria-label="Cerrar acciones"
                title="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="relative flex items-center justify-center px-8">
                <div className="absolute left-0 top-1/2 hidden -translate-y-1/2 lg:block">
                  <h3 className="flex items-center gap-2 font-medium text-foreground">
                    {activeBulkPanel === 'delete' ? <Trash2 className="h-4 w-4" /> : activeBulkPanel === 'edit' ? <Edit className="h-4 w-4" /> : <Printer className="h-4 w-4" />}
                    {activeBulkPanel === 'delete' ? 'Eliminar recetas' : activeBulkPanel === 'edit' ? 'Editar recetas' : 'Imprimir recetas'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedRecipeIds.size
                      ? `${selectedRecipeIds.size} receta${selectedRecipeIds.size > 1 ? "s seleccionadas" : " seleccionada"}`
                      : "Selecciona las recetas"}
                  </p>
                </div>
                <div className="flex flex-col gap-4">
                  {/* Fila 1: seleccion */}
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-auto text-xs sm:w-44 xl:w-48"
                      onClick={handleToggleAllVisibleRecipes}
                      disabled={filteredRecipes.length === 0 || bulkAction !== null}
                      title="Hace clic en las recetas deseadas. Si queres seleccionar varias, marca la primera, pulsi SHIFT y marca la ultima."
                    >
                      <Check className="mr-2 h-4 w-4 shrink-0" />
                      {(() => {
                        const allVisible = filteredRecipes.length > 0 && filteredRecipes.every(recipe => selectedRecipeIds.has(recipe.id));
                        return (
                          <>
                            <span className="sm:hidden">Recetas</span>
                            <span className="hidden sm:inline">{allVisible ? "Quitar recetas visibles" : "Seleccionar recetas visibles"}</span>
                          </>
                        );
                      })()}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-auto text-xs sm:w-44 xl:w-48"
                      onClick={handleSelectAllRecipes}
                      disabled={allFilteredRecipes.length === 0 || bulkAction !== null}
                      title="Hace clic en las recetas deseadas. Si queres seleccionar varias, marca la primera, pulsi SHIFT y marca la ultima."
                    >
                      <ListChecks className="mr-2 h-4 w-4 shrink-0" />
                      {(() => {
                        const allSel = allFilteredRecipes.length > 0 && allFilteredRecipes.every(recipe => selectedRecipeIds.has(recipe.id));
                        return (
                          <>
                            <span className="sm:hidden">Todas</span>
                            <span className="hidden sm:inline">{allSel ? "Quitar todas" : "Seleccionar todas"}</span>
                          </>
                        );
                      })()}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-auto px-2 text-xs sm:w-44 sm:px-3 xl:w-48"
                      onClick={() => setSelectedRecipeIds(new Set())}
                      disabled={selectedRecipeIds.size === 0 || bulkAction !== null}
                      title="Quitar seleccion"
                      aria-label="Quitar seleccion"
                    >
                      <X className="h-4 w-4 shrink-0 sm:mr-2" />
                      <span className="hidden sm:inline">Quitar seleccion</span>
                    </Button>
                  </div>
                  {/* Fila 2: acciones segun el panel (imprimir o eliminar), alineadas a la derecha */}
                  <div className="flex flex-wrap justify-center gap-2">
                    {activeBulkPanel === 'print' && (<>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-auto text-xs sm:w-44 xl:w-48"
                      onClick={handleBulkPrint}
                      disabled={selectedRecipeIds.size === 0 || bulkAction !== null}
                    >
                      {bulkAction === 'print'
                        ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        : <Printer className="mr-2 h-4 w-4" />}
                      <span className="sm:hidden">Recetas</span>
                      <span className="hidden sm:inline">Imprimir Recetas</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-auto text-xs sm:w-44 xl:w-48"
                      onClick={handleBulkPrintCards}
                      disabled={selectedRecipeIds.size === 0 || bulkAction !== null}
                    >
                      {bulkAction === 'print-cards'
                        ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        : <Printer className="mr-2 h-4 w-4" />}
                      <span className="sm:hidden">Tarjetas</span>
                      <span className="hidden sm:inline">Imprimir tarjetas</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-auto text-xs sm:w-44 xl:w-48"
                      onClick={handleBulkPrintList}
                      disabled={selectedRecipeIds.size === 0 || bulkAction !== null}
                    >
                      {bulkAction === 'print-list'
                        ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        : <List className="mr-2 h-4 w-4" />}
                      <span className="sm:hidden">Lista</span>
                      <span className="hidden sm:inline">Imprimir lista</span>
                    </Button>
                    </>)}
                    {activeBulkPanel === 'delete' && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="w-auto text-xs sm:w-44 xl:w-48"
                      onClick={() => setShowBulkDeleteDialog(true)}
                      disabled={selectedRecipeIds.size === 0 || bulkAction !== null}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Eliminar recetas
                    </Button>
                    )}
                    {activeBulkPanel === 'edit' && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-auto text-xs sm:w-56"
                      onClick={() => setShowBulkEditModal(true)}
                      disabled={selectedRecipeIds.size === 0 || bulkAction !== null}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Editar campos comunes
                    </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
        )}

        <div className={!showHero ? "flex flex-col gap-6 lg:flex-row lg:items-start" : ""}>
          {!showHero && !isItemWindow && (
            <aside
              className={`hidden ${showDesktopSidebar ? 'xl:block' : 'xl:hidden'} xl:w-64 xl:flex-shrink-0 xl:sticky xl:self-start xl:overflow-y-auto`}
              style={{
                top: 'calc(var(--tastebox-header-height, 113px) + var(--tastebox-recipe-toolbar-height, 101px) + 0.75rem)',
                maxHeight: 'calc(100vh - var(--tastebox-header-height, 113px) - var(--tastebox-recipe-toolbar-height, 101px) - 1.5rem)'
              }}
            >
              {collectionsSidebarNode}
            </aside>
          )}
          <div className="min-w-0 flex-1">

        {showCollectionsGallery ? (
          collections.length > 0 ? (
            viewMode === 'list' ? (
            <div className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
              {galleryCollections.map((collection) => {
                const cover = collectionCovers[collection.id];
                return (
                  <div key={collection.id} className={`flex items-center gap-3 px-3 py-1 transition-colors hover:bg-muted/50 ${collectionSelectionMode && selectedCollectionBulkIds.has(collection.id) ? 'bg-accent/60' : ''}`}>
                    {collectionSelectionMode && (
                      <button
                        type="button"
                        onClick={(e) => handleToggleCollectionSelection(collection.id, { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey })}
                        aria-label={selectedCollectionBulkIds.has(collection.id) ? 'Quitar seleccion' : 'Seleccionar coleccion'}
                        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${selectedCollectionBulkIds.has(collection.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40 text-transparent'}`}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        if (collectionSelectionMode) { handleToggleCollectionSelection(collection.id, { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey }); return; }
                        setShowCollectionsGallery(false);
                        handleFiltersChange({ ...filters, collectionId: collection.id, featured: undefined });
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="flex min-w-0 flex-1 items-center gap-3 py-1 text-left"
                    >
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                        {cover
                          ? <img src={cover} alt="" className="h-full w-full object-cover" />
                          : <Bookmark className="h-5 w-5 text-muted-foreground" />}
                      </span>
                      <span className="block min-w-0 flex-1 truncate font-medium text-foreground">
                        {collection.name} <span className="text-xs font-normal text-muted-foreground">({collection.recipeCount} receta{collection.recipeCount !== 1 ? 's' : ''})</span>
                      </span>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          aria-label="Opciones de la coleccion"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => window.open(`/?collection=${collection.id}`, '_blank')}
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Abrir coleccion en ventana nueva
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => openEditCollectionDialog(collection)}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Editar coleccion
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => openChangeCoverDialog(collection)}
                        >
                          <ImageIcon className="mr-2 h-4 w-4" />
                          Cambiar portada
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={() => setDeleteCollectionTarget(collection)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Eliminar coleccion
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </div>
            ) : (
            <div className={getGridClass()}>
              {galleryCollections.map((collection) => {
                const cover = collectionCovers[collection.id];
                return (
                  <div
                    key={collection.id}
                    className={`group relative overflow-hidden rounded-lg bg-gradient-card text-left shadow-recipe-card transition-transform hover:scale-[1.02] ${collectionSelectionMode && selectedCollectionBulkIds.has(collection.id) ? 'ring-2 ring-primary' : ''}`}
                  >
                    {collectionSelectionMode && (
                      <span className={`pointer-events-none absolute left-3 top-3 z-20 inline-flex h-6 w-6 items-center justify-center rounded-md border-2 ${selectedCollectionBulkIds.has(collection.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-white/70 bg-white/50 text-transparent'}`}>
                        <Check className="h-4 w-4" />
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        if (collectionSelectionMode) { handleToggleCollectionSelection(collection.id, { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey }); return; }
                        setShowCollectionsGallery(false);
                        handleFiltersChange({ ...filters, collectionId: collection.id, featured: undefined });
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="block w-full text-left"
                    >
                      <div className={`relative w-full overflow-hidden bg-muted ${gridColumns === 5 ? 'aspect-square' : 'h-48'}`}>
                        {cover ? (
                          <img
                            src={cover}
                            alt={collection.name}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <Bookmark className="h-10 w-10" />
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <h3 className="font-semibold text-foreground">{collection.name} <span className="text-sm font-normal text-muted-foreground">({collection.recipeCount})</span></h3>
                      </div>
                    </button>

                    {/* Men? de tres puntitos */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-3 top-3 z-20 inline-flex h-8 w-8 items-center justify-center rounded-md bg-white/50 text-gray-600 shadow-sm transition-colors hover:bg-white/70"
                          aria-label="Opciones de la coleccion"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => window.open(`/?collection=${collection.id}`, '_blank')}
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Abrir coleccion en ventana nueva
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => openEditCollectionDialog(collection)}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Editar coleccion
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => openChangeCoverDialog(collection)}
                        >
                          <ImageIcon className="mr-2 h-4 w-4" />
                          Cambiar portada
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={() => setDeleteCollectionTarget(collection)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Eliminar coleccion
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </div>
            )
          ) : (
            <div className="py-12 text-center">
              <Tag className="mx-auto mb-4 h-14 w-14 text-muted-foreground" />
              <h3 className="mb-2 text-xl font-semibold text-foreground">Todavia no tenes colecciones</h3>
              <p className="text-muted-foreground">Guarda recetas en una coleccion para verlas aca.</p>
            </div>
          )
        ) : showCategoriesGallery ? (
          galleryCategories.length > 0 ? (
            viewMode === 'list' ? (
            <div className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
              {galleryCategories.map((category) => (
                <div key={category.name} className={`flex items-center gap-3 px-3 py-1 transition-colors hover:bg-muted/50 ${categorySelectionMode && selectedCategoryBulkNames.has(category.name) ? 'bg-accent/60' : ''}`}>
                  {categorySelectionMode && (
                    <button
                      type="button"
                      onClick={(e) => handleToggleCategorySelection(category.name, { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey })}
                      aria-label={selectedCategoryBulkNames.has(category.name) ? 'Quitar seleccion' : 'Seleccionar categoria'}
                      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${selectedCategoryBulkNames.has(category.name) ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40 text-transparent'}`}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      if (categorySelectionMode) { handleToggleCategorySelection(category.name, { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey }); return; }
                      setShowCategoriesGallery(false);
                      saveRecentCategory(category.name);
                      handleFiltersChange({ ...filters, recipeTypes: [category.name] });
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="flex min-w-0 flex-1 items-center gap-3 py-1 text-left"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                      {category.cover
                        ? <img src={category.cover} alt="" className="h-full w-full object-cover" />
                        : <ChefHat className="h-5 w-5 text-muted-foreground" />}
                    </span>
                    <span className="block min-w-0 flex-1 truncate font-medium text-foreground">
                      {category.name} <span className="text-xs font-normal text-muted-foreground">({category.count} receta{category.count !== 1 ? 's' : ''})</span>
                    </span>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Opciones de la categoria">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => window.open(`/?categoria=${encodeURIComponent(category.name)}`, '_blank')}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Abrir categoria en ventana nueva
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => openEditGalleryDialog({ kind: 'category', name: category.name, cover: category.cover })}>
                        <Edit className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => { coverChangeCategoryName.current = category.name; categoryCoverInputRef.current?.click(); }}>
                        <ImageIcon className="mr-2 h-4 w-4" />
                        Cambiar portada
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setDeleteCategoryTarget(category.name)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
            ) : (
            <div className={getGridClass()}>
              {galleryCategories.map((category) => (
                <div
                  key={category.name}
                  className={`group relative overflow-hidden rounded-lg bg-gradient-card text-left shadow-recipe-card transition-transform hover:scale-[1.02] ${categorySelectionMode && selectedCategoryBulkNames.has(category.name) ? 'ring-2 ring-primary' : ''}`}
                >
                  {categorySelectionMode && (
                    <span className={`pointer-events-none absolute left-3 top-3 z-20 inline-flex h-6 w-6 items-center justify-center rounded-md border-2 ${selectedCategoryBulkNames.has(category.name) ? 'border-primary bg-primary text-primary-foreground' : 'border-white/70 bg-white/50 text-transparent'}`}>
                      <Check className="h-4 w-4" />
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      if (categorySelectionMode) { handleToggleCategorySelection(category.name, { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey }); return; }
                      setShowCategoriesGallery(false);
                      saveRecentCategory(category.name);
                      handleFiltersChange({ ...filters, recipeTypes: [category.name] });
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="block w-full text-left"
                  >
                    <div className="relative h-48 w-full overflow-hidden bg-muted">
                      {category.cover ? (
                        <img
                          src={category.cover}
                          alt={category.name}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <ChefHat className="h-10 w-10" />
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-foreground">{category.name} <span className="text-sm font-normal text-muted-foreground">({category.count})</span></h3>
                    </div>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-3 top-3 z-20 inline-flex h-8 w-8 items-center justify-center rounded-md bg-white/50 text-gray-600 shadow-sm transition-colors hover:bg-white/70"
                        aria-label="Opciones de la categoria"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => window.open(`/?categoria=${encodeURIComponent(category.name)}`, '_blank')}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Abrir categoria en ventana nueva
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => openEditGalleryDialog({ kind: 'category', name: category.name, cover: category.cover })}>
                        <Edit className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => { coverChangeCategoryName.current = category.name; categoryCoverInputRef.current?.click(); }}>
                        <ImageIcon className="mr-2 h-4 w-4" />
                        Cambiar portada
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setDeleteCategoryTarget(category.name)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
            )
          ) : (
            <div className="py-12 text-center">
              <Tag className="mx-auto mb-4 h-14 w-14 text-muted-foreground" />
              <h3 className="mb-2 text-xl font-semibold text-foreground">Todavia no hay categorias</h3>
              <p className="text-muted-foreground">Asigna un tipo a tus recetas para verlas agrupadas aca.</p>
            </div>
          )
        ) : showSourcesGallery ? (
          gallerySources.length > 0 ? (
            viewMode === 'list' ? (
            <div className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
              {gallerySources.map((source) => (
                <div key={source.name} className={`flex items-center gap-3 px-3 py-1 transition-colors hover:bg-muted/50 ${sourceSelectionMode && selectedSourceBulkNames.has(source.name) ? 'bg-accent/60' : ''}`}>
                  {sourceSelectionMode && (
                    <button
                      type="button"
                      onClick={(e) => handleToggleSourceSelection(source.name, { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey })}
                      aria-label={selectedSourceBulkNames.has(source.name) ? 'Quitar seleccion' : 'Seleccionar fuente'}
                      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${selectedSourceBulkNames.has(source.name) ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40 text-transparent'}`}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      if (sourceSelectionMode) { handleToggleSourceSelection(source.name, { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey }); return; }
                      setShowSourcesGallery(false);
                      saveRecentSource(source.name);
                      handleFiltersChange({ ...filters, sources: [source.name] });
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="flex min-w-0 flex-1 items-center gap-3 py-1 text-left"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                      {source.cover
                        ? <img src={source.cover} alt="" className="h-full w-full object-cover" />
                        : <ExternalLink className="h-5 w-5 text-muted-foreground" />}
                    </span>
                    <span className="block min-w-0 flex-1 truncate font-medium text-foreground">
                      {source.name} <span className="text-xs font-normal text-muted-foreground">({source.count} receta{source.count !== 1 ? 's' : ''})</span>
                    </span>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Opciones de la fuente">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => window.open(`/?fuente=${encodeURIComponent(source.name)}`, '_blank')}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Abrir fuente en ventana nueva
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => openEditGalleryDialog({ kind: 'source', name: source.name, cover: source.cover })}>
                        <Edit className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => { coverChangeSourceName.current = source.name; sourceCoverInputRef.current?.click(); }}>
                        <ImageIcon className="mr-2 h-4 w-4" />
                        Cambiar portada
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setDeleteSourceTarget(source.name)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
            ) : (
            <div className={getGridClass()}>
              {gallerySources.map((source) => (
                <div
                  key={source.name}
                  className={`group relative overflow-hidden rounded-lg bg-gradient-card text-left shadow-recipe-card transition-transform hover:scale-[1.02] ${sourceSelectionMode && selectedSourceBulkNames.has(source.name) ? 'ring-2 ring-primary' : ''}`}
                >
                  {sourceSelectionMode && (
                    <span className={`pointer-events-none absolute left-3 top-3 z-20 inline-flex h-6 w-6 items-center justify-center rounded-md border-2 ${selectedSourceBulkNames.has(source.name) ? 'border-primary bg-primary text-primary-foreground' : 'border-white/70 bg-white/50 text-transparent'}`}>
                      <Check className="h-4 w-4" />
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      if (sourceSelectionMode) { handleToggleSourceSelection(source.name, { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey }); return; }
                      setShowSourcesGallery(false);
                      saveRecentSource(source.name);
                      handleFiltersChange({ ...filters, sources: [source.name] });
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="block w-full text-left"
                  >
                    <div className="relative h-48 w-full overflow-hidden bg-muted">
                      {source.cover ? (
                        <img
                          src={source.cover}
                          alt={source.name}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <ExternalLink className="h-10 w-10" />
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-foreground">{source.name} <span className="text-sm font-normal text-muted-foreground">({source.count})</span></h3>
                    </div>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-3 top-3 z-20 inline-flex h-8 w-8 items-center justify-center rounded-md bg-white/50 text-gray-600 shadow-sm transition-colors hover:bg-white/70"
                        aria-label="Opciones de la fuente"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => window.open(`/?fuente=${encodeURIComponent(source.name)}`, '_blank')}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Abrir fuente en ventana nueva
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => openEditGalleryDialog({ kind: 'source', name: source.name, cover: source.cover })}>
                        <Edit className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => { coverChangeSourceName.current = source.name; sourceCoverInputRef.current?.click(); }}>
                        <ImageIcon className="mr-2 h-4 w-4" />
                        Cambiar portada
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setDeleteSourceTarget(source.name)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
            )
          ) : (
            <div className="py-12 text-center">
              <Tag className="mx-auto mb-4 h-14 w-14 text-muted-foreground" />
              <h3 className="mb-2 text-xl font-semibold text-foreground">Todavia no hay fuentes</h3>
              <p className="text-muted-foreground">Las recetas importadas con su URL de origen apareceran aca.</p>
            </div>
          )
        ) : showTagsGallery ? (
          galleryTags.length > 0 ? (
            viewMode === 'list' ? (
            <div className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
              {galleryTags.map((tag) => (
                <div key={tag.name} className={`flex items-center gap-3 px-3 py-1 transition-colors hover:bg-muted/50 ${tagSelectionMode && selectedTagBulkNames.has(tag.name) ? 'bg-accent/60' : ''}`}>
                  {tagSelectionMode && (
                    <button
                      type="button"
                      onClick={(e) => handleToggleTagSelection(tag.name, { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey })}
                      aria-label={selectedTagBulkNames.has(tag.name) ? 'Quitar seleccion' : 'Seleccionar etiqueta'}
                      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${selectedTagBulkNames.has(tag.name) ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40 text-transparent'}`}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      if (tagSelectionMode) { handleToggleTagSelection(tag.name, { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey }); return; }
                      setShowTagsGallery(false);
                      handleFiltersChange({ ...filters, tags: [tag.name] });
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="flex min-w-0 flex-1 items-center gap-3 py-1 text-left"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                      {tag.cover
                        ? <img src={tag.cover} alt="" className="h-full w-full object-cover" />
                        : <Tag className="h-5 w-5 text-muted-foreground" />}
                    </span>
                    <span className="block min-w-0 flex-1 truncate font-medium text-foreground">
                      {tag.name} <span className="text-xs font-normal text-muted-foreground">({tag.count} receta{tag.count !== 1 ? 's' : ''})</span>
                    </span>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Opciones de la etiqueta">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => window.open(`/?etiqueta=${encodeURIComponent(tag.name)}`, '_blank')}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Abrir etiqueta en ventana nueva
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => openEditGalleryDialog({ kind: 'tag', name: tag.name, cover: tag.cover })}>
                        <Edit className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => { coverChangeTagName.current = tag.name; tagCoverInputRef.current?.click(); }}>
                        <ImageIcon className="mr-2 h-4 w-4" />
                        Cambiar portada
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setDeleteTagTarget(tag.name)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
            ) : (
            <div className={getGridClass()}>
              {galleryTags.map((tag) => (
                <div
                  key={tag.name}
                  className={`group relative overflow-hidden rounded-lg bg-gradient-card text-left shadow-recipe-card transition-transform hover:scale-[1.02] ${tagSelectionMode && selectedTagBulkNames.has(tag.name) ? 'ring-2 ring-primary' : ''}`}
                >
                  {tagSelectionMode && (
                    <span className={`pointer-events-none absolute left-3 top-3 z-20 inline-flex h-6 w-6 items-center justify-center rounded-md border-2 ${selectedTagBulkNames.has(tag.name) ? 'border-primary bg-primary text-primary-foreground' : 'border-white/70 bg-white/50 text-transparent'}`}>
                      <Check className="h-4 w-4" />
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      if (tagSelectionMode) { handleToggleTagSelection(tag.name, { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey }); return; }
                      setShowTagsGallery(false);
                      handleFiltersChange({ ...filters, tags: [tag.name] });
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="block w-full text-left"
                  >
                    <div className="relative h-48 w-full overflow-hidden bg-muted">
                      {tag.cover ? (
                        <img
                          src={tag.cover}
                          alt={tag.name}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <Tag className="h-10 w-10" />
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-foreground">{tag.name} <span className="text-sm font-normal text-muted-foreground">({tag.count})</span></h3>
                    </div>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-3 top-3 z-20 inline-flex h-8 w-8 items-center justify-center rounded-md bg-white/50 text-gray-600 shadow-sm transition-colors hover:bg-white/70"
                        aria-label="Opciones de la etiqueta"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => window.open(`/?etiqueta=${encodeURIComponent(tag.name)}`, '_blank')}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Abrir etiqueta en ventana nueva
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => openEditGalleryDialog({ kind: 'tag', name: tag.name, cover: tag.cover })}>
                        <Edit className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => { coverChangeTagName.current = tag.name; tagCoverInputRef.current?.click(); }}>
                        <ImageIcon className="mr-2 h-4 w-4" />
                        Cambiar portada
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setDeleteTagTarget(tag.name)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
            )
          ) : (
            <div className="py-12 text-center">
              <Tag className="mx-auto mb-4 h-14 w-14 text-muted-foreground" />
              <h3 className="mb-2 text-xl font-semibold text-foreground">Todavia no hay etiquetas</h3>
              <p className="text-muted-foreground">Agreg? etiquetas a tus recetas para verlas agrupadas aca.</p>
            </div>
          )
        ) : showDishTypesGallery ? (
          galleryDishTypes.length > 0 ? (
            viewMode === 'list' ? (
            <div className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
              {galleryDishTypes.map((dishType) => (
                <div key={dishType.name} className={`flex items-center gap-3 px-3 py-1 transition-colors hover:bg-muted/50 ${dishTypeSelectionMode && selectedDishTypeBulkNames.has(dishType.name) ? 'bg-accent/60' : ''}`}>
                  {dishTypeSelectionMode && (
                    <button
                      type="button"
                      onClick={(e) => handleToggleDishTypeSelection(dishType.name, { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey })}
                      aria-label={selectedDishTypeBulkNames.has(dishType.name) ? 'Quitar seleccion' : 'Seleccionar tipo de comida'}
                      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${selectedDishTypeBulkNames.has(dishType.name) ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40 text-transparent'}`}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      if (dishTypeSelectionMode) { handleToggleDishTypeSelection(dishType.name, { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey }); return; }
                      setShowDishTypesGallery(false); setShowTagsGallery(false); setShowAuthorsGallery(false);
                      handleFiltersChange({ ...filters, dishType: dishType.name, dishTypes: [] });
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="flex min-w-0 flex-1 items-center gap-3 py-1 text-left"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                      {dishType.cover
                        ? <img src={dishType.cover} alt="" className="h-full w-full object-cover" />
                        : <UtensilsCrossed className="h-5 w-5 text-muted-foreground" />}
                    </span>
                    <span className="block min-w-0 flex-1 truncate font-medium text-foreground">
                      {dishType.name} <span className="text-xs font-normal text-muted-foreground">({dishType.count} receta{dishType.count !== 1 ? 's' : ''})</span>
                    </span>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Opciones del tipo de comida">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => window.open(`/?tipo=${encodeURIComponent(dishType.name)}`, '_blank')}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Abrir tipo de comida en ventana nueva
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => openEditGalleryDialog({ kind: 'dishType', name: dishType.name, cover: dishType.cover })}>
                        <Edit className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => { coverChangeDishTypeName.current = dishType.name; dishTypeCoverInputRef.current?.click(); }}>
                        <ImageIcon className="mr-2 h-4 w-4" />
                        Cambiar portada
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setDeleteDishTypeTarget(dishType.name)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
            ) : (
            <div className={getGridClass()}>
              {galleryDishTypes.map((dishType) => (
                <div
                  key={dishType.name}
                  className={`group relative overflow-hidden rounded-lg bg-gradient-card text-left shadow-recipe-card transition-transform hover:scale-[1.02] ${dishTypeSelectionMode && selectedDishTypeBulkNames.has(dishType.name) ? 'ring-2 ring-primary' : ''}`}
                >
                  {dishTypeSelectionMode && (
                    <span className={`pointer-events-none absolute left-3 top-3 z-20 inline-flex h-6 w-6 items-center justify-center rounded-md border-2 ${selectedDishTypeBulkNames.has(dishType.name) ? 'border-primary bg-primary text-primary-foreground' : 'border-white/70 bg-white/50 text-transparent'}`}>
                      <Check className="h-4 w-4" />
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      if (dishTypeSelectionMode) { handleToggleDishTypeSelection(dishType.name, { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey }); return; }
                      setShowDishTypesGallery(false); setShowTagsGallery(false); setShowAuthorsGallery(false);
                      handleFiltersChange({ ...filters, dishType: dishType.name, dishTypes: [] });
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="block w-full text-left"
                  >
                    <div className="relative h-48 w-full overflow-hidden bg-muted">
                      {dishType.cover ? (
                        <img
                          src={dishType.cover}
                          alt={dishType.name}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <UtensilsCrossed className="h-10 w-10" />
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-foreground">{dishType.name} <span className="text-sm font-normal text-muted-foreground">({dishType.count})</span></h3>
                    </div>
                  </button>

                  {/* Men? de tres puntitos */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-3 top-3 z-20 inline-flex h-8 w-8 items-center justify-center rounded-md bg-white/50 text-gray-600 shadow-sm transition-colors hover:bg-white/70"
                        aria-label="Opciones del tipo de comida"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => window.open(`/?tipo=${encodeURIComponent(dishType.name)}`, '_blank')}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Abrir tipo de comida en ventana nueva
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => openEditGalleryDialog({ kind: 'dishType', name: dishType.name, cover: dishType.cover })}>
                        <Edit className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => {
                          coverChangeDishTypeName.current = dishType.name;
                          dishTypeCoverInputRef.current?.click();
                        }}
                      >
                        <ImageIcon className="mr-2 h-4 w-4" />
                        Cambiar portada
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => setDeleteDishTypeTarget(dishType.name)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
            )
          ) : (
            <div className="py-12 text-center">
              <Tag className="mx-auto mb-4 h-14 w-14 text-muted-foreground" />
              <h3 className="mb-2 text-xl font-semibold text-foreground">Todavia no hay tipos de comida</h3>
              <p className="text-muted-foreground">Asigna un tipo de comida a tus recetas para verlos aca.</p>
            </div>
          )
        ) : showAuthorsGallery ? (
          authorList.length > 0 ? (
            <div className={getGridClass()}>
              {authorList.map((author) => (
                <div
                  key={author.name}
                  className="group relative overflow-hidden rounded-lg bg-gradient-card text-left shadow-recipe-card transition-transform hover:scale-[1.02]"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setShowAuthorsGallery(false);
                      handleFiltersChange({ ...filters, author: author.name });
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="block w-full text-left"
                  >
                    <div className="relative h-48 w-full overflow-hidden bg-muted">
                      {author.cover ? (
                        <img
                          src={author.cover}
                          alt={author.name}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <User className="h-10 w-10" />
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-foreground">{author.name}</h3>
                    </div>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-3 top-3 z-20 inline-flex h-8 w-8 items-center justify-center rounded-md bg-white/50 text-gray-600 shadow-sm transition-colors hover:bg-white/70"
                        aria-label="Opciones del autor"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => { coverChangeAuthorName.current = author.name; authorCoverInputRef.current?.click(); }}>
                        <ImageIcon className="mr-2 h-4 w-4" />
                        Cambiar portada
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setDeleteAuthorTarget(author.name)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <Tag className="mx-auto mb-4 h-14 w-14 text-muted-foreground" />
              <h3 className="mb-2 text-xl font-semibold text-foreground">Todavia no hay autores</h3>
              <p className="text-muted-foreground">Asigna un autor a tus recetas para verlos aca.</p>
            </div>
          )
        ) : isLoadingRecipes ? (
          <div className={getGridClass()}>
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="group overflow-hidden bg-gradient-card shadow-recipe-card rounded-lg">
                {/* Image skeleton */}
                <Skeleton className="w-full h-48 rounded-t-lg" />

                {/* Content skeleton */}
                <div className="p-4 space-y-3">
                  {/* Title skeleton */}
                  <Skeleton className="h-6 w-3/4" />

                  {/* Description skeleton */}
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />

                  {/* Meta info skeleton */}
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-20" />
                  </div>

                  {/* Recipe type skeleton */}
                  <Skeleton className="h-6 w-20" />

                  {/* Tags skeleton */}
                  <div className="flex flex-wrap gap-1">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-5 w-14" />
                  </div>

                  {/* Buttons skeleton */}
                  <div className="flex gap-2">
                    <Skeleton className="h-10 flex-1" />
                    <Skeleton className="h-10 w-12" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredRecipes.length > 0 ? (
          <>
            {viewMode === 'ingredients' ? (
            <div className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
              {filteredRecipes.map((recipe) => {
                const ingImg = recipe.images?.[0]?.url ? resolveImageUrl(recipe.images[0].url) : '';
                const ingSelected = selectedRecipeIds.has(recipe.id);
                const ingSource = getRecipeSource(recipe);
                const ingCategories = recipe.recipeType ? recipe.recipeType.split(',').map(c => c.trim()).filter(Boolean) : [];
                const ingCollections = collections
                  .filter(collection => collection.recipeIds.includes(recipe.id))
                  .map(collection => collection.name)
                  .filter(Boolean);
                return (
                  <button
                    key={recipe.id}
                    type="button"
                    onClick={(e) => { if (activeBulkPanel !== null) { e.preventDefault(); handleToggleRecipeSelection(recipe, { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey }); } else { handleViewRecipe(recipe); } }}
                    className={`flex items-start gap-4 px-3 py-3 text-left transition-colors hover:bg-muted/50 ${ingSelected ? 'bg-accent/60' : ''}`}
                  >
                    {/* Imagen a la izquierda */}
                    <span className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                      {ingImg
                        ? <img src={ingImg} alt="" className="h-full w-full object-cover" />
                        : <ChefHat className="h-7 w-7 text-muted-foreground" />}
                    </span>
                    {/* Medio: titulo, fuente, iconos, tipo y categorias */}
                    <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <span className="block text-lg font-medium leading-tight text-foreground">{recipe.title}</span>
                      {ingSource && (
                        <span className="block truncate text-xs text-muted-foreground">{ingSource}</span>
                      )}
                      {/* Tiempos y porciones */}
                      <span className="flex items-center gap-3 text-sm text-muted-foreground">
                        {!!recipe.prepTime && recipe.prepTime > 0 && (
                          <span className="flex items-center gap-1 whitespace-nowrap" title="Tiempo de preparacion">
                            <PreparationTimeIcon className="h-4 w-4" />{recipe.prepTime} min
                          </span>
                        )}
                        {!!recipe.cookTime && recipe.cookTime > 0 && (
                          <span className="flex items-center gap-1 whitespace-nowrap" title="Tiempo total">
                            <Clock className="h-4 w-4" />{recipe.cookTime} min
                          </span>
                        )}
                        {!!recipe.servings && recipe.servings > 0 && (
                          <span className="flex items-center gap-1 whitespace-nowrap" title="Porciones">
                            <User className="h-4 w-4" />{recipe.servings}
                          </span>
                        )}
                      </span>
                      {/* Iconos de caracteristicas */}
                      {(recipe.thermomix || recipe.airFryer || recipe.cooked || recipe.featured || recipe.glutenFree || recipe.sugarFree || recipe.keto || recipe.lowCarb || recipe.proteica || recipe.vegetarian || recipe.sweet || recipe.savory) && (
                        <span className="flex flex-wrap items-center gap-2">
                          {recipe.thermomix && (
                            <img src="/thermomix-logo.png" alt="" title="Thermomix" className="h-5 w-5 object-contain mix-blend-multiply" />
                          )}
                          {recipe.airFryer && (
                            <img src="/air-fryer.png" alt="" title="Air Fryer" className="h-5 w-5 object-contain mix-blend-multiply" />
                          )}
                          {recipe.cooked && (
                            <RecipePreparedIcon style={{ width: 20, height: 20, color: '#8ebf4c' }} />
                          )}
                          {recipe.featured && (
                            <Heart className="h-4 w-4 fill-red-500 text-red-500" />
                          )}
                          {recipe.glutenFree && (
                            <WheatOff className="h-4 w-4 text-muted-foreground" />
                          )}
                          {recipe.sugarFree && (
                            <span
                              title="Sin Azucar"
                              aria-label="Sin Azucar"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-muted/70"
                            >
                              <CandyOff className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                            </span>
                          )}
                          {recipe.keto && (
                            <AvocadoIcon className="h-5 w-5 text-muted-foreground" />
                          )}
                          {recipe.lowCarb && (
                            <img src="/logo-saludable.png" alt="" title="Low Carb" className="h-5 w-5 object-contain grayscale opacity-70" />
                          )}
                          {recipe.proteica && (
                            <Beef className="h-4 w-4 text-muted-foreground" />
                          )}
                          {recipe.vegetarian && (
                            <Leaf className="h-4 w-4 text-muted-foreground" />
                          )}
                          {recipe.sweet && (
                            <CakeSlice className="h-4 w-4 text-muted-foreground" aria-label="Receta dulce" />
                          )}
                          {recipe.savory && (
                            <Utensils className="h-4 w-4 text-muted-foreground" aria-label="Receta salada" />
                          )}
                        </span>
                      )}
                      {/* Tipo de comida y categorias */}
                      <span className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                        {recipe.dishType?.trim() && (
                          <span><span className="font-semibold text-foreground">Tipo de comida:</span> {recipe.dishType}</span>
                        )}
                        {ingCollections.length > 0 && (
                          <span><span className="font-semibold text-foreground">Coleccion:</span> {ingCollections.join(', ')}</span>
                        )}
                        {ingCategories.length > 0 && (
                          <span><span className="font-semibold text-foreground">Categoria:</span> {ingCategories.join(', ')}</span>
                        )}
                      </span>
                    </span>
                    {/* Derecha: ingredientes con fuente mas pequena */}
                    <span className="hidden shrink-0 sm:block sm:w-60 md:w-72">
                      {recipe.ingredients && recipe.ingredients.length > 0 ? (
                        <ul className="space-y-1 text-[11px] leading-snug text-muted-foreground">
                          {recipe.ingredients.map((ing, idx) => (
                            <li key={idx} className="flex gap-1.5">
                              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                              <span>
                                {(ing.amount || ing.unit) && <span className="font-medium">{[ing.amount, ing.unit].filter(Boolean).join(' ')}</span>} {ing.name}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">Sin ingredientes</span>
                      )}
                    </span>
                    {activeBulkPanel !== null && (
                      <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${ingSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40 text-transparent'}`}>
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            ) : viewMode === 'list' || viewMode === 'detail' ? (
            <div className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
              {filteredRecipes.map((recipe) => {
                const listImg = recipe.images?.[0]?.url ? resolveImageUrl(recipe.images[0].url) : '';
                const listSelected = selectedRecipeIds.has(recipe.id);
                const listSource = getRecipeSource(recipe);
                return (
                  <button
                    key={recipe.id}
                    type="button"
                    onClick={(e) => { if (activeBulkPanel !== null) { e.preventDefault(); handleToggleRecipeSelection(recipe, { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey }); } else { handleViewRecipe(recipe); } }}
                    className={`flex items-center gap-3 px-3 text-left transition-colors hover:bg-muted/50 ${viewMode === 'detail' ? 'py-2.5' : 'py-1'} ${listSelected ? 'bg-accent/60' : ''}`}
                  >
                    <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted ${viewMode === 'detail' ? 'h-14 w-14' : 'h-12 w-12'}`}>
                      {listImg
                        ? <img src={listImg} alt="" className="h-full w-full object-cover" />
                        : <ChefHat className="h-5 w-5 text-muted-foreground" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate font-medium text-foreground ${viewMode === 'detail' ? 'text-lg' : ''}`}>{recipe.title}</span>
                      {listSource && (
                        <span className="block truncate text-xs text-muted-foreground">{listSource}</span>
                      )}
                    </span>
                    {viewMode === 'detail' && (
                    <span className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                      {/* Fila 1: tiempos y porciones */}
                      <span className="flex items-center gap-3 text-base text-muted-foreground">
                        {!!recipe.prepTime && recipe.prepTime > 0 && (
                          <span className="flex items-center gap-1 whitespace-nowrap" title="Tiempo de preparacion">
                            <PreparationTimeIcon className="h-5 w-5" />{recipe.prepTime} min
                          </span>
                        )}
                        {!!recipe.cookTime && recipe.cookTime > 0 && (
                          <span className="flex items-center gap-1 whitespace-nowrap" title="Tiempo total">
                            <Clock className="h-5 w-5" />{recipe.cookTime} min
                          </span>
                        )}
                        {!!recipe.servings && recipe.servings > 0 && (
                          <span className="flex items-center gap-1 whitespace-nowrap" title="Porciones">
                            <User className="h-5 w-5" />{recipe.servings}
                          </span>
                        )}
                      </span>
                      {/* Fila 2: iconos de caracteristicas (solo los activos), en orden:
                          thermomix, air fryer, sin gluten, keto, low carb, proteica, vegetariana, cocinada, favorita */}
                      {(recipe.thermomix || recipe.airFryer || recipe.glutenFree || recipe.sugarFree || recipe.keto || recipe.lowCarb || recipe.proteica || recipe.vegetarian || recipe.sweet || recipe.savory || recipe.cooked || recipe.featured) && (
                        <span className="flex items-center gap-2">
                          {recipe.thermomix && (
                            <img src="/thermomix-logo.png" alt="" title="Thermomix" className="h-6 w-6 object-contain mix-blend-multiply" />
                          )}
                          {recipe.airFryer && (
                            <img src="/air-fryer.png" alt="" title="Air Fryer" className="h-6 w-6 object-contain mix-blend-multiply" />
                          )}
                          {recipe.glutenFree && (
                            <WheatOff className="h-5 w-5 text-muted-foreground" />
                          )}
                          {recipe.sugarFree && (
                            <span
                              title="Sin Azucar"
                              aria-label="Sin Azucar"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-muted/70"
                            >
                              <CandyOff className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                            </span>
                          )}
                          {recipe.keto && (
                            <AvocadoIcon className="h-6 w-6 text-muted-foreground" />
                          )}
                          {recipe.lowCarb && (
                            <img src="/logo-saludable.png" alt="" title="Low Carb" className="h-6 w-6 object-contain grayscale opacity-70" />
                          )}
                          {recipe.proteica && (
                            <Beef className="h-5 w-5 text-muted-foreground" />
                          )}
                          {recipe.vegetarian && (
                            <Leaf className="h-5 w-5 text-muted-foreground" />
                          )}
                          {recipe.sweet && (
                            <CakeSlice className="h-5 w-5 text-muted-foreground" aria-label="Receta dulce" />
                          )}
                          {recipe.savory && (
                            <Utensils className="h-5 w-5 text-muted-foreground" aria-label="Receta salada" />
                          )}
                          {recipe.cooked && (
                            <span title="Cocinada" className="flex items-center">
                              <RecipePreparedIcon style={{ width: 24, height: 24, color: '#8ebf4c' }} />
                            </span>
                          )}
                          {recipe.featured && (
                            <Heart className="h-5 w-5 fill-red-500 text-red-500" aria-label="Favorita" />
                          )}
                        </span>
                      )}
                    </span>
                    )}
                    {viewMode === 'list' && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleToggleFavorite(recipe); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); handleToggleFavorite(recipe); } }}
                        className="flex shrink-0 cursor-pointer items-center justify-center rounded-md p-1 hover:bg-muted"
                        title={recipe.featured ? 'Quitar de favoritos' : 'Marcar como favorito'}
                        aria-label={recipe.featured ? 'Quitar de favoritos' : 'Marcar como favorito'}
                      >
                        <Heart className={`h-5 w-5 transition-colors ${recipe.featured ? 'fill-red-500 text-red-500' : 'text-muted-foreground hover:text-red-500'}`} />
                      </span>
                    )}
                    {activeBulkPanel !== null && (
                      <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${listSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40 text-transparent'}`}>
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            ) : (
            <div className={getGridClass()}>
              {filteredRecipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  columns={gridColumns}
                  collectionNames={gridColumns <= 4 ? collections.filter(c => c.recipeIds.includes(recipe.id)).map(c => c.name) : undefined}
                  dishTypeOptions={gridColumns === 1 ? dishTypeList.map(d => d.name) : undefined}
                  categoryOptions={gridColumns === 1 ? categoryList.map(c => c.name) : undefined}
                  sourceOptions={gridColumns === 1 ? sourceList.map(s => s.name) : undefined}
                  allCollections={gridColumns === 1 ? collections.map(c => ({ id: c.id, name: c.name })) : undefined}
                  onInlineSave={gridColumns === 1 ? handleInlineSaveFields : undefined}
                  onToggleFeature={handleToggleFeature}
                  onView={handleViewRecipe}
                  onEdit={handleEditRecipe}
                  onDelete={handleDeleteRecipe}
                  onToggleFavorite={handleToggleFavorite}
                  onToggleCooked={handleToggleCooked}
                  onPlayTTS={handlePlayTTS}
                  onShowNutrition={handleShowNutrition}
                  onSaveToCollection={setCollectionRecipe}
                  isInCollection={collectionRecipeIds.has(recipe.id)}
                  isPlayingTTS={playingRecipeId === recipe.id}
                  isGeneratingScript={generatingScript === recipe.id}
                  selectionMode={activeBulkPanel !== null}
                  isSelected={selectedRecipeIds.has(recipe.id)}
                  onSelectionChange={handleToggleRecipeSelection}
                />
              ))}
            </div>
            )}

            {/* Loading more indicator */}
            {isLoadingMore && (
              <div className="text-center py-8">
                <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-muted-foreground">Cargando mas recetas...</p>
              </div>
            )}

            {/* End of results indicator */}
            {displayedCount >= allFilteredRecipes.length && allFilteredRecipes.length > 24 && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Ya viste todas las recetas.</p>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <Search className="mx-auto mb-4 h-14 w-14 text-muted-foreground" />
            <h3 className="text-xl font-semibold text-foreground mb-2">
              {recipes.length === 0 ? 'No tienes recetas aun' : 'No se encontraron recetas'}
            </h3>
            <p className="text-muted-foreground">
              {recipes.length === 0
                ? 'Comienza creando tu primera receta o importando desde una URL'
                : 'Intenta con otros terminos de busqueda o agrega una nueva receta'
              }
            </p>
          </div>
        )}
          </div>
        </div>
      </main>
      
      <RecipeModal
        recipe={selectedRecipe}
        isOpen={!!selectedRecipe}
        onClose={handleCloseModal}
        onRecipeUpdate={handleRecipeUpdated}
        onCollectionsUpdated={handleCollectionsUpdated}
        collections={collections}
        onDelete={handleDeleteRecipe}
        onSaveToCollection={setCollectionRecipe}
        isInCollection={selectedRecipe ? collectionRecipeIds.has(selectedRecipe.id) : false}
        onToggleFavorite={handleToggleFavorite}
        onToggleCooked={handleToggleCooked}
        onToggleFeature={handleToggleFeature}
        hasPreviousRecipe={selectedRecipeIndex > 0}
        hasNextRecipe={
          selectedRecipeIndex >= 0
          && selectedRecipeIndex < allFilteredRecipes.length - 1
        }
        onPreviousRecipe={() => {
          if (selectedRecipeIndex > 0) {
            const previousRecipe = allFilteredRecipes[selectedRecipeIndex - 1];
            saveRecentRecipe(previousRecipe.id);
            setSelectedRecipe(previousRecipe);
          }
        }}
        onNextRecipe={() => {
          if (
            selectedRecipeIndex >= 0
            && selectedRecipeIndex < allFilteredRecipes.length - 1
          ) {
            const nextRecipe = allFilteredRecipes[selectedRecipeIndex + 1];
            saveRecentRecipe(nextRecipe.id);
            setSelectedRecipe(nextRecipe);
          }
        }}
      />

      <ImportRecipeModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportSuccess={handleImportSuccess}
        onViewRecipe={handleViewRecipe}
        onBulkImport={() => { setShowImportModal(false); setShowBulkUrlImportModal(true); }}
      />

      <BulkUrlImportModal
        isOpen={showBulkUrlImportModal}
        onClose={() => setShowBulkUrlImportModal(false)}
        onRecipeSaved={() => loadRecipes()}
        onEditRecipes={handleEditImportedRecipes}
      />

      <BulkEditModal
        isOpen={showBulkEditModal}
        onClose={() => setShowBulkEditModal(false)}
        recipes={selectedActionRecipes}
        onApplied={() => { loadRecipes(); setSelectedRecipeIds(new Set()); setActiveBulkPanel(null); }}
      />

      {/* Panel lateral como cajon en mobile/iPad (en desktop se muestra fijo a la izquierda) */}
      <Sheet open={showMobileSidebar} onOpenChange={setShowMobileSidebar}>
        <SheetContent side="left" className="w-72 overflow-y-auto p-0 sm:w-80">
          <SheetHeader className="border-b px-4 py-3">
            <SheetTitle>Secciones</SheetTitle>
          </SheetHeader>
          <div className="p-2">
            {collectionsSidebarNode}
          </div>
        </SheetContent>
      </Sheet>

      <CreateRecipeModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onRecipeCreated={handleRecipeCreated}
        onCollectionsUpdated={handleCollectionsUpdated}
      />

      <EditRecipeModal
        isOpen={showEditModal}
        onClose={closeEditModal}
        recipe={recipeToEdit}
        onRecipeUpdated={handleRecipeUpdated}
        onCollectionsUpdated={handleCollectionsUpdated}
        queue={editQueue.length > 0
          ? { position: editQueueIndex, total: editQueue.length, onNext: goToNextQueuedRecipe }
          : undefined}
      />

      <DeleteRecipeDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        recipe={recipeToDelete}
        onRecipeDeleted={handleRecipeDeleted}
      />

      <NutritionModal
        recipe={nutritionRecipe}
        isOpen={showNutritionModal}
        onClose={() => setShowNutritionModal(false)}
        onRecipeUpdate={handleNutritionUpdate}
      />

      <SaveToCollectionModal
        recipe={collectionRecipe}
        isOpen={!!collectionRecipe}
        onClose={() => setCollectionRecipe(null)}
        onRecipeSaved={(recipeId, updatedCollections) => {
          setCollectionRecipeIds(prev => {
            const next = new Set(prev);
            const remainsInCollection = updatedCollections.some(collection =>
              collection.recipeIds.includes(recipeId)
            );
            if (remainsInCollection) {
              next.add(recipeId);
            } else {
              next.delete(recipeId);
            }
            return next;
          });
          setCollections(updatedCollections);
        }}
      />

      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              ?Eliminar recetasi
            </AlertDialogTitle>
            <AlertDialogDescription>
              Vas a eliminar {selectedRecipeIds.size} receta{selectedRecipeIds.size > 1 ? "s" : ""}.
              Esta accion no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkAction === 'delete'}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleBulkDelete();
              }}
              disabled={bulkAction === 'delete'}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkAction === 'delete'
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <Trash2 className="mr-2 h-4 w-4" />}
              {bulkAction === 'delete' ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Footer */}
      <footer className="bg-primary py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="flex items-center justify-center gap-1 text-center text-sm text-primary-foreground">
            {"\u00a9 Copyright 2025 - TasteBox - Hecho con"}
            <Heart className="h-3.5 w-3.5 fill-white text-white" />
          </p>
        </div>
      </footer>


      {/* Confirmacion para eliminar una coleccion */}
      <AlertDialog open={!!editCollectionTarget} onOpenChange={(open) => { if (!open) { setEditCollectionTarget(null); setEditCollectionName(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Editar coleccion</AlertDialogTitle>
            <AlertDialogDescription>
              Cambia el nombre de la coleccion.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={editCollectionName}
            onChange={(event) => setEditCollectionName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && editCollectionName.trim()) {
                event.preventDefault();
                void submitEditCollection();
              }
            }}
            placeholder="Nombre de la coleccion"
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={editingCollection}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!editCollectionName.trim() || editingCollection}
              onClick={(event) => {
                event.preventDefault();
                void submitEditCollection();
              }}
            >
              {editingCollection ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Edit className="mr-2 h-4 w-4" />}
              Guardar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!editGalleryTarget} onOpenChange={(open) => { if (!open) { setEditGalleryTarget(null); setEditGalleryName(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Editar {editGalleryTarget ? EDITABLE_GALLERY_LABELS[editGalleryTarget.kind] : ''}</AlertDialogTitle>
            <AlertDialogDescription>
              Cambia el nombre y guarda los cambios.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={editGalleryName}
            onChange={(event) => setEditGalleryName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && editGalleryName.trim()) {
                event.preventDefault();
                void submitEditGallery();
              }
            }}
            placeholder="Nuevo nombre"
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={editingGallery}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!editGalleryName.trim() || editingGallery}
              onClick={(event) => {
                event.preventDefault();
                void submitEditGallery();
              }}
            >
              {editingGallery ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Edit className="mr-2 h-4 w-4" />}
              Guardar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteCollectionTarget} onOpenChange={(open) => { if (!open) setDeleteCollectionTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar coleccion</AlertDialogTitle>
            <AlertDialogDescription>
              Seguro que queres eliminar "{deleteCollectionTarget?.name}"? Las recetas no se eliminaran, solo la coleccion.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (deleteCollectionTarget) void handleDeleteCollection(deleteCollectionTarget.id);
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmacion para eliminar varias colecciones */}
      <AlertDialog open={bulkDeleteCollectionsOpen} onOpenChange={setBulkDeleteCollectionsOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar colecciones</AlertDialogTitle>
            <AlertDialogDescription>
              Seguro que queres eliminar {selectedCollectionBulkIds.size} coleccion{selectedCollectionBulkIds.size > 1 ? 'es' : ''}? Las recetas no se eliminaran, solo las colecciones.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); void handleBulkDeleteCollections(); }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmacion para eliminar varias fuentes */}
      <AlertDialog open={bulkDeleteSourcesOpen} onOpenChange={setBulkDeleteSourcesOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar fuentes</AlertDialogTitle>
            <AlertDialogDescription>
              Seguro que queres eliminar {selectedSourceBulkNames.size} fuente{selectedSourceBulkNames.size > 1 ? 's' : ''}? Las recetas no se eliminaran, solo perderan esta fuente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); void handleBulkDeleteSources(); }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmacion para eliminar varias etiquetas */}
      <AlertDialog open={bulkDeleteTagsOpen} onOpenChange={setBulkDeleteTagsOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar etiquetas</AlertDialogTitle>
            <AlertDialogDescription>
              Seguro que queres eliminar {selectedTagBulkNames.size} etiqueta{selectedTagBulkNames.size > 1 ? 's' : ''}? Las recetas no se eliminaran, solo perderan esta etiqueta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); void handleBulkDeleteTags(); }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmacion para eliminar varias categorias */}
      <AlertDialog open={bulkDeleteCategoriesOpen} onOpenChange={setBulkDeleteCategoriesOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar categorias</AlertDialogTitle>
            <AlertDialogDescription>
              Seguro que queres eliminar {selectedCategoryBulkNames.size} categoria{selectedCategoryBulkNames.size > 1 ? 's' : ''}? Las recetas no se eliminaran, solo perderan esta categoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); void handleBulkDeleteCategories(); }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmacion para eliminar varios tipos de comida */}
      <AlertDialog open={bulkDeleteDishTypesOpen} onOpenChange={setBulkDeleteDishTypesOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar tipos de comida</AlertDialogTitle>
            <AlertDialogDescription>
              Seguro que queres eliminar {selectedDishTypeBulkNames.size} tipo{selectedDishTypeBulkNames.size > 1 ? 's' : ''} de comida? Las recetas no se eliminaran, solo perderan este tipo de comida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); void handleBulkDeleteDishTypes(); }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Input oculto para subir la portada de un tipo de comida desde la PC */}
      <input
        ref={dishTypeCoverInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const name = coverChangeDishTypeName.current;
          if (file && name) {
            void handleChangeDishTypeCover(name, file);
          }
          coverChangeDishTypeName.current = null;
          e.target.value = '';
        }}
      />

      {/* Input oculto para subir la portada de una categoria */}
      <input
        ref={categoryCoverInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const name = coverChangeCategoryName.current;
          if (file && name) void handleChangeCategoryCover(name, file);
          coverChangeCategoryName.current = null;
          e.target.value = '';
        }}
      />

      {/* Input oculto para subir la portada de una fuente */}
      <input
        ref={sourceCoverInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const name = coverChangeSourceName.current;
          if (file && name) void handleChangeSourceCover(name, file);
          coverChangeSourceName.current = null;
          e.target.value = '';
        }}
      />

      {/* Input oculto para subir la portada de una etiqueta */}
      <input
        ref={tagCoverInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const name = coverChangeTagName.current;
          if (file && name) void handleChangeTagCover(name, file);
          coverChangeTagName.current = null;
          e.target.value = '';
        }}
      />

      {/* Input oculto para subir la portada de un autor */}
      <input
        ref={authorCoverInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const name = coverChangeAuthorName.current;
          if (file && name) void handleChangeAuthorCover(name, file);
          coverChangeAuthorName.current = null;
          e.target.value = '';
        }}
      />

      {/* Confirmacion para eliminar un tipo de comida */}
      <AlertDialog open={!!deleteDishTypeTarget} onOpenChange={(open) => { if (!open) setDeleteDishTypeTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar tipo de comida</AlertDialogTitle>
            <AlertDialogDescription>
              Seguro que queres eliminar "{deleteDishTypeTarget}"? Las recetas no se eliminaran, solo perderan este tipo de comida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (deleteDishTypeTarget) void handleDeleteDishType(deleteDishTypeTarget);
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmacion para eliminar una categoria */}
      <AlertDialog open={!!deleteCategoryTarget} onOpenChange={(open) => { if (!open) setDeleteCategoryTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar categoria</AlertDialogTitle>
            <AlertDialogDescription>
              Seguro que queres eliminar "{deleteCategoryTarget}"? Las recetas no se eliminaran, solo perderan esta categoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); if (deleteCategoryTarget) void handleDeleteCategory(deleteCategoryTarget); }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmacion para eliminar una fuente */}
      <AlertDialog open={!!deleteSourceTarget} onOpenChange={(open) => { if (!open) setDeleteSourceTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar fuente</AlertDialogTitle>
            <AlertDialogDescription>
              Seguro que queres eliminar "{deleteSourceTarget}"? Las recetas no se eliminaran, solo perderan esta fuente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); if (deleteSourceTarget) void handleDeleteSource(deleteSourceTarget); }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmacion para eliminar una etiqueta */}
      <AlertDialog open={!!deleteTagTarget} onOpenChange={(open) => { if (!open) setDeleteTagTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar etiqueta</AlertDialogTitle>
            <AlertDialogDescription>
              Seguro que queres eliminar "{deleteTagTarget}"? Las recetas no se eliminaran, solo perderan esta etiqueta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); if (deleteTagTarget) void handleDeleteTag(deleteTagTarget); }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmacion para eliminar un autor */}
      <AlertDialog open={!!deleteAuthorTarget} onOpenChange={(open) => { if (!open) setDeleteAuthorTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar autor</AlertDialogTitle>
            <AlertDialogDescription>
              Seguro que queres eliminar "{deleteAuthorTarget}"? Las recetas no se eliminaran, solo perderan este autor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); if (deleteAuthorTarget) void handleDeleteAuthor(deleteAuthorTarget); }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialogo para crear una nueva coleccion */}
      <AlertDialog open={showNewCollectionDialog} onOpenChange={(open) => { if (!open) { setShowNewCollectionDialog(false); resetNewCollectionDialog(); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nueva coleccion</AlertDialogTitle>
            <AlertDialogDescription>
              Ingresa un nombre y, opcionalmente, elegi una portada para la nueva coleccion.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <Input
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newCollectionName.trim()) { e.preventDefault(); void submitNewCollection(); } }}
              placeholder="Nombre de la coleccion"
              autoFocus
            />
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Portada (opcional)</p>
              <CoverPicker
                previewUrl={newCollectionCoverPreview}
                loading={newCollectionCoverLoading}
                onPickFile={setNewCollectionCoverFromFile}
                onPickUrl={(url) => void addNewCollectionCoverFromUrl(url)}
                onClear={clearNewCollectionCover}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={creatingCollection}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!newCollectionName.trim() || creatingCollection}
              onClick={(e) => { e.preventDefault(); void submitNewCollection(); }}
            >
              {creatingCollection ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Crear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialogo para crear una nueva fuente (con portada) */}
      <AlertDialog open={showNewSourceDialog} onOpenChange={(open) => { if (!open) { setShowNewSourceDialog(false); resetNewSourceDialog(); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nueva fuente</AlertDialogTitle>
            <AlertDialogDescription>
              Ingresi un nombre y, opcionalmente, elegi una portada para la nueva fuente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <Input
              value={newSourceName}
              onChange={(e) => setNewSourceName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newSourceName.trim()) { e.preventDefault(); void submitNewSource(); } }}
              placeholder="Nombre de la fuente"
              autoFocus
            />
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Portada (opcional)</p>
              <CoverPicker
                previewUrl={newSourceCoverPreview}
                loading={newSourceCoverLoading}
                onPickFile={setNewSourceCoverFromFile}
                onPickUrl={(url) => void addNewSourceCoverFromUrl(url)}
                onClear={clearNewSourceCover}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={creatingSource}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!newSourceName.trim() || creatingSource}
              onClick={(e) => { e.preventDefault(); void submitNewSource(); }}
            >
              {creatingSource ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Crear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialogo para crear una nueva etiqueta (con portada) */}
      <AlertDialog open={showNewTagDialog} onOpenChange={(open) => { if (!open) { setShowNewTagDialog(false); resetNewTagDialog(); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nueva etiqueta</AlertDialogTitle>
            <AlertDialogDescription>
              Ingresi un nombre y, opcionalmente, elegi una portada para la nueva etiqueta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <Input
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newTagName.trim()) { e.preventDefault(); void submitNewTag(); } }}
              placeholder="Nombre de la etiqueta"
              autoFocus
            />
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Portada (opcional)</p>
              <CoverPicker
                previewUrl={newTagCoverPreview}
                loading={newTagCoverLoading}
                onPickFile={setNewTagCoverFromFile}
                onPickUrl={(url) => void addNewTagCoverFromUrl(url)}
                onClear={clearNewTagCover}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={creatingTag}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!newTagName.trim() || creatingTag}
              onClick={(e) => { e.preventDefault(); void submitNewTag(); }}
            >
              {creatingTag ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Crear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialogo para crear una nueva categoria (con portada) */}
      <AlertDialog open={showNewCategoryDialog} onOpenChange={(open) => { if (!open) { setShowNewCategoryDialog(false); resetNewCategoryDialog(); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nueva categoria</AlertDialogTitle>
            <AlertDialogDescription>
              Ingresi un nombre y, opcionalmente, elegi una portada para la nueva categoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <Input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newCategoryName.trim()) { e.preventDefault(); void submitNewCategory(); } }}
              placeholder="Nombre de la categoria"
              autoFocus
            />
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Portada (opcional)</p>
              <CoverPicker
                previewUrl={newCategoryCoverPreview}
                loading={newCategoryCoverLoading}
                onPickFile={setNewCategoryCoverFromFile}
                onPickUrl={(url) => void addNewCategoryCoverFromUrl(url)}
                onClear={clearNewCategoryCover}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={creatingCategory}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!newCategoryName.trim() || creatingCategory}
              onClick={(e) => { e.preventDefault(); void submitNewCategory(); }}
            >
              {creatingCategory ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Crear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialogo para crear un nuevo tipo de comida (con portada) */}
      <AlertDialog open={showNewDishTypeDialog} onOpenChange={(open) => { if (!open) { setShowNewDishTypeDialog(false); resetNewDishTypeDialog(); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nuevo tipo de comida</AlertDialogTitle>
            <AlertDialogDescription>
              Ingresa un nombre y, opcionalmente, elegi una portada para el nuevo tipo de comida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <Input
              value={newDishTypeName}
              onChange={(e) => setNewDishTypeName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newDishTypeName.trim()) { e.preventDefault(); void submitNewDishType(); } }}
              placeholder="Nombre del tipo de comida"
              autoFocus
            />
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Portada (opcional)</p>
              <CoverPicker
                previewUrl={newDishTypeCoverPreview}
                loading={newDishTypeCoverLoading}
                onPickFile={setNewDishTypeCoverFromFile}
                onPickUrl={(url) => void addNewDishTypeCoverFromUrl(url)}
                onClear={clearNewDishTypeCover}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={creatingDishType}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!newDishTypeName.trim() || creatingDishType}
              onClick={(e) => { e.preventDefault(); void submitNewDishType(); }}
            >
              {creatingDishType ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Crear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialogo de opciones al imprimir tarjetas/lista de colecciones o tipos de comida */}
      <AlertDialog open={!!galleryPrint} onOpenChange={(open) => { if (!open) setGalleryPrint(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{galleryPrint?.kind === 'cards' ? 'Imprimir tarjetas' : 'Imprimir lista'}</AlertDialogTitle>
            <AlertDialogDescription>
              Opcional: agrega un titulo, encabezado y pie de pagina para la hoja a imprimir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            {galleryPrint?.kind === 'cards' && (
              <div>
                <Label className="mb-1.5 block text-sm font-medium">Columnas</Label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <Button
                      key={n}
                      type="button"
                      variant={galleryPrintColumns === n ? "default" : "outline"}
                      size="sm"
                      className="w-10"
                      onClick={() => setGalleryPrintColumns(n)}
                    >
                      {n}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <Label htmlFor="gallery-print-title" className="mb-1.5 block text-sm font-medium">Titulo del documento</Label>
              <Input
                id="gallery-print-title"
                value={galleryPrintTitle}
                onChange={(e) => setGalleryPrintTitle(e.target.value)}
                placeholder="Titulo del documento (opcional)"
              />
            </div>
            <div>
              <Label htmlFor="gallery-print-header" className="mb-1.5 block text-sm font-medium">Encabezado</Label>
              <Input
                id="gallery-print-header"
                value={galleryPrintHeader}
                onChange={(e) => setGalleryPrintHeader(e.target.value)}
                placeholder="Encabezado (opcional)"
              />
            </div>
            <div>
              <Label htmlFor="gallery-print-footer" className="mb-1.5 block text-sm font-medium">Pie de pagina</Label>
              <Input
                id="gallery-print-footer"
                value={galleryPrintFooter}
                onChange={(e) => setGalleryPrintFooter(e.target.value)}
                placeholder="Pie de pagina (opcional)"
              />
              <Button
                type="button"
                variant={galleryPrintPageNumber ? "default" : "outline"}
                size="sm"
                className="mt-2"
                onClick={() => setGalleryPrintPageNumber(v => !v)}
              >
                {galleryPrintPageNumber && <Check className="mr-2 h-4 w-4" />}
                Insertar numero de pagina
              </Button>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmGalleryPrint(); }}>
              <Printer className="mr-2 h-4 w-4" />
              Imprimir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialogo para cambiar la portada de una coleccion */}
      <AlertDialog open={!!changeCoverCollection} onOpenChange={(open) => { if (!open) closeChangeCoverDialog(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cambiar portada de la coleccion</AlertDialogTitle>
            <AlertDialogDescription>
              Elegi una portada para "{changeCoverCollection?.name}" desde tu PC, desde la web o arrastrandola.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <CoverPicker
            previewUrl={changeCoverPreview}
            loading={changeCoverLoading}
            onPickFile={setChangeCoverFromFile}
            onPickUrl={(url) => void addChangeCoverFromUrl(url)}
            onClear={clearChangeCover}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={changeCoverSaving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={changeCoverSaving || changeCoverLoading}
              onClick={(e) => { e.preventDefault(); void submitChangeCover(); }}
            >
              {changeCoverSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImageIcon className="mr-2 h-4 w-4" />}
              Guardar portada
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialogo para imprimir lista: titulo, encabezado y pie de pagina */}
      <AlertDialog open={printListDialogOpen} onOpenChange={(open) => { if (!open) setPrintListDialogOpen(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Imprimir lista</AlertDialogTitle>
            <AlertDialogDescription>
              Opcional: agrega un titulo, encabezado y pie de pagina para la hoja a imprimir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="mb-1.5 block text-sm font-medium">Formato</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={printListVariant === 'list' ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPrintListVariant('list')}
                >
                  <List className="mr-2 h-4 w-4" />
                  Lista
                </Button>
                <Button
                  type="button"
                  variant={printListVariant === 'detail' ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPrintListVariant('detail')}
                >
                  <ListChecks className="mr-2 h-4 w-4" />
                  Detalles
                </Button>
              </div>
            </div>
            <div>
              <Label htmlFor="print-list-title" className="mb-1.5 block text-sm font-medium">Titulo</Label>
              <Input id="print-list-title" value={printListTitle} onChange={(e) => setPrintListTitle(e.target.value)} placeholder="Titulo (opcional)" autoFocus />
            </div>
            <div>
              <Label htmlFor="print-list-header" className="mb-1.5 block text-sm font-medium">Encabezado</Label>
              <Input id="print-list-header" value={printListHeader} onChange={(e) => setPrintListHeader(e.target.value)} placeholder="Encabezado (opcional)" />
            </div>
            <div>
              <Label htmlFor="print-list-footer" className="mb-1.5 block text-sm font-medium">Pie de pagina</Label>
              <Input id="print-list-footer" value={printListFooter} onChange={(e) => setPrintListFooter(e.target.value)} placeholder="Pie de pagina (opcional)" />
              <Button
                type="button"
                variant={printListPageNumber ? "default" : "outline"}
                size="sm"
                className="mt-2"
                onClick={() => setPrintListPageNumber(v => !v)}
              >
                {printListPageNumber && <Check className="mr-2 h-4 w-4" />}
                Insertar numero de pagina
              </Button>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void doPrintList(); }}>
              <Printer className="mr-2 h-4 w-4" />
              Imprimir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={printCardsDialogOpen} onOpenChange={(open) => { if (!open) setPrintCardsDialogOpen(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Imprimir tarjetas</AlertDialogTitle>
            <AlertDialogDescription>
              Opcional: agrega un titulo y un pie de pagina para la hoja a imprimir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            {/* 1 - Columnas */}
            <div>
              <Label className="mb-1.5 block text-sm font-medium">Columnas</Label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <Button
                    key={n}
                    type="button"
                    variant={printCardsColumns === n ? "default" : "outline"}
                    size="sm"
                    className="w-10"
                    onClick={() => {
                      setPrintCardsColumns(n);
                      if (n >= 5) {
                        setPrintCardsFields(prev => ({
                          image: true,
                          title: true,
                          source: prev.source,
                          collection: false,
                          difficulty: false,
                          dishType: false,
                          category: false,
                          times: false,
                          icons: false,
                        }));
                      }
                    }}
                  >
                    {n}
                  </Button>
                ))}
              </div>
            </div>
            {/* 2 - Campos a imprimir (sin seleccionar por defecto) */}
            <div>
              <Label className="mb-1.5 block text-sm font-medium">Campos a imprimir</Label>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {([
                  { key: 'source', label: 'Fuente' },
                  { key: 'collection', label: 'Coleccion' },
                  { key: 'difficulty', label: 'Dificultad' },
                  { key: 'dishType', label: 'Tipo de comida' },
                  { key: 'category', label: 'Categoria' },
                  { key: 'times', label: 'Tiempos y porciones' },
                  { key: 'icons', label: 'Iconos' },
                ] as const).map(({ key, label }) => {
                  const disabled = printCardsCompactFieldsOnly && key !== 'source';
                  return (
                  <label key={key} className={`flex items-center gap-2 text-sm ${disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer'}`}>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={disabled ? false : printCardsFields[key]}
                      disabled={disabled}
                      onChange={(e) => setPrintCardsFields(prev => ({ ...prev, [key]: e.target.checked }))}
                    />
                    {label}
                  </label>
                  );
                })}
              </div>
            </div>
            {/* 3 - Titulo del documento */}
            <div>
              <Label htmlFor="print-cards-title" className="mb-1.5 block text-sm font-medium">Titulo del documento</Label>
              <Input
                id="print-cards-title"
                value={printCardsTitle}
                onChange={(e) => setPrintCardsTitle(e.target.value)}
                placeholder="Titulo del documento (opcional)"
              />
            </div>
            {/* 4 - Encabezado */}
            <div>
              <Label htmlFor="print-cards-header" className="mb-1.5 block text-sm font-medium">Encabezado</Label>
              <Input
                id="print-cards-header"
                value={printCardsHeader}
                onChange={(e) => setPrintCardsHeader(e.target.value)}
                placeholder="Encabezado (opcional)"
              />
            </div>
            {/* 5 - Pie de pagina */}
            <div>
              <Label htmlFor="print-cards-footer" className="mb-1.5 block text-sm font-medium">Pie de pagina</Label>
              <Input
                id="print-cards-footer"
                value={printCardsFooter}
                onChange={(e) => setPrintCardsFooter(e.target.value)}
                placeholder="Pie de pagina (opcional)"
              />
              <Button
                type="button"
                variant={printCardsPageNumber ? "default" : "outline"}
                size="sm"
                className="mt-2"
                onClick={() => setPrintCardsPageNumber(v => !v)}
              >
                {printCardsPageNumber && <Check className="mr-2 h-4 w-4" />}
                Insertar numero de pagina
              </Button>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void doPrintCards(); }}>
              <Printer className="mr-2 h-4 w-4" />
              Imprimir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Botones de navegacion arriba/abajo */}
      <div className="fixed bottom-8 right-6 z-50 flex flex-col gap-2">
        {showScrollTop && (
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="scroll-navigation-arrow flex h-7 w-7 items-center justify-center rounded-full bg-primary/65 text-white shadow-[0_3px_10px_rgba(0,0,0,0.22)] backdrop-blur-sm transition-all hover:scale-105 hover:bg-primary/80 hover:shadow-[0_5px_14px_rgba(0,0,0,0.28)]"
            aria-label="Ir a la primera receta"
            title="Ir a la primera receta"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })}
          className="scroll-navigation-arrow flex h-7 w-7 items-center justify-center rounded-full bg-primary/65 text-white shadow-[0_3px_10px_rgba(0,0,0,0.22)] backdrop-blur-sm transition-all hover:scale-105 hover:bg-primary/80 hover:shadow-[0_5px_14px_rgba(0,0,0,0.28)]"
          aria-label="Ir a la ultima receta"
          title="Ir a la ultima receta"
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </button>
      </div>

    </div>
  );
};

export default Index;


