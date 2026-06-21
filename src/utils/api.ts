// Utility function to get the base server URL
export const getServerBaseUrl = (): string => {
  // Usar variable de entorno si existe, sino usar puerto 3005 (el puerto actual del backend)
  // HTTP en local porque el backend corre con SSL_ENABLED=false (ver backend/.env)
  return import.meta.env.VITE_API_URL || 'http://localhost:3005';
};

// Utility function to get the API base URL
export const getApiBaseUrl = (): string => {
  return `${getServerBaseUrl()}/api`;
};

// Utility function to resolve image URLs with proxy support
export const resolveImageUrl = (url: string): string => {
  if (!url) return '';

  // Imágenes subidas (/uploads/...): se sirven bajo /api/uploads para que en producción
  // pasen por el proxy de Nginx que enruta /api al backend (Nginx no enruta /uploads).
  if (url.startsWith('/uploads/')) {
    return `${getServerBaseUrl()}/api${url}`;
  }

  // Otros paths locales: anteponer la base del servidor.
  if (url.startsWith('/')) {
    return `${getServerBaseUrl()}${url}`;
  }

  // If it's an external URL, use the image proxy to avoid CORS issues
  if (url.startsWith('http://') || url.startsWith('https://')) {
    const proxyUrl = `${getServerBaseUrl()}/api/proxy/image?url=${encodeURIComponent(url)}`;
    return proxyUrl;
  }

  return url;
};