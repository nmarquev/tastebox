import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Filter, ChevronDown, X, Heart, ChefHat } from "lucide-react";
import { Recipe } from "@/components/RecipeCard";
import { getSourceFromUrl } from "@/utils/siteUtils";

export interface RecipeFilters {
  difficulty: string[];
  prepTimeRange: [number, number];
  recipeTypes: string[];
  tags: string[];
  featured?: boolean;
  cookedOnly?: boolean;
  thermomixOnly?: boolean;
  airFryerOnly?: boolean;
  glutenFreeOnly?: boolean;
  ketoOnly?: boolean;
  lowCarbOnly?: boolean;
  vegetarianOnly?: boolean;
  ingredients?: string[];
  collectionId?: string;
  sources?: string[];
  dishType?: string; // selección única (panel izquierdo / galería)
  dishTypes?: string[]; // selección múltiple (bloque de filtros)
  author?: string;
}

interface FilterPanelProps {
  recipes: Recipe[];
  filters: RecipeFilters;
  onFiltersChange: (filters: RecipeFilters) => void;
  onClearFilters: () => void;
}

export const FilterPanel = ({ recipes, filters, onFiltersChange, onClearFilters }: FilterPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);

  // Extract unique values from recipes
  const difficulties = ["Fácil", "Medio", "Difícil"];
  const allTags = Array.from(new Set(
    recipes.flatMap(recipe =>
      recipe.tags.map(tag => typeof tag === 'string' ? tag : tag.tag || tag.name || '')
    ).filter(tag => tag.length > 0)
  )).sort();
  const allRecipeTypes = Array.from(new Set(
    recipes.map(recipe => recipe.recipeType).filter(type => type && type.length > 0)
  )).sort();
  const maxPrepTime = Math.max(...recipes.map(r => r.prepTime), 180);
  const maxCookTime = Math.max(...recipes.map(r => r.cookTime || 0), 120);
  const allSources = Array.from(new Set(
    recipes
      .map(recipe => recipe.sourceUrl ? getSourceFromUrl(recipe.sourceUrl) : '')
      .filter(source => source.length > 0)
  )).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

  const handleDifficultyChange = (difficulty: string, checked: boolean) => {
    const newDifficulties = checked 
      ? [...filters.difficulty, difficulty]
      : filters.difficulty.filter(d => d !== difficulty);
    
    onFiltersChange({
      ...filters,
      difficulty: newDifficulties
    });
  };

  const handleTagChange = (tag: string, checked: boolean) => {
    const newTags = checked 
      ? [...filters.tags, tag]
      : filters.tags.filter(t => t !== tag);
    
    onFiltersChange({
      ...filters,
      tags: newTags
    });
  };

  const handlePrepTimeChange = (value: number[]) => {
    onFiltersChange({
      ...filters,
      prepTimeRange: [value[0], value[1]]
    });
  };

  const handleCookTimeChange = (value: number[]) => {
    onFiltersChange({
      ...filters,
      cookTimeRange: [value[0], value[1]]
    });
  };

  const handleSourceChange = (source: string, checked: boolean) => {
    const current = filters.sources || [];
    const newSources = checked
      ? [...current, source]
      : current.filter(s => s !== source);

    onFiltersChange({
      ...filters,
      sources: newSources.length > 0 ? newSources : undefined
    });
  };

  const handleRecipeTypeChange = (recipeType: string, checked: boolean) => {
    const newTypes = checked
      ? [...filters.recipeTypes, recipeType]
      : filters.recipeTypes.filter(t => t !== recipeType);

    onFiltersChange({
      ...filters,
      recipeTypes: newTypes
    });
  };

  const handleFeaturedChange = (checked: boolean) => {
    onFiltersChange({
      ...filters,
      featured: checked || undefined
    });
  };

  const handleThermomixChange = (checked: boolean) => {
    onFiltersChange({
      ...filters,
      thermomixOnly: checked || undefined
    });
  };

  const hasActiveFilters =
    filters.difficulty.length > 0 ||
    filters.tags.length > 0 ||
    filters.recipeTypes.length > 0 ||
    (filters.prepTimeRange?.[0] ?? 0) > 0 ||
    (filters.prepTimeRange?.[1] ?? 180) < maxPrepTime ||
    (filters.cookTimeRange?.[0] ?? 0) > 0 ||
    (filters.cookTimeRange?.[1] ?? 120) < maxCookTime ||
    filters.featured === true ||
    filters.thermomixOnly === true ||
    (filters.sources?.length ?? 0) > 0;

  return (
    <Card className="w-full">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">Filtros</CardTitle>
                {hasActiveFilters && (
                  <Badge variant="secondary" className="text-xs">
                    Activos
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClearFilters();
                    }}
                    className="h-6 px-2 text-xs"
                  >
                    <X className="h-3 w-3" />
                    Limpiar
                  </Button>
                )}
                <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-4 p-4">
            {/* Featured Filter */}
            <div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="featured"
                  checked={filters.featured === true}
                  onCheckedChange={handleFeaturedChange}
                  className="h-3 w-3"
                />
                <Label htmlFor="featured" className="text-xs cursor-pointer flex items-center gap-1">
                  <Heart className="h-3 w-3 text-red-500" />
                  Solo recetas destacadas
                </Label>
              </div>
            </div>

            {/* Thermomix Filter */}
            <div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="thermomix"
                  checked={filters.thermomixOnly === true}
                  onCheckedChange={handleThermomixChange}
                  className="h-3 w-3"
                />
                <Label htmlFor="thermomix" className="text-xs cursor-pointer flex items-center gap-1">
                  <ChefHat className="h-3 w-3 text-orange-500" />
                  Solo recetas Thermomix
                </Label>
              </div>
            </div>

            {/* Difficulty Filter */}
            <div>
              <Label className="text-xs font-medium mb-2 block">Dificultad</Label>
              <div className="flex flex-wrap gap-1">
                {difficulties.map((difficulty) => (
                  <div key={difficulty} className="flex items-center space-x-1">
                    <Checkbox
                      id={`difficulty-${difficulty}`}
                      checked={filters.difficulty.includes(difficulty)}
                      onCheckedChange={(checked) => 
                        handleDifficultyChange(difficulty, checked as boolean)
                      }
                      className="h-3 w-3"
                    />
                    <Label 
                      htmlFor={`difficulty-${difficulty}`}
                      className="text-xs cursor-pointer"
                    >
                      {difficulty}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Prep Time Filter */}
            <div>
              <Label className="text-xs font-medium mb-2 block">
                Tiempo Preparación ({filters.prepTimeRange?.[0] ?? 0}-{filters.prepTimeRange?.[1] ?? 180} min)
              </Label>
              <Slider
                value={filters.prepTimeRange}
                onValueChange={handlePrepTimeChange}
                max={maxPrepTime}
                min={0}
                step={5}
                className="w-full"
              />
            </div>

            {/* Cook Time Filter */}
            <div>
              <Label className="text-xs font-medium mb-2 block">
                Tiempo Cocción ({filters.cookTimeRange?.[0] ?? 0}-{filters.cookTimeRange?.[1] ?? 120} min)
              </Label>
              <Slider
                value={filters.cookTimeRange}
                onValueChange={handleCookTimeChange}
                max={maxCookTime}
                min={0}
                step={5}
                className="w-full"
              />
            </div>

            {/* Category Filter */}
            <div>
              <Label className="text-xs font-medium mb-2 block">Categoría</Label>
              <div className="flex flex-wrap gap-1">
                {allRecipeTypes.map((recipeType) => (
                  <div key={recipeType} className="flex items-center space-x-1">
                    <Checkbox
                      id={`recipeType-${recipeType}`}
                      checked={filters.recipeTypes.includes(recipeType)}
                      onCheckedChange={(checked) =>
                        handleRecipeTypeChange(recipeType, checked as boolean)
                      }
                      className="h-3 w-3"
                    />
                    <Label
                      htmlFor={`recipeType-${recipeType}`}
                      className="text-xs cursor-pointer"
                    >
                      {recipeType}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Tags Filter */}
            <div>
              <Label className="text-xs font-medium mb-2 block">Etiquetas</Label>
              <div className="grid grid-cols-1 gap-1 max-h-24 overflow-y-auto">
                {allTags.slice(0, 10).map((tag) => (
                  <div key={tag} className="flex items-center space-x-1">
                    <Checkbox
                      id={`tag-${tag}`}
                      checked={filters.tags.includes(tag)}
                      onCheckedChange={(checked) => 
                        handleTagChange(tag, checked as boolean)
                      }
                      className="h-3 w-3"
                    />
                    <Label
                      htmlFor={`tag-${tag}`}
                      className="text-xs cursor-pointer truncate"
                    >
                      {tag}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Source Filter */}
            {allSources.length > 0 && (
              <div>
                <Label className="text-xs font-medium mb-2 block">Fuente</Label>
                <div className="grid grid-cols-1 gap-1 max-h-24 overflow-y-auto">
                  {allSources.map((source) => (
                    <div key={source} className="flex items-center space-x-1">
                      <Checkbox
                        id={`source-${source}`}
                        checked={(filters.sources || []).includes(source)}
                        onCheckedChange={(checked) =>
                          handleSourceChange(source, checked as boolean)
                        }
                        className="h-3 w-3"
                      />
                      <Label
                        htmlFor={`source-${source}`}
                        className="text-xs cursor-pointer truncate"
                      >
                        {source}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
