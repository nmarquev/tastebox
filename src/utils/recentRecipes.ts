const RECENT_RECIPES_KEY = "tastebox-recent-recipes";
const MAX_RECENT_RECIPES = 12;

export const getRecentRecipeIds = (): string[] => {
  if (typeof window === "undefined") return [];

  try {
    const stored = window.localStorage.getItem(RECENT_RECIPES_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed)
      ? parsed.filter((id) => typeof id === "string").slice(0, MAX_RECENT_RECIPES)
      : [];
  } catch {
    return [];
  }
};

export const saveRecentRecipe = (recipeId: string) => {
  if (typeof window === "undefined") return;

  const id = recipeId.trim();
  if (!id) return;

  const next = [id, ...getRecentRecipeIds().filter((existing) => existing !== id)].slice(0, MAX_RECENT_RECIPES);
  window.localStorage.setItem(RECENT_RECIPES_KEY, JSON.stringify(next));
};
