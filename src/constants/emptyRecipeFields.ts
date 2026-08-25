export const EMPTY_RECIPE_FIELD_OPTIONS = [
  { value: 'title', label: 'Título' },
  { value: 'description', label: 'Descripción' },
  { value: 'source', label: 'Fuente' },
  { value: 'url', label: 'URL' },
  { value: 'origin', label: 'Origen' },
  { value: 'difficulty', label: 'Dificultad' },
  { value: 'language', label: 'Idioma' },
  { value: 'country', label: 'País' },
  { value: 'date', label: 'Fecha' },
  { value: 'nutrition', label: 'Información nutricional' },
  { value: 'image', label: 'Imagen' },
  { value: 'dishType', label: 'Tipo de comida' },
  { value: 'collection', label: 'Colección' },
  { value: 'tags', label: 'Etiquetas' },
  { value: 'ingredients', label: 'Ingredientes' },
  { value: 'instructions', label: 'Preparación' },
] as const;

export type EmptyRecipeField = typeof EMPTY_RECIPE_FIELD_OPTIONS[number]['value'];

const EMPTY_RECIPE_FIELD_VALUES = new Set<string>(
  EMPTY_RECIPE_FIELD_OPTIONS.map(option => option.value)
);

export const isEmptyRecipeField = (value: string): value is EmptyRecipeField =>
  EMPTY_RECIPE_FIELD_VALUES.has(value);

export const getEmptyRecipeFieldLabel = (value: EmptyRecipeField) =>
  EMPTY_RECIPE_FIELD_OPTIONS.find(option => option.value === value)?.label || value;
