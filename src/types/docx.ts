export interface DocxUploadResponse {
  success: boolean;
  fileId: string;
  totalPages: number;
  preview: string;
  images?: string[]; // Base64 data URLs of extracted images
  error?: string;
}

export interface DocxExtractRequest {
  fileId: string;
  startPage: number;
  endPage: number;
}

export interface DocxExtractedRecipe {
  id: string;
  title: string;
  content: string;
  imageIndex?: number; // Índice en uploadData.images de la imagen junto a esta receta; -1 si ninguna
  estimatedData?: {
    title?: string;
    description?: string;
    ingredients?: string[];
    instructions?: string[];
    prepTime?: number;
    cookTime?: number;
    servings?: number;
  };
}

export interface DocxExtractResponse {
  success: boolean;
  recipes: DocxExtractedRecipe[];
  processedPages: number;
  error?: string;
}

export interface DocxPreviewResponse {
  success: boolean;
  preview: string;
  pages: number;
  characters: number;
  error?: string;
}

// UI State types
export interface DocxImportState {
  currentStep: 'upload' | 'select-pages' | 'extract' | 'review';
  uploadData?: DocxUploadResponse;
  selectedPages?: { start: number; end: number };
  extractedRecipes?: DocxExtractedRecipe[];
  currentRecipeIndex: number;
  loading: boolean;
  error?: string;
  savedRecipes: string[]; // IDs of recipes that have been saved
  currentBatchStart?: number; // Página inicial del lote (de a 2 páginas) que se está revisando
  fileName?: string; // Nombre del archivo DOCX que se está importando
}

export interface PageRange {
  start: number;
  end: number;
}