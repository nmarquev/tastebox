import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Clock, User, ChefHat, Edit, Trash2, MoreVertical, Heart, Bookmark, Send, Printer, Download, ExternalLink, ArrowUpRightFromSquare, Calculator, Timer, WheatOff, Leaf } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Recipe } from "@/types/recipe";
import { AvocadoIcon } from "@/components/icons/AvocadoIcon";
import { RecipePreparedIcon } from "@/components/icons/RecipePreparedIcon";
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
  isPlayingTTS?: boolean;
  isGeneratingScript?: boolean;
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelectionChange?: (recipe: Recipe, modifiers?: { shift?: boolean; ctrl?: boolean }) => void;
}

export const RecipeCard = ({ recipe, onView, onEdit, onDelete, onToggleFavorite, onToggleCooked, onPlayTTS, onShowNutrition, onSaveToCollection, onCategoryClick, isInCollection = false, columns = 3, collectionNames = [], isPlayingTTS = false, isGeneratingScript = false, selectionMode = false, isSelected = false, onSelectionChange }: RecipeCardProps) => {
  const [isPdfLoading, setIsPdfLoading] = useState(false);
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
        {!minimal && (
        <div className="absolute top-3 right-3 flex items-center justify-end gap-1.5">
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
              className={`h-8 w-8 p-0 ${recipe.featured ? 'bg-red-100/50 hover:bg-red-200/50' : 'bg-white/50 hover:bg-white/70'}`}
            >
              <Heart
                className={recipe.featured ? 'fill-red-500 text-red-500' : 'text-gray-600'}
                style={{ width: 20, height: 20 }}
              />
            </Button>
          )}
          {onToggleCooked && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className={`h-8 w-8 p-0 ${recipe.cooked ? 'bg-green-100/60 hover:bg-green-200/60' : 'bg-white/50 hover:bg-white/70'}`}
              title={recipe.cooked ? "Marcar como no cocinada" : "Marcar como cocinada"}
              onClick={(event) => {
                event.stopPropagation();
                onToggleCooked(recipe);
              }}
            >
              <RecipePreparedIcon
                className={recipe.cooked ? "" : "text-gray-600"}
                style={{ width: 28, height: 28, color: recipe.cooked ? '#8ebf4c' : undefined }}
              />
            </Button>
          )}
          {onSaveToCollection && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 w-8 bg-white/50 p-0 hover:bg-white/70"
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
              className="h-8 w-8 p-0 bg-white/50 hover:bg-white/70"
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
                className="h-8 w-8 p-0 bg-white/50 hover:bg-white/70"
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
                <ChefHat className={infoIconClass} />
                <span><span className="hidden @sm:inline">Prep. </span>{recipe.prepTime} min</span>
              </div>
            )}
            {!!recipe.cookTime && recipe.cookTime > 0 && (
              <div className="flex items-center gap-1 whitespace-nowrap" title="Tiempo total">
                <Clock className={infoIconClass} />
                <span><span className="hidden @sm:inline">Total </span>{(recipe.prepTime || 0) + recipe.cookTime} min</span>
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

        {!minimal && (recipe.thermomix || isThermomixRecipe(recipe) || recipe.airFryer || recipe.glutenFree || recipe.keto || recipe.lowCarb || recipe.vegetarian) && (
          <div className={`flex items-center flex-wrap gap-2 text-muted-foreground ${oneCol ? "[&>span]:h-9 [&>span]:w-9 [&_img]:!h-7 [&_img]:!w-7 [&_svg]:!h-6 [&_svg]:!w-6" : ""}`}>
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
            {recipe.keto && (
              <span
                title="Keto"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-muted/70"
              >
                <AvocadoIcon className="h-[22px] w-[22px]" />
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
            {recipe.vegetarian && (
              <span
                title="Vegetariana"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-muted/70"
              >
                <Leaf className="h-[18px] w-[18px]" />
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

      {/* Panel derecho (solo en vista de 1 columna): Tipo de receta, Categoría, Colección */}
      {oneCol && (
        <div className="shrink-0 space-y-3 border-t p-4 text-sm sm:w-60 sm:border-l sm:border-t-0">
          <div>
            <p className="font-semibold text-foreground">Tipo de receta</p>
            <p className="text-muted-foreground">{recipe.dishType?.trim() || '—'}</p>
          </div>
          <div>
            <p className="font-semibold text-foreground">Categoría</p>
            <p className="text-muted-foreground">{categories.length > 0 ? categories.join(', ') : '—'}</p>
          </div>
          <div>
            <p className="font-semibold text-foreground">Colección</p>
            <p className="text-muted-foreground">{collectionNames.length > 0 ? collectionNames.join(', ') : '—'}</p>
          </div>
        </div>
      )}
    </Card>
  );
};
