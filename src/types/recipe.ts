export interface RecipeImage {
  id?: string;
  url: string;
  localPath?: string;
  order: number;
  altText?: string;
}

export interface Ingredient {
  id?: string;
  name: string;
  amount: string;
  unit?: string;
  order: number;
  section?: string; // Section for multi-part recipes (e.g., "Plato principal", "Salsa")
}

export interface Instruction {
  id?: string;
  step: number;
  description: string;
  section?: string; // Section for multi-part recipes
  thermomixSettings?: {
    function?: string; // Thermomix function (e.g., "Amasar", "Batir", "Picar")
    time?: string;
    temperature?: string;
    speed?: string;
  };
}

export interface Recipe {
  id: string;
  userId: string;
  title: string;
  description?: string;
  suggestions?: string;
  images: RecipeImage[];
  prepTime?: number | null;
  cookTime?: number | null;
  servings?: number | null;
  difficulty?: "Fácil" | "Medio" | "Difícil" | null;
  tags: string[];
  ingredients: Ingredient[];
  instructions: Instruction[];
  sourceUrl?: string;
  source?: string;
  author?: string;
  importedFrom?: 'www' | 'instagram' | 'youtube' | 'doc';
  recipeType?: string;
  dishType?: string;
  country?: string;
  language?: string;
  featured?: boolean;
  cooked?: boolean;
  thermomix?: boolean;
  airFryer?: boolean;
  glutenFree?: boolean;
  sugarFree?: boolean;
  keto?: boolean;
  lowCarb?: boolean;
  vegetarian?: boolean;
  proteica?: boolean;
  sweet?: boolean;
  savory?: boolean;
  locution?: string;
  // Informacion nutricional por porcion
  calories?: number | null;
  protein?: number | null;
  carbohydrates?: number | null;
  fat?: number | null;
  saturatedFat?: number | null;
  fiber?: number | null;
  sugar?: number | null;
  sodium?: number | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ImportRecipeResponse {
  success: boolean;
  recipe?: {
    title: string;
    description?: string;
    suggestions?: string;
    prepTime: number;
    cookTime?: number;
    servings: number;
    difficulty: "Fácil" | "Medio" | "Difícil";
    recipeType?: string;
    dishType?: string;
    country?: string;
    language?: string;
    sourceUrl?: string;
    source?: string;
    author?: string;
    importedFrom?: 'www' | 'instagram' | 'youtube' | 'doc';
    thermomix?: boolean;
    airFryer?: boolean;
    glutenFree?: boolean;
    sugarFree?: boolean;
    keto?: boolean;
    lowCarb?: boolean;
    vegetarian?: boolean;
    proteica?: boolean;
    sweet?: boolean;
    savory?: boolean;
    images: RecipeImage[];
    ingredients: Ingredient[];
    instructions: Instruction[];
    tags: string[];
    calories?: number | null;
    protein?: number | null;
    carbohydrates?: number | null;
    fat?: number | null;
    saturatedFat?: number | null;
    fiber?: number | null;
    sugar?: number | null;
    sodium?: number | null;
  };
  preview?: boolean;
  error?: string;
  warning?: string;
}
