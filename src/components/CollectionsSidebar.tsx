import { useState, useEffect, useRef } from "react";
import { ChevronRight, ChevronDown, ImageIcon, Plus, Loader2, Heart, WheatOff, Leaf, ChefHat } from "lucide-react";
import { AvocadoIcon } from "@/components/icons/AvocadoIcon";
import { RecipePreparedIcon } from "@/components/icons/RecipePreparedIcon";
import { RecipeCollection } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CategoryItem {
  name: string;
  count: number;
  cover?: string;
}

interface CollectionsSidebarProps {
  collections: RecipeCollection[];
  covers?: Record<string, string | undefined>;
  activeCollectionId?: string;
  onSelectCollection: (id: string | undefined) => void;
  onShowCollections?: () => void;
  onCreateCollection?: (name: string) => Promise<void> | void;
  totalRecipes: number;
  allRecipesActive?: boolean;
  favoritesActive?: boolean;
  favoritesCount?: number;
  onSelectFavorites?: () => void;
  cookedActive?: boolean;
  cookedCount?: number;
  onSelectCooked?: () => void;
  thermomixActive?: boolean;
  thermomixCount?: number;
  onSelectThermomix?: () => void;
  airFryerActive?: boolean;
  airFryerCount?: number;
  onSelectAirFryer?: () => void;
  glutenFreeActive?: boolean;
  glutenFreeCount?: number;
  onSelectGlutenFree?: () => void;
  ketoActive?: boolean;
  ketoCount?: number;
  onSelectKeto?: () => void;
  healthyActive?: boolean;
  healthyCount?: number;
  onSelectHealthy?: () => void;
  vegetarianActive?: boolean;
  vegetarianCount?: number;
  onSelectVegetarian?: () => void;
  categories?: CategoryItem[];
  activeCategory?: string;
  onSelectCategory?: (name: string) => void;
  onShowCategories?: () => void;
  onCreateCategory?: (name: string) => Promise<void> | void;
  sources?: CategoryItem[];
  activeSource?: string;
  onSelectSource?: (name: string) => void;
  onShowSources?: () => void;
  onCreateSource?: (name: string) => Promise<void> | void;
  tags?: CategoryItem[];
  activeTag?: string;
  onSelectTag?: (name: string) => void;
  onShowTags?: () => void;
  onCreateTag?: (name: string) => Promise<void> | void;
  dishTypes?: CategoryItem[];
  activeDishType?: string;
  onSelectDishType?: (name: string) => void;
  onShowDishTypes?: () => void;
  onCreateDishType?: (name: string) => Promise<void> | void;
  authors?: CategoryItem[];
  activeAuthor?: string;
  onSelectAuthor?: (name: string) => void;
  onShowAuthors?: () => void;
  onCreateAuthor?: (name: string) => Promise<void> | void;
}

// Panel lateral estilo Cookidoo: título "Colecciones", la lista de colecciones
// (colapsable, con opción de crear una nueva) y la lista de categorías.
export const CollectionsSidebar = ({
  collections,
  covers,
  activeCollectionId,
  onSelectCollection,
  onShowCollections,
  onCreateCollection,
  totalRecipes,
  allRecipesActive,
  favoritesActive,
  favoritesCount,
  onSelectFavorites,
  cookedActive,
  cookedCount,
  onSelectCooked,
  thermomixActive,
  thermomixCount,
  onSelectThermomix,
  airFryerActive,
  airFryerCount,
  onSelectAirFryer,
  glutenFreeActive,
  glutenFreeCount,
  onSelectGlutenFree,
  ketoActive,
  ketoCount,
  onSelectKeto,
  healthyActive,
  healthyCount,
  onSelectHealthy,
  vegetarianActive,
  vegetarianCount,
  onSelectVegetarian,
  categories,
  activeCategory,
  onSelectCategory,
  onShowCategories,
  onCreateCategory,
  sources,
  activeSource,
  onSelectSource,
  onShowSources,
  onCreateSource,
  tags,
  activeTag,
  onSelectTag,
  onShowTags,
  onCreateTag,
  dishTypes,
  activeDishType,
  onSelectDishType,
  onShowDishTypes,
  onCreateDishType,
  authors,
  activeAuthor,
  onSelectAuthor,
  onShowAuthors,
  onCreateAuthor,
}: CollectionsSidebarProps) => {
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [dishTypesOpen, setDishTypesOpen] = useState(false);
  const [authorsOpen, setAuthorsOpen] = useState(false);
  const activeCollectionRef = useRef<HTMLButtonElement>(null);

  // Al abrir una colección (p. ej. desde la galería), desplegar la sección
  // "Colecciones" del panel y desplazar hasta la colección activa.
  useEffect(() => {
    if (!activeCollectionId) return;
    setCollectionsOpen(true);
    setCategoriesOpen(false);
    setSourcesOpen(false);
    setDishTypesOpen(false);
  }, [activeCollectionId]);

  useEffect(() => {
    if (activeCollectionId && collectionsOpen) {
      activeCollectionRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [activeCollectionId, collectionsOpen]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [creatingCat, setCreatingCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [savingCat, setSavingCat] = useState(false);
  const [creatingDish, setCreatingDish] = useState(false);
  const [newDishName, setNewDishName] = useState("");
  const [savingDish, setSavingDish] = useState(false);
  const [creatingSource, setCreatingSource] = useState(false);
  const [newSourceName, setNewSourceName] = useState("");
  const [savingSource, setSavingSource] = useState(false);
  const [creatingTag, setCreatingTag] = useState(false);
  const [newTagNameSb, setNewTagNameSb] = useState("");
  const [savingTag, setSavingTag] = useState(false);
  const [creatingAuthor, setCreatingAuthor] = useState(false);
  const [newAuthorName, setNewAuthorName] = useState("");
  const [savingAuthor, setSavingAuthor] = useState(false);

  const submitNewCollection = async () => {
    const trimmed = newName.trim();
    if (!trimmed || !onCreateCollection) return;
    setSaving(true);
    try {
      await onCreateCollection(trimmed);
      setNewName("");
      setCreating(false);
    } finally {
      setSaving(false);
    }
  };

  const submitNewCategory = async () => {
    const trimmed = newCatName.trim();
    if (!trimmed || !onCreateCategory) return;
    setSavingCat(true);
    try {
      await onCreateCategory(trimmed);
      setNewCatName("");
      setCreatingCat(false);
    } finally {
      setSavingCat(false);
    }
  };

  const submitNewDishType = async () => {
    const trimmed = newDishName.trim();
    if (!trimmed || !onCreateDishType) return;
    setSavingDish(true);
    try {
      await onCreateDishType(trimmed);
      setNewDishName("");
      setCreatingDish(false);
    } finally {
      setSavingDish(false);
    }
  };

  const submitNewSource = async () => {
    const trimmed = newSourceName.trim();
    if (!trimmed || !onCreateSource) return;
    setSavingSource(true);
    try {
      await onCreateSource(trimmed);
      setNewSourceName("");
      setCreatingSource(false);
    } finally {
      setSavingSource(false);
    }
  };

  const submitNewTag = async () => {
    const trimmed = newTagNameSb.trim();
    if (!trimmed || !onCreateTag) return;
    setSavingTag(true);
    try {
      await onCreateTag(trimmed);
      setNewTagNameSb("");
      setCreatingTag(false);
    } finally {
      setSavingTag(false);
    }
  };

  const submitNewAuthor = async () => {
    const trimmed = newAuthorName.trim();
    if (!trimmed || !onCreateAuthor) return;
    setSavingAuthor(true);
    try {
      await onCreateAuthor(trimmed);
      setNewAuthorName("");
      setCreatingAuthor(false);
    } finally {
      setSavingAuthor(false);
    }
  };

  return (
    <div className="rounded-lg border border-border/60 bg-card">
      {/* Todas las recetas */}
      <button
        type="button"
        onClick={() => { setCollectionsOpen(false); setCategoriesOpen(false); setSourcesOpen(false); setDishTypesOpen(false); setAuthorsOpen(false); setTagsOpen(false); onSelectCollection(undefined); }}
        className={`flex w-full items-center justify-between h-9 px-4 text-xs font-semibold uppercase tracking-wide transition-colors ${
          allRecipesActive ? "bg-accent/60 text-foreground" : "text-muted-foreground hover:bg-muted/50"
        }`}
      >
        <span>Todas las recetas</span>
        <span className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{totalRecipes}</span>
          <span className="flex h-6 w-6 items-center justify-center">
            <ChefHat className="h-[18px] w-[18px]" />
          </span>
        </span>
      </button>

      {/* Encabezado colapsable de colecciones (fijo arriba al desplazarse) */}
      <button
        type="button"
        onClick={() => { setCategoriesOpen(false); setSourcesOpen(false); setDishTypesOpen(false); setAuthorsOpen(false); setTagsOpen(false); setCollectionsOpen((v) => !v); onShowCollections?.(); }}
        className={`sticky top-0 z-10 flex w-full items-center justify-between border-t border-border/60 h-9 px-4 text-xs font-semibold uppercase tracking-wide transition-colors ${
          collectionsOpen ? "bg-accent text-accent-foreground" : "bg-card text-muted-foreground hover:text-foreground"
        }`}
        aria-expanded={collectionsOpen}
      >
        <span>Colecciones</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${collectionsOpen ? "" : "-rotate-90"}`} />
      </button>

      {collectionsOpen && (
        <div className="pb-2">
          {collections.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">Todavía no tenés colecciones.</p>
          ) : (
            collections.map((collection) => {
              const cover = covers?.[collection.id];
              return (
                <button
                  key={collection.id}
                  ref={activeCollectionId === collection.id ? activeCollectionRef : undefined}
                  type="button"
                  onClick={() => onSelectCollection(collection.id)}
                  className={`flex w-full items-center gap-3 px-4 py-2 text-sm transition-colors ${
                    activeCollectionId === collection.id
                      ? "bg-accent/60 font-medium text-foreground"
                      : "text-foreground hover:bg-muted/50"
                  }`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                    {cover ? (
                      <img src={cover} alt="" aria-hidden="true" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-left">{collection.name}</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    {collection.recipeCount}
                    <ChevronRight className="h-4 w-4" />
                  </span>
                </button>
              );
            })
          )}

          {onCreateCollection && (
            creating ? (
              <div className="flex items-center gap-2 px-4 py-2">
                <Input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitNewCollection();
                    if (e.key === "Escape") {
                      setCreating(false);
                      setNewName("");
                    }
                  }}
                  placeholder="Nombre de la colección"
                  className="h-8 text-sm"
                />
                <Button size="sm" className="h-8" onClick={submitNewCollection} disabled={saving || !newName.trim()}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear"}
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="flex w-full items-center gap-3 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-muted/50"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-dashed border-primary/50">
                  <Plus className="h-4 w-4" />
                </span>
                <span className="flex-1 text-left">Crear nueva colección</span>
              </button>
            )
          )}
        </div>
      )}

      {/* Encabezado colapsable de tipos de comida */}
      {((dishTypes && dishTypes.length > 0) || onCreateDishType) && (
        <>
          <button
            type="button"
            onClick={() => { setCollectionsOpen(false); setCategoriesOpen(false); setSourcesOpen(false); setAuthorsOpen(false); setTagsOpen(false); setDishTypesOpen((v) => !v); onShowDishTypes?.(); }}
            className={`sticky top-0 z-10 flex w-full items-center justify-between border-t border-border/60 h-9 px-4 text-xs font-semibold uppercase tracking-wide transition-colors ${
              dishTypesOpen ? "bg-accent text-accent-foreground" : "bg-card text-muted-foreground hover:text-foreground"
            }`}
            aria-expanded={dishTypesOpen}
          >
            <span>Tipo de comida</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${dishTypesOpen ? "" : "-rotate-90"}`} />
          </button>
          {dishTypesOpen && (
            <div className="pb-2">
              {dishTypes?.map((dt) => (
                <button
                  key={dt.name}
                  type="button"
                  onClick={() => onSelectDishType?.(dt.name)}
                  className={`flex w-full items-center gap-3 px-4 py-2 text-sm transition-colors ${
                    activeDishType === dt.name
                      ? "bg-accent/60 font-medium text-foreground"
                      : "text-foreground hover:bg-muted/50"
                  }`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                    {dt.cover ? (
                      <img src={dt.cover} alt="" aria-hidden="true" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-left">{dt.name}</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    {dt.count}
                    <ChevronRight className="h-4 w-4" />
                  </span>
                </button>
              ))}

              {onCreateDishType && (
                creatingDish ? (
                  <div className="flex items-center gap-2 px-4 py-2">
                    <Input
                      autoFocus
                      value={newDishName}
                      onChange={(e) => setNewDishName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitNewDishType();
                        if (e.key === "Escape") {
                          setCreatingDish(false);
                          setNewDishName("");
                        }
                      }}
                      placeholder="Nombre del tipo de comida"
                      className="h-8 text-sm"
                    />
                    <Button size="sm" className="h-8" onClick={submitNewDishType} disabled={savingDish || !newDishName.trim()}>
                      {savingDish ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear"}
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCreatingDish(true)}
                    className="flex w-full items-center gap-3 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-muted/50"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-dashed border-primary/50">
                      <Plus className="h-4 w-4" />
                    </span>
                    <span className="flex-1 text-left">Crear tipo de comida</span>
                  </button>
                )
              )}
            </div>
          )}
        </>
      )}

      {((categories && categories.length > 0) || onCreateCategory) && (
        <>
          <button
            type="button"
            onClick={() => { setCollectionsOpen(false); setSourcesOpen(false); setDishTypesOpen(false); setAuthorsOpen(false); setTagsOpen(false); setCategoriesOpen((v) => !v); onShowCategories?.(); }}
            className={`sticky top-0 z-10 flex w-full items-center justify-between border-t border-border/60 h-9 px-4 text-xs font-semibold uppercase tracking-wide transition-colors ${
              categoriesOpen ? "bg-accent text-accent-foreground" : "bg-card text-muted-foreground hover:text-foreground"
            }`}
            aria-expanded={categoriesOpen}
          >
            <span>Categorías</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${categoriesOpen ? "" : "-rotate-90"}`} />
          </button>
          {categoriesOpen && (
          <div className="pb-2">
            {categories?.map((category) => (
              <button
                key={category.name}
                type="button"
                onClick={() => onSelectCategory?.(category.name)}
                className={`flex w-full items-center gap-3 px-4 py-2 text-sm transition-colors ${
                  activeCategory === category.name
                    ? "bg-accent/60 font-medium text-foreground"
                    : "text-foreground hover:bg-muted/50"
                }`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                  {category.cover ? (
                    <img src={category.cover} alt="" aria-hidden="true" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-left">{category.name}</span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  {category.count}
                  <ChevronRight className="h-4 w-4" />
                </span>
              </button>
            ))}

            {onCreateCategory && (
              creatingCat ? (
                <div className="flex items-center gap-2 px-4 py-2">
                  <Input
                    autoFocus
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitNewCategory();
                      if (e.key === "Escape") {
                        setCreatingCat(false);
                        setNewCatName("");
                      }
                    }}
                    placeholder="Nombre de la categoría"
                    className="h-8 text-sm"
                  />
                  <Button size="sm" className="h-8" onClick={submitNewCategory} disabled={savingCat || !newCatName.trim()}>
                    {savingCat ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear"}
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCreatingCat(true)}
                  className="flex w-full items-center gap-3 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-muted/50"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-dashed border-primary/50">
                    <Plus className="h-4 w-4" />
                  </span>
                  <span className="flex-1 text-left">Crear nueva categoría</span>
                </button>
              )
            )}
          </div>
          )}
        </>
      )}

      {/* Encabezado colapsable de fuentes */}
      {((sources && sources.length > 0) || onCreateSource) && (
        <>
          <button
            type="button"
            onClick={() => { setCollectionsOpen(false); setCategoriesOpen(false); setDishTypesOpen(false); setAuthorsOpen(false); setTagsOpen(false); setSourcesOpen((v) => !v); onShowSources?.(); }}
            className={`sticky top-0 z-10 flex w-full items-center justify-between border-t border-border/60 h-9 px-4 text-xs font-semibold uppercase tracking-wide transition-colors ${
              sourcesOpen ? "bg-accent text-accent-foreground" : "bg-card text-muted-foreground hover:text-foreground"
            }`}
            aria-expanded={sourcesOpen}
          >
            <span>Fuente</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${sourcesOpen ? "" : "-rotate-90"}`} />
          </button>
          {sourcesOpen && (
            <div className="pb-2">
              {sources?.map((source) => (
                <button
                  key={source.name}
                  type="button"
                  onClick={() => onSelectSource?.(source.name)}
                  className={`flex w-full items-center gap-3 px-4 py-2 text-sm transition-colors ${
                    activeSource === source.name
                      ? "bg-accent/60 font-medium text-foreground"
                      : "text-foreground hover:bg-muted/50"
                  }`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                    {source.cover ? (
                      <img src={source.cover} alt="" aria-hidden="true" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-left">{source.name}</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    {source.count}
                    <ChevronRight className="h-4 w-4" />
                  </span>
                </button>
              ))}

              {onCreateSource && (
                creatingSource ? (
                  <div className="flex items-center gap-2 px-4 py-2">
                    <Input
                      autoFocus
                      value={newSourceName}
                      onChange={(e) => setNewSourceName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitNewSource();
                        if (e.key === "Escape") {
                          setCreatingSource(false);
                          setNewSourceName("");
                        }
                      }}
                      placeholder="Nombre de la fuente"
                      className="h-8 text-sm"
                    />
                    <Button size="sm" className="h-8" onClick={submitNewSource} disabled={savingSource || !newSourceName.trim()}>
                      {savingSource ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear"}
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCreatingSource(true)}
                    className="flex w-full items-center gap-3 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-muted/50"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-dashed border-primary/50">
                      <Plus className="h-4 w-4" />
                    </span>
                    <span className="flex-1 text-left">Crear nueva fuente</span>
                  </button>
                )
              )}
            </div>
          )}
        </>
      )}

      {/* Encabezado colapsable de etiquetas */}
      {((tags && tags.length > 0) || onCreateTag) && (
        <>
          <button
            type="button"
            onClick={() => { setCollectionsOpen(false); setCategoriesOpen(false); setDishTypesOpen(false); setAuthorsOpen(false); setSourcesOpen(false); setTagsOpen((v) => !v); onShowTags?.(); }}
            className={`sticky top-0 z-10 flex w-full items-center justify-between border-t border-border/60 h-9 px-4 text-xs font-semibold uppercase tracking-wide transition-colors ${
              tagsOpen ? "bg-accent text-accent-foreground" : "bg-card text-muted-foreground hover:text-foreground"
            }`}
            aria-expanded={tagsOpen}
          >
            <span>Etiquetas</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${tagsOpen ? "" : "-rotate-90"}`} />
          </button>
          {tagsOpen && (
            <div className="pb-2">
              {tags?.map((tag) => (
                <button
                  key={tag.name}
                  type="button"
                  onClick={() => onSelectTag?.(tag.name)}
                  className={`flex w-full items-center gap-3 px-4 py-2 text-sm transition-colors ${
                    activeTag === tag.name
                      ? "bg-accent/60 font-medium text-foreground"
                      : "text-foreground hover:bg-muted/50"
                  }`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                    {tag.cover ? (
                      <img src={tag.cover} alt="" aria-hidden="true" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-left">{tag.name}</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    {tag.count}
                    <ChevronRight className="h-4 w-4" />
                  </span>
                </button>
              ))}

              {onCreateTag && (
                creatingTag ? (
                  <div className="flex items-center gap-2 px-4 py-2">
                    <Input
                      autoFocus
                      value={newTagNameSb}
                      onChange={(e) => setNewTagNameSb(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitNewTag();
                        if (e.key === "Escape") {
                          setCreatingTag(false);
                          setNewTagNameSb("");
                        }
                      }}
                      placeholder="Nombre de la etiqueta"
                      className="h-8 text-sm"
                    />
                    <Button size="sm" className="h-8" onClick={submitNewTag} disabled={savingTag || !newTagNameSb.trim()}>
                      {savingTag ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear"}
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCreatingTag(true)}
                    className="flex w-full items-center gap-3 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-muted/50"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-dashed border-primary/50">
                      <Plus className="h-4 w-4" />
                    </span>
                    <span className="flex-1 text-left">Crear nueva etiqueta</span>
                  </button>
                )
              )}
            </div>
          )}
        </>
      )}

      {/* Encabezado colapsable de autores */}
      {((authors && authors.length > 0) || onCreateAuthor) && (
        <>
          <button
            type="button"
            onClick={() => { setCollectionsOpen(false); setCategoriesOpen(false); setSourcesOpen(false); setTagsOpen(false); setDishTypesOpen(false); setAuthorsOpen((v) => !v); onShowAuthors?.(); }}
            className={`flex w-full items-center justify-between border-t border-border/60 h-9 px-4 text-xs font-semibold uppercase tracking-wide transition-colors ${
              authorsOpen ? "bg-accent/60 text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
            aria-expanded={authorsOpen}
          >
            <span>Autores</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${authorsOpen ? "" : "-rotate-90"}`} />
          </button>
          {authorsOpen && (
            <div className="max-h-[50vh] overflow-y-auto pb-2">
              {authors?.map((author) => (
                <button
                  key={author.name}
                  type="button"
                  onClick={() => onSelectAuthor?.(author.name)}
                  className={`flex w-full items-center gap-3 px-4 py-2 text-sm transition-colors ${
                    activeAuthor === author.name
                      ? "bg-accent/60 font-medium text-foreground"
                      : "text-foreground hover:bg-muted/50"
                  }`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                    {author.cover ? (
                      <img src={author.cover} alt="" aria-hidden="true" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-left">{author.name}</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    {author.count}
                    <ChevronRight className="h-4 w-4" />
                  </span>
                </button>
              ))}

              {onCreateAuthor && (
                creatingAuthor ? (
                  <div className="flex items-center gap-2 px-4 py-2">
                    <Input
                      autoFocus
                      value={newAuthorName}
                      onChange={(e) => setNewAuthorName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitNewAuthor();
                        if (e.key === "Escape") {
                          setCreatingAuthor(false);
                          setNewAuthorName("");
                        }
                      }}
                      placeholder="Nombre del autor"
                      className="h-8 text-sm"
                    />
                    <Button size="sm" className="h-8" onClick={submitNewAuthor} disabled={savingAuthor || !newAuthorName.trim()}>
                      {savingAuthor ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear"}
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCreatingAuthor(true)}
                    className="flex w-full items-center gap-3 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-muted/50"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-dashed border-primary/50">
                      <Plus className="h-4 w-4" />
                    </span>
                    <span className="flex-1 text-left">Crear nuevo autor</span>
                  </button>
                )
              )}
            </div>
          )}
        </>
      )}

      {/* Favoritas */}
      {onSelectFavorites && (
        <button
          type="button"
          onClick={onSelectFavorites}
          className={`flex w-full items-center justify-between border-t border-border/60 h-9 px-4 text-xs font-semibold uppercase tracking-wide transition-colors ${
            favoritesActive ? "bg-accent/60 text-foreground" : "text-muted-foreground hover:bg-muted/50"
          }`}
        >
          <span>Favoritas</span>
          <span className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{favoritesCount ?? 0}</span>
            <span className="flex h-6 w-6 items-center justify-center">
              <Heart className={`h-[18px] w-[18px] ${favoritesActive ? "fill-current text-foreground" : "text-muted-foreground"}`} />
            </span>
          </span>
        </button>
      )}

      {/* Cocinadas */}
      {onSelectCooked && (
        <button
          type="button"
          onClick={onSelectCooked}
          className={`flex w-full items-center justify-between border-t border-border/60 h-9 px-4 text-xs font-semibold uppercase tracking-wide transition-colors ${
            cookedActive ? "bg-accent/60 text-foreground" : "text-muted-foreground hover:bg-muted/50"
          }`}
        >
          <span>Cocinadas</span>
          <span className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{cookedCount ?? 0}</span>
            <span className="flex h-6 w-6 items-center justify-center">
              <RecipePreparedIcon style={{ width: 24, height: 24 }} className={cookedActive ? "text-foreground" : "text-muted-foreground"} />
            </span>
          </span>
        </button>
      )}

      {/* Thermomix */}
      {onSelectThermomix && (
        <button
          type="button"
          onClick={onSelectThermomix}
          className={`flex w-full items-center justify-between border-t border-border/60 h-9 px-4 text-xs font-semibold uppercase tracking-wide transition-colors ${
            thermomixActive ? "bg-accent/60 text-foreground" : "text-muted-foreground hover:bg-muted/50"
          }`}
        >
          <span>Thermomix</span>
          <span className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{thermomixCount ?? 0}</span>
            <span className="flex h-6 w-6 items-center justify-center">
              <img src="/thermomix-logo.transparent.png" alt="" aria-hidden="true" className="h-6 w-6 object-contain" />
            </span>
          </span>
        </button>
      )}

      {/* Air Fryer */}
      {onSelectAirFryer && (
        <button
          type="button"
          onClick={onSelectAirFryer}
          className={`flex w-full items-center justify-between border-t border-border/60 h-9 px-4 text-xs font-semibold uppercase tracking-wide transition-colors ${
            airFryerActive ? "bg-accent/60 text-foreground" : "text-muted-foreground hover:bg-muted/50"
          }`}
        >
          <span>Air Fryer</span>
          <span className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{airFryerCount ?? 0}</span>
            <span className="flex h-6 w-6 items-center justify-center">
              <img src="/air-fryer.transparent.png" alt="" aria-hidden="true" className="h-5 w-5 object-contain" />
            </span>
          </span>
        </button>
      )}

      {/* Sin Gluten */}
      {onSelectGlutenFree && (
        <button
          type="button"
          onClick={onSelectGlutenFree}
          className={`flex w-full items-center justify-between border-t border-border/60 h-9 px-4 text-xs font-semibold uppercase tracking-wide transition-colors ${
            glutenFreeActive ? "bg-accent/60 text-foreground" : "text-muted-foreground hover:bg-muted/50"
          }`}
        >
          <span>Sin Gluten</span>
          <span className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{glutenFreeCount ?? 0}</span>
            <span className="flex h-6 w-6 items-center justify-center">
              <WheatOff className="h-4 w-4" />
            </span>
          </span>
        </button>
      )}

      {/* Keto */}
      {onSelectKeto && (
        <button
          type="button"
          onClick={onSelectKeto}
          className={`flex w-full items-center justify-between border-t border-border/60 h-9 px-4 text-xs font-semibold uppercase tracking-wide transition-colors ${
            ketoActive ? "bg-accent/60 text-foreground" : "text-muted-foreground hover:bg-muted/50"
          }`}
        >
          <span>Keto</span>
          <span className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{ketoCount ?? 0}</span>
            <span className="flex h-6 w-6 items-center justify-center">
              <AvocadoIcon className="h-[22px] w-[22px]" />
            </span>
          </span>
        </button>
      )}

      {/* Low Carb */}
      {onSelectHealthy && (
        <button
          type="button"
          onClick={onSelectHealthy}
          className={`flex w-full items-center justify-between border-t border-border/60 h-9 px-4 text-xs font-semibold uppercase tracking-wide transition-colors ${
            healthyActive ? "bg-accent/60 text-foreground" : "text-muted-foreground hover:bg-muted/50"
          }`}
        >
          <span>Low Carb</span>
          <span className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{healthyCount ?? 0}</span>
            <span className="flex h-6 w-6 items-center justify-center">
              <img src="/logo-saludable.png" alt="" aria-hidden="true" className="h-5 w-5 object-contain grayscale opacity-70" />
            </span>
          </span>
        </button>
      )}

      {/* Vegetarianas */}
      {onSelectVegetarian && (
        <button
          type="button"
          onClick={onSelectVegetarian}
          className={`flex w-full items-center justify-between border-t border-border/60 h-9 px-4 text-xs font-semibold uppercase tracking-wide transition-colors ${
            vegetarianActive ? "bg-accent/60 text-foreground" : "text-muted-foreground hover:bg-muted/50"
          }`}
        >
          <span>Vegetarianas</span>
          <span className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{vegetarianCount ?? 0}</span>
            <span className="flex h-6 w-6 items-center justify-center">
              <Leaf className="h-[18px] w-[18px]" />
            </span>
          </span>
        </button>
      )}

    </div>
  );
};
