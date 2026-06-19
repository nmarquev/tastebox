export interface DocxUploadRequest {
  file: Buffer;
  originalName: string;
}

export interface DocxUploadResponse {
  success: boolean;
  fileId: string;
  totalPages: number;
  preview: string; // First few lines of text
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
  content: string; // Raw text content for this recipe
  imageIndex?: number; // Índice (en images[]) de la imagen que aparece junto a esta receta; -1 si ninguna
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

export interface DocxProcessedContent {
  fullText: string;
  pages: string[];
  totalPages: number;
  images?: string[]; // Base64 data URLs of extracted images
  html?: string; // HTML version with embedded images
  htmlText?: string; // Texto plano derivado del HTML (para ubicar títulos de recetas)
  imagePositions?: number[]; // Offset (en htmlText) donde aparece cada imagen, en orden
}

export interface RecipeDetectionResult {
  recipes: {
    id: string;
    title: string;
    startIndex: number;
    endIndex: number;
    content: string;
    estimatedData?: DocxExtractedRecipe['estimatedData'];
  }[];
  totalDetected: number;
}
