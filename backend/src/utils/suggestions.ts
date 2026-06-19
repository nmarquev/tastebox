export function sanitizeSuggestionText(value?: string | null): string | undefined {
  if (!value?.trim()) return undefined;

  const suggestions = value
    .split(/\r?\n/)
    .map(line => line.trim().replace(/^\s*(?:\d+[.)-]|[-*•·])\s*/, '').trim())
    .filter(Boolean)
    .filter(line => {
      const key = line
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '');

      return !/^tm\d*$/.test(key);
    });

  return suggestions.length ? Array.from(new Set(suggestions)).join('\n') : undefined;
}
