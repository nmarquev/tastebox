// Deriva el nombre de la fuente a partir de la URL (espejo del helper del frontend).
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
