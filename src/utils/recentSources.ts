const RECENT_SOURCES_KEY = "tastebox-recent-sources";
const MAX_RECENT_SOURCES = 10;

export const getRecentSources = (): string[] => {
  if (typeof window === "undefined") return [];

  try {
    const stored = window.localStorage.getItem(RECENT_SOURCES_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed)
      ? parsed.filter((name) => typeof name === "string").slice(0, MAX_RECENT_SOURCES)
      : [];
  } catch {
    return [];
  }
};

export const saveRecentSource = (sourceName: string) => {
  if (typeof window === "undefined") return;

  const name = sourceName.trim();
  if (!name) return;

  const next = [
    name,
    ...getRecentSources().filter(
      (existing) => existing.toLocaleLowerCase("es") !== name.toLocaleLowerCase("es")
    ),
  ].slice(0, MAX_RECENT_SOURCES);

  window.localStorage.setItem(RECENT_SOURCES_KEY, JSON.stringify(next));
};
