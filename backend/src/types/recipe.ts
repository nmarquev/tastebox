export interface RecipeImage {
  id: string;
  url: string;
  localPath?: string;
  order: number;
  altText?: string;
}

export interface Ingredient {
  id: string;
  name: string;
  amount: string;
  unit?: string;
  order: number;
  section?: string;
}

export interface Instruction {
  id: string;
  step: number;
  description: string;
  function?: string;
  time?: string;
  temperature?: string;
  speed?: string;
  section?: string;
  thermomixSettings?: {
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
  prepTime: number;
  cookTime?: number;
  servings: number;
  difficulty: "Fácil" | "Medio" | "Difícil";
  tags: string[];
  ingredients: Ingredient[];
  instructions: Instruction[];
  sourceUrl?: string;
  source?: string;
  author?: string;
  importedFrom?: string;
  recipeType?: string;
  dishType?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecipeImportResponse {
  title: string;
  description?: string;
  suggestions?: string;
  images: Array<{
    url: string;
    altText?: string;
    order: number;
  }>;
  ingredients: Array<{
    name: string;
    amount: string;
    unit?: string;
    section?: string;
  }>;
  instructions: Array<{
    step: number;
    description: string;
    function?: string;
    time?: string;
    temperature?: string;
    speed?: string;
    section?: string;
  }>;
  prepTime: number;
  cookTime?: number;
  servings: number;
  difficulty?: "Fácil" | "Medio" | "Difícil"; // vacío si la receta no lo indica
  recipeType?: string;
  dishType?: string;
  sourceUrl?: string; // URL de origen (p.ej. Instagram reconstruida con el usuario)
  source?: string; // Fuente: de quién es la receta (texto libre)
  author?: string;
  importedFrom?: string;
  country?: string; // País de la receta (ej. extraído de Cookidoo)
  language?: string; // Idioma de la receta (Español/Inglés)
  tags: string[];
  featured?: boolean; // true si es receta favorita / destacada
  cooked?: boolean; // true si la receta ya fue cocinada
  thermomix?: boolean; // true si es receta Thermomix (Cookidoo o con configuraciones TMX)
  airFryer?: boolean; // true si se prepara en freidora de aire
  glutenFree?: boolean; // true si es receta sin gluten
  keto?: boolean; // true si es receta keto / cetogénica
  lowCarb?: boolean; // true si es receta baja en carbohidratos
  vegetarian?: boolean; // true si es receta vegetariana
  proteica?: boolean; // true si es receta proteica
  // Información nutricional por porción (ej. extraída exacta de Cookidoo).
  nutrition?: {
    calories?: number;
    protein?: number;
    carbohydrates?: number;
    fat?: number;
    saturatedFat?: number;
    fiber?: number;
    sugar?: number;
    sodium?: number;
  };
}

export interface User {
  id: string;
  email: string;
  name: string;
}
