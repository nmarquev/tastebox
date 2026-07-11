const RECENT_CATEGORIES_KEY = "tastebox-recent-categories";
const MAX_RECENT_CATEGORIES = 8;

export const getRecentCategories = (): string[] => {
  if (typeof window === "undefined") return [];

  try {
    const stored = window.localStorage.getItem(RECENT_CATEGORIES_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed)
      ? parsed.filter((name) => typeof name === "string").slice(0, MAX_RECENT_CATEGORIES)
      : [];
  } catch {
    return [];
  }
};

export const saveRecentCategory = (categoryName: string) => {
  if (typeof window === "undefined") return;

  const name = categoryName.trim();
  if (!name) return;

  const next = [
    name,
    ...getRecentCategories().filter(
      (existing) => existing.toLocaleLowerCase("es") !== name.toLocaleLowerCase("es")
    ),
  ].slice(0, MAX_RECENT_CATEGORIES);

  window.localStorage.setItem(RECENT_CATEGORIES_KEY, JSON.stringify(next));
};
