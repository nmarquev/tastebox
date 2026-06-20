import { Recipe, ImportRecipeResponse } from '@/types/recipe';
import { getApiBaseUrl } from '@/utils/api';

const API_BASE_URL = getApiBaseUrl();

// Tamaño máximo permitido para imágenes subidas (recetas, colecciones, etc.): 2MB.
export const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;

export interface AiSettings {
  model: string;
  visionModel: string;
  defaults: { model: string; visionModel: string };
  overridden: { model: boolean; visionModel: boolean };
}

export interface CookidooSettings {
  configured: boolean;
  username: string;
}

export interface FooditSettings {
  configured: boolean;
  username: string;
}

export interface RecipeCollection {
  id: string;
  name: string;
  coverImage?: string | null;
  recipeIds: string[];
  recipeOrders?: Record<string, number>;
  recipeCount: number;
  createdAt: string;
  updatedAt: string;
}

// Helper function to get auth token
const getAuthToken = (): string | null => {
  // For now, we'll use localStorage. In production, consider more secure methods
  return localStorage.getItem('auth_token');
};

// Guard to avoid triggering the session-expired handler multiple times
let sessionExpiredHandled = false;

// Clears the local session and sends the user back to the login screen.
// Triggered when the backend rejects the auth token (401/403 = expired/invalid).
const handleSessionExpired = () => {
  if (sessionExpiredHandled) return;
  sessionExpiredHandled = true;

  localStorage.removeItem('auth_token');
  localStorage.removeItem('thermomix_user');

  // Reload so the AuthProvider re-evaluates and shows the login page.
  // Avoid reloading during a bookmarklet popup flow.
  const isBookmarklet = new URLSearchParams(window.location.search).get('bookmarklet') === 'true';
  if (!isBookmarklet) {
    window.location.reload();
  }
};

// Helper function to make authenticated requests
const authFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const token = getAuthToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers,
  });

  // If the token is missing/expired/invalid, end the session and go to login.
  if (response.status === 401 || response.status === 403) {
    handleSessionExpired();
  }

  return response;
};

export const api = {
  // Auth endpoints
  auth: {
    login: async (email: string, password: string) => {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      const data = await response.json();
      localStorage.setItem('auth_token', data.token);
      return data;
    },

    register: async (email: string, password: string, name: string, alias?: string) => {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, alias }),
      });

      if (!response.ok) {
        throw new Error('Registration failed');
      }

      const data = await response.json();
      localStorage.setItem('auth_token', data.token);
      return data;
    },

    logout: () => {
      localStorage.removeItem('auth_token');
    },

    updateProfile: async (profileData: {
      email?: string;
      name?: string;
      alias?: string;
      currentPassword?: string;
      newPassword?: string;
    }) => {
      const response = await authFetch('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(profileData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update profile');
      }

      return response.json();
    },

    getProfile: async () => {
      const response = await authFetch('/auth/profile');

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get profile');
      }

      const data = await response.json();
      return data.user;
    },
  },

  // Recipe endpoints
  recipes: {
    getAll: async (): Promise<Recipe[]> => {
      const response = await authFetch('/recipes');

      if (!response.ok) {
        throw new Error('Failed to fetch recipes');
      }

      return response.json();
    },

    getById: async (id: string): Promise<Recipe> => {
      const response = await authFetch(`/recipes/${id}`);

      if (!response.ok) {
        throw new Error('Failed to fetch recipe');
      }

      return response.json();
    },

    create: async (recipe: Omit<Recipe, 'id' | 'userId' | 'createdAt' | 'updatedAt'> & { autoTags?: boolean }): Promise<Recipe> => {
      const response = await authFetch('/recipes', {
        method: 'POST',
        body: JSON.stringify(recipe),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const detail = Array.isArray(errorData.details)
          ? errorData.details
              .map((item: { path?: Array<string | number>; message?: string }) =>
                `${item.path?.join('.') || 'dato'}: ${item.message || 'valor inválido'}`
              )
              .join(', ')
          : '';
        throw new Error(detail || errorData.error || 'Failed to create recipe');
      }

      return response.json();
    },

    update: async (id: string, recipe: Partial<Recipe>): Promise<Recipe> => {
      const response = await authFetch(`/recipes/${id}`, {
        method: 'PUT',
        body: JSON.stringify(recipe),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const detail = Array.isArray(errorData.details)
          ? errorData.details
              .map((item: { path?: Array<string | number>; message?: string }) =>
                `${item.path?.join('.') || 'dato'}: ${item.message || 'valor inválido'}`
              )
              .join(', ')
          : '';
        throw new Error(detail || errorData.error || 'Failed to update recipe');
      }

      return response.json();
    },

    // Edición masiva: aplica solo los campos provistos a varias recetas.
    bulkUpdate: async (recipeIds: string[], fields: Record<string, unknown>): Promise<{ updated: number }> => {
      const response = await authFetch('/recipes/bulk', {
        method: 'PATCH',
        body: JSON.stringify({ recipeIds, fields }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'No se pudieron actualizar las recetas');
      }
      return response.json();
    },

    delete: async (id: string): Promise<void> => {
      const response = await authFetch(`/recipes/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete recipe');
      }
    },
  },

  categories: {
    getAll: async (): Promise<Array<{ name: string; coverImage: string | null }>> => {
      const response = await authFetch('/categories');
      if (!response.ok) {
        throw new Error('No se pudieron cargar las categorías');
      }
      return response.json();
    },

    create: async (name: string): Promise<{ id: string; name: string }> => {
      const response = await authFetch('/categories', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'No se pudo crear la categoría');
      }
      return response.json();
    },

    updateCover: async (name: string, coverImage: string | null): Promise<void> => {
      const response = await authFetch(`/categories/${encodeURIComponent(name)}`, {
        method: 'PATCH',
        body: JSON.stringify({ coverImage }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'No se pudo actualizar la categoría');
      }
    },

    remove: async (name: string): Promise<void> => {
      const response = await authFetch(`/categories/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'No se pudo eliminar la categoría');
      }
    },
  },

  dishTypes: {
    getAll: async (): Promise<Array<{ name: string; coverImage: string | null }>> => {
      const response = await authFetch('/dish-types');
      if (!response.ok) {
        throw new Error('No se pudieron cargar los tipos de receta');
      }
      return response.json();
    },

    create: async (name: string): Promise<{ id: string; name: string }> => {
      const response = await authFetch('/dish-types', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'No se pudo crear el tipo de receta');
      }
      return response.json();
    },

    updateCover: async (name: string, coverImage: string | null): Promise<void> => {
      const response = await authFetch(`/dish-types/${encodeURIComponent(name)}`, {
        method: 'PATCH',
        body: JSON.stringify({ coverImage }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'No se pudo actualizar el tipo de receta');
      }
    },

    remove: async (name: string): Promise<void> => {
      const response = await authFetch(`/dish-types/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'No se pudo eliminar el tipo de receta');
      }
    },
  },

  sources: {
    getAll: async (): Promise<Array<{ name: string; coverImage: string | null }>> => {
      const response = await authFetch('/sources');
      if (!response.ok) {
        throw new Error('No se pudieron cargar las fuentes');
      }
      return response.json();
    },

    create: async (name: string): Promise<{ id: string; name: string }> => {
      const response = await authFetch('/sources', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'No se pudo crear la fuente');
      }
      return response.json();
    },

    updateCover: async (name: string, coverImage: string | null): Promise<void> => {
      const response = await authFetch(`/sources/${encodeURIComponent(name)}`, {
        method: 'PATCH',
        body: JSON.stringify({ coverImage }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'No se pudo actualizar la fuente');
      }
    },

    remove: async (name: string): Promise<void> => {
      const response = await authFetch(`/sources/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'No se pudo eliminar la fuente');
      }
    },
  },

  tags: {
    getAll: async (): Promise<Array<{ name: string; coverImage: string | null }>> => {
      const response = await authFetch('/tags');
      if (!response.ok) {
        throw new Error('No se pudieron cargar las etiquetas');
      }
      return response.json();
    },

    create: async (name: string): Promise<{ id: string; name: string }> => {
      const response = await authFetch('/tags', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'No se pudo crear la etiqueta');
      }
      return response.json();
    },

    updateCover: async (name: string, coverImage: string | null): Promise<void> => {
      const response = await authFetch(`/tags/${encodeURIComponent(name)}`, {
        method: 'PATCH',
        body: JSON.stringify({ coverImage }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'No se pudo actualizar la etiqueta');
      }
    },

    remove: async (name: string): Promise<void> => {
      const response = await authFetch(`/tags/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'No se pudo eliminar la etiqueta');
      }
    },
  },

  authors: {
    getAll: async (): Promise<Array<{ name: string; coverImage: string | null }>> => {
      const response = await authFetch('/authors');
      if (!response.ok) {
        throw new Error('No se pudieron cargar los autores');
      }
      return response.json();
    },

    create: async (name: string): Promise<{ id: string; name: string }> => {
      const response = await authFetch('/authors', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'No se pudo crear el autor');
      }
      return response.json();
    },

    updateCover: async (name: string, coverImage: string | null): Promise<void> => {
      const response = await authFetch(`/authors/${encodeURIComponent(name)}`, {
        method: 'PATCH',
        body: JSON.stringify({ coverImage }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'No se pudo actualizar el autor');
      }
    },

    remove: async (name: string): Promise<void> => {
      const response = await authFetch(`/authors/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'No se pudo eliminar el autor');
      }
    },
  },

  collections: {
    getAll: async (): Promise<RecipeCollection[]> => {
      const response = await authFetch('/collections');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'No se pudieron cargar las colecciones');
      }
      return response.json();
    },

    create: async (name: string): Promise<RecipeCollection> => {
      const response = await authFetch('/collections', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'No se pudo crear la colección');
      }
      return response.json();
    },

    update: async (id: string, data: { name?: string; coverImage?: string | null }): Promise<RecipeCollection> => {
      const response = await authFetch(`/collections/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'No se pudo actualizar la colección');
      }
      return response.json();
    },

    remove: async (id: string): Promise<void> => {
      const response = await authFetch(`/collections/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'No se pudo eliminar la colección');
      }
    },

    addRecipe: async (collectionId: string, recipeId: string): Promise<void> => {
      const response = await authFetch(`/collections/${collectionId}/recipes`, {
        method: 'POST',
        body: JSON.stringify({ recipeId }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'No se pudo guardar la receta');
      }
    },

    removeRecipe: async (collectionId: string, recipeId: string): Promise<void> => {
      const response = await authFetch(`/collections/${collectionId}/recipes/${recipeId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'No se pudo quitar la receta');
      }
    },

    reorderRecipe: async (recipeId: string, collectionIds: string[]): Promise<void> => {
      const response = await authFetch(`/collections/recipes/${recipeId}/order`, {
        method: 'PUT',
        body: JSON.stringify({ collectionIds }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'No se pudo guardar el orden de las colecciones');
      }
    },
  },

  // Import endpoints
  import: {
    fromUrl: async (url: string, signal?: AbortSignal): Promise<ImportRecipeResponse> => {
      const response = await authFetch('/import', {
        method: 'POST',
        body: JSON.stringify({ url }),
        signal,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to import recipe');
      }

      return data;
    },

    validateUrl: async (url: string): Promise<{ valid: boolean; error?: string }> => {
      const response = await authFetch('/import/validate-url', {
        method: 'POST',
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        throw new Error('Failed to validate URL');
      }

      return response.json();
    },
  },

  // Upload endpoints
  upload: {
    images: async (files: File[]): Promise<{ success: boolean; images: any[] }> => {
      // Validar tamaño antes de subir: máximo 2MB por imagen.
      const oversized = files.find(file => file.size > MAX_IMAGE_SIZE_BYTES);
      if (oversized) {
        throw new Error('La imagen debe tener un tamaño menor a 2MB');
      }

      const formData = new FormData();
      files.forEach((file, index) => {
        formData.append('images', file);
      });

      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/upload/images`, {
        method: 'POST',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || 'No se pudieron subir las imágenes');
      }

      return response.json();
    },

    // Descarga y guarda una imagen a partir de su URL (arrastrada desde la web).
    fromUrl: async (url: string): Promise<{ success: boolean; image: { url: string; localPath: string; order: number; altText?: string } }> => {
      const response = await authFetch('/upload/images/from-url', {
        method: 'POST',
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'No se pudo agregar la imagen');
      }

      return response.json();
    },

    // Busca una imagen en la web por el nombre de la receta y la guarda.
    searchByRecipe: async (query: string): Promise<{ success: boolean; image: { url: string; localPath: string; order: number; altText?: string } }> => {
      const response = await authFetch('/upload/images/search', {
        method: 'POST',
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'No se pudo buscar la imagen');
      }

      return response.json();
    },
  },

  // DOCX Import endpoints
  docx: {
    upload: async (file: File): Promise<any> => {
      const formData = new FormData();
      formData.append('docx', file);

      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/import/docx/upload`, {
        method: 'POST',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload DOCX file');
      }

      return response.json();
    },

    extract: async (fileId: string, startPage: number, endPage: number, signal?: AbortSignal): Promise<any> => {
      const timeoutSignal = AbortSignal.timeout(90000);
      const response = await authFetch('/import/docx/extract', {
        method: 'POST',
        body: JSON.stringify({ fileId, startPage, endPage }),
        signal: signal ? AbortSignal.any([timeoutSignal, signal]) : timeoutSignal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to extract recipes from DOCX');
      }

      return response.json();
    },

    preview: async (fileId: string, startPage: number, endPage: number): Promise<any> => {
      const response = await authFetch('/import/docx/preview', {
        method: 'POST',
        body: JSON.stringify({ fileId, startPage, endPage }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to preview DOCX content');
      }

      return response.json();
    },

    cleanup: async (): Promise<any> => {
      const response = await authFetch('/import/docx/cleanup', {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cleanup DOCX files');
      }

      return response.json();
    },
  },

  // LLM endpoints
  llm: {
    generateScript: async (prompt: string): Promise<{ success: boolean; script?: string; error?: string }> => {
      const response = await authFetch('/llm/generate-script', {
        method: 'POST',
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate script');
      }

      return response.json();
    },

    translateRecipe: async (data: { title: string; description: string; suggestions: string; ingredients: string[]; instructions: string[] }): Promise<{ success: boolean; title: string; description: string; suggestions: string; ingredients: string[]; instructions: string[] }> => {
      const response = await authFetch('/llm/translate-recipe', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'No se pudo traducir la receta');
      }
      return response.json();
    },

    searchRecipes: async (query: string, count: number = 3, offset: number = 0): Promise<{ success: boolean; recipes: any[]; hasMore: boolean; error?: string }> => {
      const response = await authFetch('/llm/search-recipes', {
        method: 'POST',
        body: JSON.stringify({ query, count, offset }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to search recipes');
      }

      return response.json();
    },
  },

  // Nutrition endpoints
  nutrition: {
    calculate: async (ingredients: Array<{name: string; amount: string; unit?: string}>, servings: number = 4): Promise<{
      success: boolean;
      nutrition?: {
        calories: number;
        protein: number;
        carbohydrates: number;
        fat: number;
        fiber: number;
        sugar: number;
        sodium: number;
      };
      error?: string;
    }> => {
      const response = await authFetch('/nutrition/calculate', {
        method: 'POST',
        body: JSON.stringify({ ingredients, servings }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to calculate nutrition');
      }

      return response.json();
    },
  },

  settings: {
    getAi: async (): Promise<AiSettings> => {
      const response = await authFetch('/settings/ai', { method: 'GET' });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to load AI settings');
      }
      return response.json();
    },
    updateAi: async (data: { model?: string; visionModel?: string }): Promise<AiSettings> => {
      const response = await authFetch('/settings/ai', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update AI settings');
      }
      return response.json();
    },
    getCookidoo: async (): Promise<CookidooSettings> => {
      const response = await authFetch('/settings/cookidoo', { method: 'GET' });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to load Cookidoo settings');
      }
      return response.json();
    },
    updateCookidoo: async (data: { username?: string; password?: string }): Promise<CookidooSettings> => {
      const response = await authFetch('/settings/cookidoo', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update Cookidoo settings');
      }
      return response.json();
    },
    testCookidoo: async (): Promise<{ ok: boolean; message?: string; error?: string }> => {
      const response = await authFetch('/settings/cookidoo/test', { method: 'POST' });
      return response.json();
    },
    getFoodit: async (): Promise<FooditSettings> => {
      const response = await authFetch('/settings/foodit', { method: 'GET' });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to load Foodit settings');
      }
      return response.json();
    },
    updateFoodit: async (data: { username?: string; password?: string }): Promise<FooditSettings> => {
      const response = await authFetch('/settings/foodit', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update Foodit settings');
      }
      return response.json();
    },
    testFoodit: async (): Promise<{ ok: boolean; message?: string; error?: string }> => {
      const response = await authFetch('/settings/foodit/test', { method: 'POST' });
      return response.json();
    },
  },

  // Generic API methods
  post: async (endpoint: string, data: any) => {
    return authFetch(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  put: async (endpoint: string, data: any) => {
    return authFetch(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  get: async (endpoint: string) => {
    return authFetch(endpoint, {
      method: 'GET',
    });
  },

  delete: async (endpoint: string) => {
    return authFetch(endpoint, {
      method: 'DELETE',
    });
  },
};
