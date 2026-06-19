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

  // If it's a local/uploaded image path, prepend the server base URL
  if (url.startsWith('/uploads/') || url.startsWith('/')) {
    return `${getServerBaseUrl()}${url}`;
  }

  // If it's an external URL, use the image proxy to avoid CORS issues
  if (url.startsWith('http://') || url.startsWith('https://')) {
    const proxyUrl = `${getServerBaseUrl()}/api/proxy/image?url=${encodeURIComponent(url)}`;
    return proxyUrl;
  }

  return url;
};