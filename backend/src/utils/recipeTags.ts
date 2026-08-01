type IngredientForTag = {
  name?: string;
  amount?: string;
  unit?: string;
  order?: number;
};

type RecipeTagFeatures = {
  glutenFree?: boolean;
  lowCarb?: boolean;
  keto?: boolean;
  vegetarian?: boolean;
  proteica?: boolean;
};

const ALWAYS_NON_MAIN_INGREDIENT = /\b(?:agua|hielo|sal|pimienta|aceite|vinagre|caldo|pastilla de caldo|zumo|jugo|piel|ralladura|oregano|tomillo|romero|laurel|comino|pimenton|paprika|curry|canela|nuez moscada|vainilla|ras el hanout)\b/i;
const GENERIC_NON_MAIN_INGREDIENT = /\b(?:azucar|edulcorante|harina|pan rallado|levadura|polvo de hornear|bicarbonato|maicena|almidon|ajo|semillas? de sesamo|perejil|cilantro)\b/i;

const MAIN_INGREDIENT_LABELS: Array<[RegExp, string]> = [
  [/\bpollo\b|\bchicken\b/i, 'pollo'],
  [/\bpavo\b|\bturkey\b/i, 'pavo'],
  [/\bternera\b|\bvacuno\b|\bres\b|\bbeef\b/i, 'carne'],
  [/\bcerdo\b|\bpanceta\b|\bbacon\b|\bjamon\b|\bpork\b/i, 'cerdo'],
  [/\bcordero\b|\blamb\b/i, 'cordero'],
  [/\bsalmon\b/i, 'salmón'],
  [/\batun\b/i, 'atún'],
  [/\bmerluza\b/i, 'merluza'],
  [/\bbacalao\b/i, 'bacalao'],
  [/\bpescad[oa]\b|\bfish\b/i, 'pescado'],
  [/\bgambas?\b|\bcamarones?\b|\blangostinos?\b|\bshrimp\b/i, 'gambas'],
  [/\bmariscos?\b/i, 'mariscos'],
  [/\bqueso\b|\bcheese\b/i, 'queso'],
  [/\bleche\b|\bmilk\b/i, 'leche'],
  [/\byogur\b|\byogurt\b/i, 'yogur'],
  [/\bnata\b|\bcrema de leche\b|\bcream\b/i, 'crema'],
  [/\bmantequilla\b|\bbutter\b/i, 'mantequilla'],
  [/\bricota\b|\brequeson\b|\bricotta\b/i, 'ricota'],
  [/\bhuevos?\b|\beggs?\b/i, 'huevo'],
  [/\bpasta\b|\bfideos?\b|\bespaguetis?\b|\bspaghetti\b|\bmacarrones?\b|\bnoodles?\b/i, 'pasta'],
  [/\barroz\b|\brice\b/i, 'arroz'],
  [/\bquinoa\b/i, 'quinoa'],
  [/\bcuscus\b|\bcouscous\b/i, 'cuscús'],
  [/\blentejas?\b/i, 'lentejas'],
  [/\bgarbanzos?\b/i, 'garbanzos'],
  [/\bporotos?\b|\bfrijoles?\b|\balubias?\b|\bjudias?\b/i, 'legumbres'],
  [/\barvejas?\b|\bguisantes?\b/i, 'arvejas'],
  [/\bsoja\b/i, 'soja'],
  [/\bcalabac(?:in|ines)\b|\bzucchini\b/i, 'calabacín'],
  [/\bzanahorias?\b/i, 'zanahoria'],
  [/\bberenjenas?\b/i, 'berenjena'],
  [/\btomates?\b/i, 'tomate'],
  [/\bcebollas?\b/i, 'cebolla'],
  [/\bpapas?\b|\bpatatas?\b/i, 'papa'],
  [/\bbatatas?\b|\bboniatos?\b/i, 'batata'],
  [/\bcalabazas?\b|\bzapallos?\b/i, 'calabaza'],
  [/\bbrocoli\b/i, 'brócoli'],
  [/\bcoliflor\b/i, 'coliflor'],
  [/\bespinacas?\b/i, 'espinaca'],
  [/\bacelgas?\b/i, 'acelga'],
  [/\bpimientos?\b|\bmorrones?\b/i, 'pimiento'],
  [/\bmaiz\b|\bchoclo\b/i, 'maíz'],
  [/\bpalta\b|\baguacate\b/i, 'palta'],
  [/\bchampinones?\b|\bsetas?\b|\bhongos?\b/i, 'hongos'],
  [/\bmanzanas?\b/i, 'manzana'],
  [/\bperas?\b/i, 'pera'],
  [/\bbananas?\b|\bplatanos?\b/i, 'banana'],
  [/\bnaranjas?\b/i, 'naranja'],
  [/\blimones?\b/i, 'limón'],
  [/\bfrutillas?\b|\bfresas?\b/i, 'frutilla'],
  [/\bchocolate\b|\bcacao\b/i, 'chocolate'],
  [/\balmendras?\b/i, 'almendras'],
  [/\bnueces?\b/i, 'nueces'],
  [/\bavellanas?\b/i, 'avellanas'],
  [/\bmani\b|\bcacahuetes?\b/i, 'maní'],
];

const TITLE_DISH_LABELS: Array<[RegExp, string]> = [
  [/\bensaladas?\b/i, 'ensalada'],
  [/\bsopas?\b/i, 'sopa'],
  [/\bguisos?\b/i, 'guiso'],
  [/\btartas?\b/i, 'tarta'],
  [/\btortas?\b/i, 'torta'],
  [/\bbudines?\b/i, 'budín'],
  [/\bmuffins?\b/i, 'muffin'],
  [/\bmagdalenas?\b/i, 'magdalena'],
  [/\bgalletas?\b|\bcookies?\b/i, 'galletas'],
  [/\bbrownies?\b/i, 'brownie'],
  [/\bbizcochos?\b/i, 'bizcocho'],
  [/\bpanqueques?\b/i, 'panqueques'],
  [/\bwaffles?\b|\bgofres?\b/i, 'waffles'],
  [/\bpizzas?\b/i, 'pizza'],
  [/\bempanadas?\b/i, 'empanadas'],
  [/\bcroquetas?\b/i, 'croquetas'],
  [/\bhamburguesas?\b/i, 'hamburguesa'],
  [/\balbondigas?\b/i, 'albóndigas'],
  [/\bmilanesas?\b/i, 'milanesa'],
  [/\brisotto\b/i, 'risotto'],
  [/\bpanes?\b/i, 'pan'],
  [/\bfocaccia\b/i, 'focaccia'],
  [/\bquiche\b/i, 'quiche'],
  [/\bflanes?\b/i, 'flan'],
  [/\bhelados?\b/i, 'helado'],
  [/\bmousse\b/i, 'mousse'],
  [/\bfritos?\b/i, 'fritos'],
];

const INGREDIENT_PREFIX = /^(?:(?:\d+\s+)?(?:\d+[.,]?\d*|\d+\/\d+|[¼½¾⅓⅔⅛⅜⅝⅞])(?:\s*(?:-|a|–|—)\s*(?:\d+[.,]?\d*|\d+\/\d+|[¼½¾⅓⅔⅛⅜⅝⅞]))?\s+)?(?:g|gr|gramos?|kg|ml|l|litros?|cditas?|cucharaditas?|cdas?|cucharadas?|tazas?|pellizcos?|unidades?)?\b\s*(?:de\s+)?/i;

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
    .replace(INGREDIENT_PREFIX, '')
    .replace(/\s+o\s+.+$/i, '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/[,;].*$/g, '')
    .replace(/\b(?:en trozos|trocead[ao]s?|picad[ao]s?|pelad[ao]s?|cortad[ao]s?|molid[ao]s?|rallad[ao]s?|sin piel|sin semillas|para servir|para freir)\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function mainIngredientLabel(value: string): string | undefined {
  const normalized = normalize(value);
  return MAIN_INGREDIENT_LABELS.find(([pattern]) => pattern.test(normalized))?.[1];
}

function labelsFromTitle(title: string): string[] {
  const normalizedTitle = normalize(title);
  const orderedMatches = (patterns: Array<[RegExp, string]>) => patterns
    .map(([pattern, label]) => ({ label, index: normalizedTitle.search(pattern) }))
    .filter(match => match.index >= 0)
    .sort((a, b) => a.index - b.index)
    .map(match => match.label);
  const labels = [
    ...orderedMatches(MAIN_INGREDIENT_LABELS),
    ...orderedMatches(TITLE_DISH_LABELS),
  ];
  return Array.from(new Set(labels.map(normalize))).map(
    key => labels.find(label => normalize(label) === key)!
  );
}

export function deriveMainIngredientTags(
  ingredients: IngredientForTag[],
  title = '',
  limit = 4
): string[] {
  const normalizedTitle = normalize(title);
  const candidates = ingredients
    .map((ingredient, index) => {
      const name = cleanIngredientName(ingredient.name || '');
      const normalizedName = normalize(name);
      const label = mainIngredientLabel(normalizedName);
      const tag = label || name.split(/\s+/).slice(0, 3).join(' ');
      const normalizedTag = normalize(tag);

      return {
        tag,
        normalizedTag,
        recognizedMainFood: Boolean(label),
        titleMatch: normalizedTag.length > 2 && (
          normalizedTitle.includes(normalizedTag)
          || normalizedName.split(' ').some(word => word.length > 3 && normalizedTitle.includes(word))
        ),
        order: ingredient.order ?? index + 1,
        isExcluded: !normalizedName
          || ALWAYS_NON_MAIN_INGREDIENT.test(normalizedName)
          || (!label && GENERIC_NON_MAIN_INGREDIENT.test(normalizedName)),
      };
    })
    .filter(candidate => candidate.tag && !candidate.isExcluded)
    .sort((a, b) =>
      Number(b.titleMatch) - Number(a.titleMatch)
      || Number(b.recognizedMainFood) - Number(a.recognizedMainFood)
      || a.order - b.order
    );

  const seen = new Set<string>();
  const tags: string[] = [];
  for (const titleTag of labelsFromTitle(title)) {
    const key = normalize(titleTag);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    tags.push(titleTag);
    if (tags.length >= limit) return tags;
  }

  for (const candidate of candidates) {
    if (!candidate.normalizedTag || seen.has(candidate.normalizedTag)) continue;
    seen.add(candidate.normalizedTag);
    tags.push(candidate.tag);
    if (tags.length >= limit) break;
  }
  return tags;
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
    selected.push(...deriveMainIngredientTags(ingredients, title, 2));
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
