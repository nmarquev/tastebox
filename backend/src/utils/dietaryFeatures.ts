interface GlutenFreeRecipeText {
  title?: string | null;
  description?: string | null;
  suggestions?: string | null;
  recipeType?: string | null;
  dishType?: string | null;
  tags?: Array<string | { tag?: string; name?: string }> | null;
  ingredients?: Array<{ name?: string; section?: string | null }> | null;
  instructions?: Array<{ description?: string; section?: string | null }> | null;
}

const GLUTEN_FREE_PATTERN = /\b(?:sin\s+gluten|gluten[\s-]?free|libre\s+de\s+gluten|sin\s+tacc)\b/i;

export function mentionsGlutenFree(recipe: GlutenFreeRecipeText): boolean {
  const tags = (recipe.tags || []).map(tag =>
    typeof tag === 'string' ? tag : tag.tag || tag.name || ''
  );
  const ingredients = (recipe.ingredients || []).flatMap(ingredient => [
    ingredient.name || '',
    ingredient.section || '',
  ]);
  const instructions = (recipe.instructions || []).flatMap(instruction => [
    instruction.description || '',
    instruction.section || '',
  ]);

  return GLUTEN_FREE_PATTERN.test([
    recipe.title,
    recipe.description,
    recipe.suggestions,
    recipe.recipeType,
    recipe.dishType,
    ...tags,
    ...ingredients,
    ...instructions,
  ].filter(Boolean).join(' '));
}
