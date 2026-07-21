import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Beef, CakeSlice, CandyOff, Check, Clock, User, ChefHat, Edit, Trash2, MoreVertical, Heart, Bookmark, Send, Printer, Download, ExternalLink, ArrowUpRightFromSquare, Calculator, Timer, WheatOff, Leaf, X, Loader2, Utensils } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MultiSelectCombobox } from "@/components/MultiSelectCombobox";
import { Recipe } from "@/types/recipe";
import { AvocadoIcon } from "@/components/icons/AvocadoIcon";
import { RecipePreparedIcon } from "@/components/icons/RecipePreparedIcon";
import { PreparationTimeIcon } from "@/components/icons/PreparationTimeIcon";
import { resolveImageUrl } from "@/utils/api";
import { isThermomixRecipe } from "@/utils/recipeUtils";
import { parseCategories } from "@/constants/categories";
import { getSourceFromUrl, isValidUrl, getRecipeSource } from "@/utils/siteUtils";
import { downloadRecipePdf, printRecipePdf, shareRecipePdf } from "@/utils/pdfUtils";
import { useState } from "react";
import { toast } from "sonner";

interface RecipeCardProps {
  recipe: Recipe;
  onView: (recipe: Recipe) => void;
  onEdit?: (recipe: Recipe) => void;
  onDelete?: (recipe: Recipe) => void;
  onToggleFavorite?: (recipe: Recipe) => void;
  onToggleCooked?: (recipe: Recipe) => void;
  onPlayTTS?: (recipe: Recipe) => void;
  onShowNutrition?: (recipe: Recipe) => void;
  onSaveToCollection?: (recipe: Recipe) => void;
  onCategoryClick?: (category: string) => void;
  isInCollection?: boolean;
  columns?: 1 | 2 | 3 | 4 | 5;
  collectionNames?: string[];
  // Edición inline en vista de 1 columna (Tipo de comida / Categoría / Colección).
  dishTypeOptions?: string[];
  categoryOptions?: string[];
  sourceOptions?: string[];
  allCollections?: { id: string; name: string }[];
  onInlineSave?: (recipeId: string, data: { source: string; dishType: string; recipeType: string; collectionIds: string[] }) => Promise<void> | void;
  // Activar/desactivar características (favorita, cocinada, thermomix, etc.) desde el popover.
  onToggleFeature?: (recipe: Recipe, field: string, value: boolean) => void;
  isPlayingTTS?: boolean;
  isGeneratingScript?: boolean;
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelectionChange?: (recipe: Recipe, modifiers?: { shift?: boolean; ctrl?: boolean }) => void;
}

// Características editables desde el popover "ON".
const FEATURE_TOGGLES: { field: string; label: string; icon: JSX.Element }[] = [
  { field: 'featured', label: 'Favorita', icon: <Heart className="h-4 w-4" /> },
  { field: 'cooked', label: 'Cocinada', icon: <RecipePreparedIcon className="!h-5 !w-5" /> },
  { field: 'thermomix', label: 'Thermomix', icon: <img src="/thermomix-logo.png" alt="" aria-hidden="true" className="!h-5 !w-5 object-contain" /> },
  { field: 'airFryer', label: 'Air Fryer', icon: <img src="/air-fryer.png" alt="" aria-hidden="true" className="h-4 w-4 object-contain" /> },
  { field: 'glutenFree', label: 'Sin Gluten', icon: <WheatOff className="h-4 w-4" /> },
  { field: 'sugarFree', label: 'Sin Azucar', icon: <CandyOff className="h-4 w-4" /> },
  { field: 'keto', label: 'Keto', icon: <AvocadoIcon className="!h-[18px] !w-[18px]" /> },
  { field: 'lowCarb', label: 'Low Carb', icon: <img src="/logo-saludable.png" alt="" aria-hidden="true" className="h-4 w-4 object-contain" /> },
  { field: 'proteica', label: 'Proteica', icon: <Beef className="h-4 w-4" /> },
  { field: 'vegetarian', label: 'Vegetariana', icon: <Leaf className="h-4 w-4" /> },
  { field: 'sweet', label: 'Receta dulce', icon: <CakeSlice className="h-4 w-4" /> },
  { field: 'savory', label: 'Receta salada', icon: <Utensils className="h-4 w-4" /> },
];

export const RecipeCard = ({ recipe, onView, onEdit, onDelete, onToggleFavorite, onToggleCooked, onPlayTTS, onShowNutrition, onSaveToCollection, onCategoryClick, isInCollection = false, columns = 3, collectionNames = [], dishTypeOptions = [], categoryOptions = [], sourceOptions = [], allCollections = [], onInlineSave, onToggleFeature, isPlayingTTS = false, isGeneratingScript = false, selectionMode = false, isSelected = false, onSelectionChange }: RecipeCardProps) => {
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  // Edición inline (vista 1 columna) de los campos visibles.
  const [inlineEditing, setInlineEditing] = useState(false);
  const [savingInline, setSavingInline] = useState(false);
  const [editDishType, setEditDishType] = useState<string[]>([]);
  const [editCategories, setEditCategories] = useState<string[]>([]);
  const [editCollections, setEditCollections] = useState<string[]>([]); // nombres

  const startInlineEdit = () => {
    setEditDishType((recipe.dishType || '').split(',').map(s => s.trim()).filter(Boolean));
    setEditCategories(parseCategories(recipe.recipeType));
    setEditCollections(collectionNames);
    setInlineEditing(true);
  };

  const saveInlineEdit = async () => {
    if (!onInlineSave) return;
    setSavingInline(true);
    try {
      const collectionIds = editCollections
        .map(name => allCollections.find(c => c.name === name)?.id)
        .filter(Boolean) as string[];
      await onInlineSave(recipe.id, {
        dishType: editDishType.join(', '),
        recipeType: editCategories.join(', '),
        collectionIds,
      });
      setInlineEditing(false);
    } finally {
      setSavingInline(false);
    }
  };
  const handleCardClick = (e?: React.MouseEvent) => {
    if (selectionMode) {
      e?.preventDefault();
      onSelectionChange?.(recipe, { shift: e?.shiftKey, ctrl: e?.ctrlKey || e?.metaKey });
      return;
    }
    onView(recipe);
  };

  const handlePdfAction = async (action: 'share' | 'print' | 'download') => {
    setIsPdfLoading(true);
    try {
      switch (action) {
        case 'share':
          await shareRecipePdf(recipe);
          toast.success('PDF compartido exitosamente');
          break;
        case 'print':
          await printRecipePdf(recipe);
          toast.success('Enviando a imprimir...');
          break;
        case 'download':
          await downloadRecipePdf(recipe);
          toast.success('PDF descargado exitosamente');
          break;
      }
    } catch (error) {
      toast.error(error.message || 'Error al procesar el PDF');
    } finally {
      setIsPdfLoading(false);
    }
  };

  const primaryImage = recipe.images?.[0];
  const categories = parseCategories(recipe.recipeType);
  const sourceName = getRecipeSource(recipe) || 'Receta propia';
  // Autor sin el "@" inicial (p. ej. usuarios de Instagram).
  const categoryCharacters = categories.reduce((total, category) => total + category.length, 0);
  // Las categorías ahora hacen wrap a varias filas, así que no necesitamos achicar
  // la fuente de forma agresiva para encajarlas en un renglón: la mantenemos legible.
  const categoryFontSize = categoryCharacters > 65 ? 10 : categoryCharacters > 42 ? 11 : 12;
  const compactCategories = categoryCharacters > 42;
  // En 4 columnas las tarjetas son angostas: achicamos tiempos/porciones para que entren en una línea.
  const compact = columns >= 4;
  // En 5 columnas mostramos una tarjeta mínima: imagen, título, fuente y la línea
  // de tiempos/porciones. Ocultamos badges y categorías para que entre angosta.
  const minimal = columns === 5;
  // En 1 columna la tarjeta es horizontal y muestra info adicional a la derecha.
  const oneCol = columns === 1;
  const infoIconClass = oneCol ? "h-5 w-5" : compact ? "h-3 w-3" : "h-4 w-4";
  const hasNutritionData = recipe.calories !== null && recipe.calories !== undefined && recipe.calories > 0;

  // Get dynamic image height based on columns
  const getImageHeight = () => {
    switch (columns) {
      case 2:
        return 'h-80';
      case 3:
        return 'h-64';
      case 4:
        return 'h-56';
      case 5:
        return 'h-44';
      default:
        return 'h-64';
    }
  };

  return (
    <Card className={`group relative flex h-full overflow-hidden bg-gradient-card shadow-recipe-card transition-all duration-300 hover:shadow-elegant hover:-translate-y-1 ${oneCol ? "flex-col sm:flex-row" : "flex-col"} ${
      isSelected ? "ring-2 ring-primary ring-offset-2" : ""
    }`}>
      {selectionMode && (
        <button
          type="button"
          className="absolute inset-0 z-10 cursor-pointer"
          onClick={handleCardClick}
          aria-label={`${isSelected ? "Deseleccionar" : "Seleccionar"} ${recipe.title}`}
        />
      )}
      <div className={`relative overflow-hidden cursor-pointer ${oneCol ? "sm:w-72 sm:shrink-0" : ""}`} onClick={handleCardClick}>
        {selectionMode && (
          <span
            className={`pointer-events-none absolute right-3 bottom-3 z-20 inline-flex h-5 w-5 items-center justify-center rounded-md border-2 shadow-sm ${
              isSelected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-white bg-white/90 text-transparent"
            }`}
            aria-hidden="true"
          >
            <Check className="h-3.5 w-3.5" />
          </span>
        )}
        {primaryImage ? (
          <img
            src={resolveImageUrl(primaryImage.url)}
            alt={primaryImage.altText || recipe.title}
            className={`w-full ${getImageHeight()} object-cover transition-transform duration-300 group-hover:scale-105`}
            loading="lazy"
            crossOrigin="anonymous"
          />
        ) : (
          <div className={`w-full ${getImageHeight()} bg-gradient-to-br from-muted to-muted/60 flex items-center justify-center`}>
            <ChefHat className="h-12 w-12 text-muted-foreground" />
          </div>
        )}
        {!minimal && !selectionMode && (
        <div className={`absolute top-3 right-3 flex items-center justify-end gap-1.5 ${compact ? 'top-2 right-2 gap-1 [&_button]:h-6 [&_button]:w-6 [&_svg]:!h-3.5 [&_svg]:!w-3.5 [&_img]:!h-4 [&_img]:!w-4' : ''}`}>
          {onToggleFavorite && (
            <Button
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(recipe);
              }}
              title={recipe.featured ? "Quitar de Favoritos" : "Agregar a Favoritos"}
              aria-label={recipe.featured ? "Quitar de Favoritos" : "Agregar a Favoritos"}
              className={`order-1 h-8 w-8 p-0 ${recipe.featured ? 'bg-red-100/50 hover:bg-red-200/50' : 'bg-white/50 hover:bg-white/70'}`}
            >
              <Heart
                className={recipe.featured ? 'fill-red-500 text-red-500' : 'text-gray-600'}
                style={{ width: 20, height: 20 }}
              />
            </Button>
          )}
          {onToggleFeature && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="order-3 h-8 w-8 bg-white/50 p-0 hover:bg-white/70"
                  title="Características (favorita, cocinada, thermomix, etc.)"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ChefHat className="!h-5 !w-5 text-gray-500" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="max-h-[calc(100vh-2rem)] w-56 overflow-y-auto p-1.5" onClick={(e) => e.stopPropagation()}>
                <p className="px-1 pb-1 text-sm font-semibold text-muted-foreground">Características</p>
                <div className="space-y-0.5">
                  {FEATURE_TOGGLES.map(({ field, label, icon }) => {
                    const active = Boolean((recipe as any)[field]);
                    return (
                      <button
                        key={field}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (field === 'featured' && onToggleFavorite) {
                            onToggleFavorite(recipe);
                            return;
                          }
                          if (field === 'cooked' && onToggleCooked) {
                            onToggleCooked(recipe);
                            return;
                          }
                          onToggleFeature(recipe, field, !active);
                        }}
                        className={`flex w-full items-center justify-between gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors ${active ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-muted'}`}
                      >
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center [&>img]:h-4 [&>img]:w-4 [&>svg]:h-4 [&>svg]:w-4">
                            {icon}
                          </span>
                          <span className="truncate text-left">{label}</span>
                        </span>
                        <span className={`w-6 shrink-0 text-right text-[10px] font-bold ${active ? 'text-primary' : 'text-muted-foreground/50'}`}>{active ? 'ON' : 'OFF'}</span>
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          )}
          {onSaveToCollection && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="order-2 h-8 w-8 bg-white/50 p-0 hover:bg-white/70"
              title="Guardar en una colección"
              onClick={(event) => {
                event.stopPropagation();
                onSaveToCollection(recipe);
              }}
            >
              <Bookmark
                aria-hidden="true"
                className={isInCollection ? "fill-primary text-primary" : "text-gray-600"}
                style={{ width: 20, height: 20 }}
              />
            </Button>
          )}
          {recipe.sourceUrl && isValidUrl(recipe.sourceUrl) && (
            <Button
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                window.open(recipe.sourceUrl, '_blank', 'noopener,noreferrer');
              }}
              className="order-4 h-8 w-8 bg-white/50 p-0 hover:bg-white/70"
              title={`Ver receta original en ${getSourceFromUrl(recipe.sourceUrl)}`}
            >
              <ExternalLink className="h-4 w-4 text-gray-600" />
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                size="sm"
                className="order-5 h-8 w-8 bg-white/50 p-0 hover:bg-white/70"
              >
                <MoreVertical className="h-4 w-4 text-gray-600" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(`${window.location.origin}/receta/${recipe.id}`, '_blank', 'noopener,noreferrer');
                }}
              >
                <ArrowUpRightFromSquare className="h-4 w-4 mr-2" />
                Abrir en una nueva pestaña
              </DropdownMenuItem>
              {recipe.sourceUrl && isValidUrl(recipe.sourceUrl) && (
                <DropdownMenuItem onClick={() => window.open(recipe.sourceUrl, '_blank')}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ver en {getSourceFromUrl(recipe.sourceUrl)}
                </DropdownMenuItem>
              )}
              {onEdit && (
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation();
                  onEdit(recipe);
                }}>
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation();
                handlePdfAction('download');
              }} disabled={isPdfLoading}>
                <Download className="h-4 w-4 mr-2" />
                {isPdfLoading ? 'Generando...' : 'Descargar'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation();
                handlePdfAction('print');
              }} disabled={isPdfLoading}>
                <Printer className="h-4 w-4 mr-2" />
                {isPdfLoading ? 'Generando...' : 'Imprimir'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation();
                handlePdfAction('share');
              }} disabled={isPdfLoading}>
                <Send className="h-4 w-4 mr-2" />
                {isPdfLoading ? 'Generando...' : 'Compartir'}
              </DropdownMenuItem>
              {onShowNutrition && (
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation();
                  onShowNutrition(recipe);
                }}>
                  <Calculator className="h-4 w-4 mr-2" />
                  Ver Nutrición
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(recipe);
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        )}
      </div>

      <CardContent className="flex flex-1 cursor-pointer flex-col space-y-3 p-4" onClick={handleCardClick}>
        <div>
          <h3 className={`recipe-card-title font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors ${minimal ? "text-sm leading-tight" : oneCol ? "text-2xl leading-8" : "text-lg leading-7"}`}>
            {recipe.title}
          </h3>
          {minimal && sourceName && (
            <p className="mt-0.5 truncate text-[11px] leading-tight text-muted-foreground">
              {recipe.sourceUrl && isValidUrl(recipe.sourceUrl) ? (
                <a
                  href={recipe.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="recipe-source-link hover:underline"
                  onClick={(event) => event.stopPropagation()}
                >
                  {sourceName}
                </a>
              ) : (
                <span className="recipe-source-link">{sourceName}</span>
              )}
            </p>
          )}
          {!minimal && (
            <p className={`mt-1.5 text-muted-foreground ${oneCol ? "text-base" : "text-[13px]"}`}>
              <span className="font-semibold text-foreground">Fuente:</span>{' '}
              {recipe.sourceUrl && isValidUrl(recipe.sourceUrl) ? (
                <a
                  href={recipe.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="recipe-source-link text-primary hover:underline"
                  onClick={(event) => event.stopPropagation()}
                >
                  {sourceName}
                </a>
              ) : (
                <span className="recipe-source-link">{sourceName}</span>
              )}
            </p>
          )}
        </div>

        {!minimal && (
          <div className={`@container flex items-center flex-wrap text-muted-foreground ${compact ? "gap-x-2 gap-y-1 text-xs" : oneCol ? "gap-x-4 gap-y-1 text-base" : "gap-x-4 gap-y-1 text-sm"}`}>
            {!!recipe.prepTime && recipe.prepTime > 0 && (
              <div className="flex items-center gap-1 whitespace-nowrap" title="Tiempo de preparación">
                <PreparationTimeIcon className={infoIconClass} />
                <span><span className="hidden @sm:inline">Prep. </span>{recipe.prepTime} min</span>
              </div>
            )}
            {!!recipe.cookTime && recipe.cookTime > 0 && (
              <div className="flex items-center gap-1 whitespace-nowrap" title="Tiempo total">
                <Clock className={infoIconClass} />
                <span><span className="hidden @sm:inline">Total </span>{recipe.cookTime} min</span>
              </div>
            )}
            {!!recipe.servings && recipe.servings > 0 && (
              <div className="flex items-center gap-1 whitespace-nowrap" title="Porciones">
                <User className={infoIconClass} />
                <span><span className="hidden @sm:inline">Porciones </span>{recipe.servings}</span>
              </div>
            )}
          </div>
        )}

        {!minimal && (recipe.thermomix || isThermomixRecipe(recipe) || recipe.airFryer || recipe.glutenFree || recipe.sugarFree || recipe.keto || recipe.lowCarb || recipe.proteica || recipe.vegetarian || recipe.sweet || recipe.savory || recipe.cooked || recipe.featured) && (
          <div className={`flex items-center flex-wrap gap-2 text-muted-foreground ${oneCol ? "[&>span]:h-9 [&>span]:w-9 [&_img]:!h-7 [&_img]:!w-7 [&_svg]:!h-6 [&_svg]:!w-6 [&_.keto-ico]:!h-8 [&_.keto-ico]:!w-8 [&_.cooked-ico]:!h-8 [&_.cooked-ico]:!w-8" : ""}`}>
            {(recipe.thermomix || isThermomixRecipe(recipe)) && (
              <span
                title="Thermomix"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-muted/70"
              >
                <img
                  src="/thermomix-logo.png"
                  alt=""
                  aria-hidden="true"
                  className="h-6 w-6 object-contain mix-blend-multiply"
                />
              </span>
            )}
            {recipe.airFryer && (
              <span
                title="Air Fryer"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-muted/70"
              >
                <img
                  src="/air-fryer.png"
                  alt=""
                  aria-hidden="true"
                  className="h-5 w-5 object-contain mix-blend-multiply"
                />
              </span>
            )}
            {recipe.glutenFree && (
              <span
                title="Sin Gluten"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-muted/70"
              >
                <WheatOff className="h-4 w-4" />
              </span>
            )}
            {recipe.sugarFree && (
              <span title="Sin Azucar" className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-muted/70">
                <CandyOff className="h-4 w-4" />
              </span>
            )}
            {recipe.keto && (
              <span
                title="Keto"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-muted/70"
              >
                <AvocadoIcon className="h-[26px] w-[26px] keto-ico" />
              </span>
            )}
            {recipe.lowCarb && (
              <span
                title="Low Carb"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-muted/70"
              >
                <img
                  src="/logo-saludable.png"
                  alt=""
                  aria-hidden="true"
                  className="h-5 w-5 object-contain grayscale opacity-70"
                />
              </span>
            )}
            {recipe.proteica && (
              <span
                title="Proteica"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-muted/70"
              >
                <Beef className="h-[18px] w-[18px]" />
              </span>
            )}
            {recipe.vegetarian && (
              <span
                title="Vegetariana"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-muted/70"
              >
                <Leaf className="h-[18px] w-[18px]" />
              </span>
            )}
            {recipe.sweet && (
              <span title="Receta dulce" className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-muted/70">
                <CakeSlice className="h-[18px] w-[18px]" />
              </span>
            )}
            {recipe.savory && (
              <span title="Receta salada" className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-muted/70">
                <Utensils className="h-[18px] w-[18px]" />
              </span>
            )}
            {/* Cocinada y Favorita (1 a 4 columnas) */}
            {recipe.cooked && (
              <span title="Cocinada" className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-muted/70">
                <RecipePreparedIcon className="cooked-ico" style={{ width: 22, height: 22 }} />
              </span>
            )}
            {recipe.featured && (
              <span title="Favorita" className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-muted/70">
                <Heart className="h-[18px] w-[18px] fill-red-500 text-red-500" />
              </span>
            )}
          </div>
        )}

        {!minimal && categories.length > 0 && (
        <div className="mt-auto flex items-end gap-2 border-t border-border/60 pt-3">
          {categories.length > 0 && (
            <div className="flex min-w-0 flex-1 flex-wrap content-end gap-x-0.5 gap-y-1">
              {categories.map((cat) => (
                <Badge
                  key={cat}
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    event.stopPropagation();
                    onCategoryClick?.(cat);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    event.stopPropagation();
                    onCategoryClick?.(cat);
                  }}
                  className={`shrink-0 cursor-pointer whitespace-nowrap border-transparent bg-primary/75 text-primary-foreground shadow-sm transition-colors hover:bg-primary ${
                    compactCategories ? 'px-1.5 py-0' : ''
                  }`}
                  style={{ fontSize: `${categoryFontSize}px` }}
                  title={`Filtrar por ${cat}`}
                >
                  {cat}
                </Badge>
              ))}
            </div>
          )}
        </div>
        )}
      </CardContent>

      {/* Panel derecho (solo en vista de 1 columna): Colección, Categoría, Tipo de comida */}
      {oneCol && (
        <div className="shrink-0 space-y-3 border-t p-4 text-sm sm:w-60 sm:border-l sm:border-t-0" onClick={inlineEditing ? (e) => e.stopPropagation() : undefined}>
          {(onInlineSave || onEdit) && !inlineEditing && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); if (onInlineSave) { startInlineEdit(); } else { onEdit?.(recipe); } }}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Editar estos campos"
                aria-label="Editar campos"
              >
                <Edit className="h-4 w-4" />
              </button>
            </div>
          )}

          {inlineEditing ? (
            <>
              <div>
                <p className="mb-1 font-semibold text-foreground">Coleccion</p>
                <MultiSelectCombobox
                  options={allCollections.map(c => c.name)}
                  selected={editCollections}
                  onChange={setEditCollections}
                  placeholder="Elegi una o mas"
                  searchPlaceholder="Buscar coleccion..."
                  closeOnSelect
                />
              </div>
              <div>
                <p className="mb-1 font-semibold text-foreground">Categoria</p>
                <MultiSelectCombobox
                  options={categoryOptions}
                  selected={editCategories}
                  onChange={setEditCategories}
                  placeholder="Elegi una o mas"
                  searchPlaceholder="Buscar o escribir..."
                  closeOnSelect allowCreate createLabel="Agregar"
                />
              </div>
              <div>
                <p className="mb-1 font-semibold text-foreground">Tipo de comida</p>
                <MultiSelectCombobox
                  options={dishTypeOptions}
                  selected={editDishType}
                  onChange={setEditDishType}
                  placeholder="Elegi uno o mas"
                  searchPlaceholder="Buscar o escribir..."
                  closeOnSelect allowCreate createLabel="Agregar"
                />
              </div>
              <div>
                <p className="mb-1 font-semibold text-foreground">Fuente</p>
                <MultiSelectCombobox
                  options={sourceOptions}
                  selected={editSource}
                  onChange={setEditSource}
                  placeholder="Elegi una fuente"
                  searchPlaceholder="Buscar o escribir fuente..."
                  singleSelect
                  closeOnSelect
                  allowCreate
                  createLabel="Agregar"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setInlineEditing(false); }} disabled={savingInline}>
                  <X className="mr-1 h-4 w-4" /> Cancelar
                </Button>
                <Button type="button" size="sm" onClick={(e) => { e.stopPropagation(); void saveInlineEdit(); }} disabled={savingInline}>
                  {savingInline ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
                  Guardar
                </Button>
              </div>
            </>
          ) : (
            <>
              {collectionNames.some(n => n && n.trim()) && (
                <div>
                  <p className="font-semibold text-foreground">Coleccion</p>
                  <p className="text-muted-foreground">{collectionNames.filter(n => n && n.trim()).join(', ')}</p>
                </div>
              )}
              {categories.length > 0 && (
                <div>
                  <p className="font-semibold text-foreground">Categoria</p>
                  <p className="text-muted-foreground">{categories.join(', ')}</p>
                </div>
              )}
              {recipe.dishType?.trim() && (
                <div>
                  <p className="font-semibold text-foreground">Tipo de comida</p>
                  <p className="text-muted-foreground">{recipe.dishType.trim()}</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  );
};
