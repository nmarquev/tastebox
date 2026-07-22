export const normalizeIngredientText = (value?: string | null) =>
  (value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\s*\n+\s*/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

export const normalizeIngredient = <T extends { name?: string; amount?: string; unit?: string; section?: string }>(ingredient: T) => ({
  ...ingredient,
  name: normalizeIngredientText(ingredient.name),
  amount: normalizeIngredientText(ingredient.amount),
  unit: normalizeIngredientText(ingredient.unit),
  section: normalizeIngredientText(ingredient.section),
});
