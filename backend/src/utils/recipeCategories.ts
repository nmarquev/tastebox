const CATEGORY_SEPARATOR = '|';

// Categorías históricas cuyo nombre contiene comas. Permite distinguirlas de
// registros viejos que guardaban varias categorías separadas por coma.
const KNOWN_COMMA_CATEGORIES = [
  'Cereales, Barritas y Frutos Secos',
  'Croquetas, Tortillas y Hamburguesas',
  'Fajitas, Tortillas y Tacos',
  'Masitas Dulces, Cookies y Facturas',
  'Masitas Saladas, Bizcochos y Palitos',
  'Papas, Batatas y Zapallos',
];

export const parseRecipeCategories = (recipeType?: string | null): string[] => {
  const value = (recipeType || '').trim();
  if (!value) return [];
  if (value.includes(CATEGORY_SEPARATOR)) {
    return value.split(CATEGORY_SEPARATOR).map(item => item.trim()).filter(Boolean);
  }
  if (KNOWN_COMMA_CATEGORIES.includes(value)) return [value];

  const parts = value.split(',').map(item => item.trim()).filter(Boolean);
  const categories: string[] = [];
  for (let index = 0; index < parts.length; index += 1) {
    let current = parts[index];
    while (index + 1 < parts.length && !KNOWN_COMMA_CATEGORIES.includes(current)) {
      const candidate = `${current}, ${parts[index + 1]}`;
      if (!KNOWN_COMMA_CATEGORIES.some(category => category.startsWith(candidate))) break;
      current = candidate;
      index += 1;
    }
    categories.push(current);
  }
  return categories;
};
