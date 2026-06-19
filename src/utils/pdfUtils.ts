import { Recipe } from '@/types/recipe';
import { getApiBaseUrl } from './api';

// Simple in-memory cache for PDF blobs
const pdfCache = new Map<string, { blob: Blob; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get PDF blob for recipe, using cache if available
 */
const getRecipePdfBlob = async (recipe: Recipe): Promise<Blob> => {
  const cacheKey = `recipe-${recipe.id}`;
  const cached = pdfCache.get(cacheKey);

  // Check if we have a valid cached version
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log('📄 Using cached PDF for recipe:', recipe.title);
    return cached.blob;
  }

  // Generate new PDF
  console.log('🔄 Generating new PDF for recipe:', recipe.title);
  const token = localStorage.getItem('auth_token');
  if (!token) {
    throw new Error('No hay token de autenticación');
  }

  const response = await fetch(`${getApiBaseUrl()}/pdf/recipe/${recipe.id}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Error ${response.status}: ${response.statusText}`);
  }

  const blob = await response.blob();

  // Cache the blob
  pdfCache.set(cacheKey, { blob, timestamp: Date.now() });

  // Cleanup old cache entries
  for (const [key, value] of pdfCache.entries()) {
    if (Date.now() - value.timestamp > CACHE_DURATION) {
      pdfCache.delete(key);
    }
  }

  return blob;
};

/**
 * Download recipe as PDF
 */
export const downloadRecipePdf = async (recipe: Recipe): Promise<void> => {
  try {
    // Get PDF blob (cached or new)
    const blob = await getRecipePdfBlob(recipe);

    // Create download link
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${recipe.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

    // Trigger download
    document.body.appendChild(link);
    link.click();

    // Cleanup
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

  } catch (error) {
    console.error('Error downloading PDF:', error);
    throw new Error('Error al descargar el PDF');
  }
};

/**
 * Print recipe PDF
 */
export const printRecipePdf = async (recipe: Recipe): Promise<void> => {
  try {
    // Get PDF blob (cached or new)
    const blob = await getRecipePdfBlob(recipe);

    // Create object URL for the PDF
    const url = window.URL.createObjectURL(blob);

    // Open print dialog
    const printWindow = window.open(url, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    } else {
      throw new Error('No se pudo abrir la ventana de impresión');
    }

    // Cleanup after a delay
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 1000);

  } catch (error) {
    console.error('Error printing PDF:', error);
    throw new Error('Error al imprimir el PDF');
  }
};

export const printRecipesPdf = async (recipes: Recipe[], options: { title?: string; header?: string; footer?: string; pageNumber?: boolean } = {}): Promise<void> => {
  if (!recipes.length) {
    throw new Error('Seleccioná al menos una receta');
  }

  const token = localStorage.getItem('auth_token');
  if (!token) {
    throw new Error('No hay token de autenticación');
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('No se pudo abrir la ventana de impresión');
  }
  printWindow.document.write('<p style="font-family: sans-serif">Preparando recetas para imprimir...</p>');

  try {
    const response = await fetch(`${getApiBaseUrl()}/pdf/recipes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ recipeIds: recipes.map(recipe => recipe.id), title: options.title, header: options.header, footer: options.footer, pageNumber: options.pageNumber }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'No se pudo generar el PDF combinado');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    printWindow.location.href = url;
    printWindow.onload = () => printWindow.print();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    printWindow.close();
    throw error;
  }
};

/**
 * Share recipe PDF
 */
export const shareRecipePdf = async (recipe: Recipe): Promise<void> => {
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('No hay token de autenticación');
    }

    const response = await fetch(`${getApiBaseUrl()}/pdf/recipe/${recipe.id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    // Get the PDF blob
    const blob = await response.blob();

    // Create a File object for sharing
    const file = new File([blob], `${recipe.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`, {
      type: 'application/pdf',
    });

    // Check if Web Share API is supported
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: `Receta: ${recipe.title}`,
        text: `Receta de ${recipe.title} - TasteBox`,
        files: [file],
      });
    } else {
      // Fallback: download the file
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${recipe.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Show info message
      alert('Tu navegador no soporta compartir archivos. El archivo se ha descargado.');
    }

  } catch (error) {
    console.error('Error sharing PDF:', error);
    throw new Error('Error al compartir el PDF');
  }
};
