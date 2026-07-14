export const SOCIAL_INGREDIENTS_UNAVAILABLE =
  'No están disponibles los ingredientes ni los pasos de preparación en la publicación ni en sus primeros 5 comentarios.';

const ingredientPlaceholder = /^(?:ingrediente|ingredientes no especificados|ingredientes según el video)$/i;
const instructionPlaceholder = /^(?:paso de preparación|preparar según la receta original|seguir las instrucciones mostradas en el video|visitar el enlace original para ver el contenido completo)$/i;

export function isSocialRecipeUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return /(^|\.)(?:instagram|tiktok)\.com$/i.test(hostname);
  } catch {
    return false;
  }
}

export function removeSocialPlaceholders<Ingredient extends { name?: string }>(
  ingredients: Ingredient[] | undefined
): Ingredient[] {
  return (ingredients || []).filter(ingredient => {
    const name = ingredient.name?.trim();
    return Boolean(name && !ingredientPlaceholder.test(name));
  });
}

export function removeSocialInstructionPlaceholders<Instruction extends { description?: string }>(
  instructions: Instruction[] | undefined
): Instruction[] {
  return (instructions || []).filter(instruction => {
    const description = instruction.description?.trim();
    return Boolean(description && !instructionPlaceholder.test(description));
  });
}
