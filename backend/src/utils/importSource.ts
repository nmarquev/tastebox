export const importSources = ['www', 'instagram', 'youtube', 'doc'] as const;

export type ImportSource = typeof importSources[number];

export function getAuthorFromSourceUrl(url?: string | null): string {
  if (!url) return 'Receta propia';

  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.replace(/^www\./i, '').toLowerCase();

    if (hostname === 'cookidoo.international' || hostname.endsWith('.cookidoo.international')) {
      return 'cookidoo';
    }

    if (hostname === 'instagram.com' || hostname.endsWith('.instagram.com')) {
      const segment = parsedUrl.pathname.split('/').filter(Boolean)[0];
      const reserved = ['p', 'reel', 'reels', 'tv', 'stories', 'explore', 'accounts'];
      if (segment && !reserved.includes(segment.toLowerCase())) {
        return `@${segment}`;
      }
      return 'instagram.com';
    }

    return hostname;
  } catch {
    return 'Receta propia';
  }
}

export function detectImportSource(url?: string | null): ImportSource | undefined {
  if (!url) return undefined;

  try {
    const hostname = new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
    if (hostname === 'instagram.com' || hostname.endsWith('.instagram.com')) {
      return 'instagram';
    }
    if (
      hostname === 'youtube.com'
      || hostname.endsWith('.youtube.com')
      || hostname === 'youtu.be'
    ) {
      return 'youtube';
    }
    return 'www';
  } catch {
    return undefined;
  }
}
