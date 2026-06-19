function uppercaseFirstLetter(value: string): string {
  return value.replace(/\p{L}/u, letter => letter.toLocaleUpperCase('es'));
}

export function normalizeRecipeTitle(value: string): string {
  const normalized = value.trim().toLocaleLowerCase('es');
  return uppercaseFirstLetter(normalized);
}

export function normalizeInstructionDescription(value: string): string {
  return uppercaseFirstLetter(value.trim());
}
