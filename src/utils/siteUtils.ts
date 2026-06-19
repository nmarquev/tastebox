export function getSourceFromUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    const host = parsedUrl.hostname.replace(/^www\./, '');

    if (/(^|\.)cookidoo\.international$/i.test(host)) {
      return 'cookidoo';
    }

    if (/(^|\.)instagram\.com$/i.test(host)) {
      const segment = parsedUrl.pathname.split('/').filter(Boolean)[0];
      const reserved = ['p', 'reel', 'reels', 'tv', 'stories', 'explore', 'accounts'];
      if (segment && !reserved.includes(segment.toLowerCase())) {
        return segment;
      }
      return 'instagram.com';
    }

    return host.split('.')[0] || host;
  } catch {
    // No es una URL: es una fuente de texto libre (ej. nombre de un libro).
    return url?.trim() || 'Fuente desconocida';
  }
}

export function getSourceDomainFromUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    const host = parsedUrl.hostname.replace(/^www\./, '');

    if (/(^|\.)cookidoo\.international$/i.test(host)) {
      return 'cookidoo';
    }

    if (/(^|\.)instagram\.com$/i.test(host)) {
      return getSourceFromUrl(url);
    }

    return host;
  } catch {
    return url?.trim() || 'Fuente desconocida';
  }
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// Fuente a mostrar de una receta: el campo `source` (de quién es la receta) si existe;
// si no, se deriva de la URL (recetas viejas que sólo tienen sourceUrl).
export function getRecipeSource(recipe: { source?: string | null; sourceUrl?: string | null }): string {
  const explicit = (recipe.source || '').trim();
  if (explicit) return explicit;
  const url = (recipe.sourceUrl || '').trim();
  if (url) return getSourceFromUrl(url);
  return '';
}
