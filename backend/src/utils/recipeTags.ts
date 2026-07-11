type IngredientForTag = {
  name?: string;
  order?: number;
};

type RecipeTagFeatures = {
  glutenFree?: boolean;
  lowCarb?: boolean;
  keto?: boolean;
  vegetarian?: boolean;
  proteica?: boolean;
};

const GENERIC_INGREDIENTS = new Set([
  'agua',
  'sal',
  'pimienta',
  'aceite',
  'aceite de oliva',
  'aceite vegetal',
  'hielo',
]);

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanIngredientName(value: string): string {
  return value
    .replace(/\s+o\s+.+$/i, '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getRecipeTags(
  tags: string[],
  ingredients: IngredientForTag[],
  title = '',
  features: RecipeTagFeatures = {}
): string[] {
  const existingTags = tags.map(tag => tag.trim()).filter(Boolean);
  const selected = [...existingTags];

  if (existingTags.length === 0) {
    const normalizedTitle = normalize(title);
    const candidates = ingredients
      .map((ingredient, index) => {
        const name = cleanIngredientName(ingredient.name || '');
        const normalizedName = normalize(name);
        const titleMatch = normalizedName
          .split(' ')
          .some(word => word.length > 3 && normalizedTitle.includes(word));

        return {
          name,
          normalizedName,
          order: ingredient.order ?? index + 1,
          titleMatch,
        };
      })
      .filter(candidate =>
        candidate.name
        && !GENERIC_INGREDIENTS.has(candidate.normalizedName)
      )
      .sort((a, b) =>
        Number(b.titleMatch) - Number(a.titleMatch)
        || a.order - b.order
      );

    const seenIngredients = new Set<string>();
    for (const candidate of candidates) {
      if (seenIngredients.has(candidate.normalizedName)) continue;
      seenIngredients.add(candidate.normalizedName);
      selected.push(candidate.name);
      if (seenIngredients.size === 2) break;
    }
  }

  const featureTags = [
    features.glutenFree ? 'sin gluten' : '',
    features.lowCarb ? 'low carb' : '',
    features.keto ? 'keto' : '',
    features.vegetarian ? 'vegetariana' : '',
    features.proteica ? 'proteica' : '',
  ].filter(Boolean);

  const seen = new Set<string>();
  return [...selected, ...featureTags].filter(tag => {
    const key = normalize(tag);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
