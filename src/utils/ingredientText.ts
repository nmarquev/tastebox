const decodeIngredientHtmlEntities = (value: string) =>
  value
    .replace(/&frac14;/gi, '¼')
    .replace(/&frac12;/gi, '½')
    .replace(/&frac34;/gi, '¾')
    .replace(/&frac13;/gi, '⅓')
    .replace(/&frac23;/gi, '⅔')
    .replace(/&frac18;/gi, '⅛')
    .replace(/&frac38;/gi, '⅜')
    .replace(/&frac58;/gi, '⅝')
    .replace(/&frac78;/gi, '⅞')
    .replace(/&#(\d+);/g, (_, value) => String.fromCodePoint(Number(value)))
    .replace(/&#x([0-9a-f]+);/gi, (_, value) => String.fromCodePoint(parseInt(value, 16)));

export const normalizeIngredientText = (value?: string | null) =>
  decodeIngredientHtmlEntities(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\s*\n+\s*/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

const UNITS = new Set([
  'g',
  'gr',
  'gramo',
  'gramos',
  'kg',
  'kilo',
  'kilos',
  'ml',
  'l',
  'litro',
  'litros',
  'cc',
  'cdita',
  'cditas',
  'cdta',
  'cdtas',
  'cucharadita',
  'cucharaditas',
  'cda',
  'cdas',
  'cucharada',
  'cucharadas',
  'taza',
  'tazas',
  'pizca',
  'pizcas',
  'unidad',
  'unidades',
  'diente',
  'dientes',
  'hoja',
  'hojas',
  'rama',
  'ramas',
  'paquete',
  'paquetes',
  'sobre',
  'sobres',
]);

const FRACTION_AMOUNT = '(?:\\d+\\s+)?(?:\\d+[.,]?\\d*|\\d+\\/\\d+|[¼½¾⅓⅔⅛⅜⅝⅞])(?:\\s*(?:-|a|–|—)\\s*(?:\\d+[.,]?\\d*|\\d+\\/\\d+|[¼½¾⅓⅔⅛⅜⅝⅞]))?';

const parseIngredientLine = (line: string) => {
  const match = line.match(new RegExp(`^(${FRACTION_AMOUNT})\\s+(.+)$`, 'i'));
  if (!match) return null;

  const amount = normalizeIngredientText(match[1]);
  let rest = normalizeIngredientText(match[2]);
  if (!amount || !rest) return null;

  const [firstToken = '', ...remainingTokens] = rest.split(/\s+/);
  const normalizedUnit = firstToken.toLocaleLowerCase('es');
  if (UNITS.has(normalizedUnit) && remainingTokens.length) {
    rest = remainingTokens.join(' ').replace(/^de\s+/i, '').trim();
    return { amount, unit: firstToken, name: rest };
  }

  return { amount, unit: '', name: rest.replace(/^de\s+/i, '').trim() };
};

export const normalizeIngredient = <T extends { name?: string; amount?: string; unit?: string; section?: string }>(ingredient: T) => ({
  ...ingredient,
  ...(() => {
    const name = normalizeIngredientText(ingredient.name);
    const amount = normalizeIngredientText(ingredient.amount);
    const unit = normalizeIngredientText(ingredient.unit);
    const parsed = !amount && !unit ? parseIngredientLine(name) : null;
    return parsed || { name, amount, unit };
  })(),
  section: normalizeIngredientText(ingredient.section),
});
