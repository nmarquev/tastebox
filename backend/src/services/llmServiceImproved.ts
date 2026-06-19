import OpenAI from 'openai';
import { z } from 'zod';
import { RecipeImportResponse } from '../types/recipe';
import axios from 'axios';
import { createOpenAIClient } from '../config/openai';
import { getModel, getVisionModel } from '../config/aiSettings';

// Parseo robusto del JSON devuelto por el LLM. Algunos modelos (DeepSeek, etc.) ignoran
// response_format:json_object y devuelven el JSON envuelto en fences markdown (```json ... ```)
// o con texto/razonamiento alrededor. Esto limpia esos casos antes de JSON.parse.
function parseLlmJson(content: string): any {
  if (!content) throw new SyntaxError('Respuesta vacía de LLM');
  let text = content.trim();
  // 1) Intento directo (caso ideal: JSON puro).
  try { return JSON.parse(text); } catch { /* sigue */ }
  // 2) Si viene envuelto en un bloque de código markdown, tomar su contenido.
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence && fence[1]) {
    try { return JSON.parse(fence[1].trim()); } catch { /* sigue */ }
    text = fence[1].trim();
  }
  // 3) Extraer el objeto JSON más externo (desde el primer { hasta el último }).
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    return JSON.parse(text.slice(first, last + 1));
  }
  throw new SyntaxError('No se encontró un objeto JSON en la respuesta del LLM');
}

// Detecta si una receta está en inglés o español a partir de su texto (título,
// ingredientes, pasos). Usa palabras frecuentes de cocina/idioma como marcadores.
function detectRecipeLanguage(text: string): 'Español' | 'Inglés' {
  if (!text) return 'Español';
  const t = ' ' + text.toLowerCase() + ' ';
  const en = (t.match(/\b(the|and|with|for|cup|cups|tablespoon|teaspoon|minutes|until|add|mix|bake|heat|oven|ounce|ounces|pound|pounds|chopped|sliced|preheat|stir|salt|water|flour|sugar|butter|onion|garlic|chicken|cheese|dough|until)\b/g) || []).length;
  const es = (t.match(/\b(el|la|los|las|con|para|una|uno|taza|tazas|cucharada|cucharadita|minutos|hasta|agregar|añadir|mezclar|hornear|horno|gramos|sal|agua|harina|az[uú]car|manteca|cebolla|ajo|pollo|queso|masa|picad[oa]|cortad[oa])\b/g) || []).length;
  return en > es ? 'Inglés' : 'Español';
}

// Función auxiliar para limpiar etiquetas HTML del texto
// Cookidoo usa una fuente de íconos: la "velocidad cuchara" es el glifo U+E002 que
// aparece tras "vel" (en texto plano se pierde y queda "vel " vacío). Lo convertimos a
// la palabra "cuchara" para que sobreviva a la extracción; el resto de glifos (PUA) se
// quitan y se colapsan las barras "//" que quedan.
function normalizeThermomixGlyphs(text: string): string {
  if (!text) return text;
  const SPOON = String.fromCharCode(0xE002);   // glifo de velocidad cuchara (Cookidoo)
  const REVERSE = String.fromCharCode(0xE003); // glifo de giro inverso (Cookidoo)
  const PUA = new RegExp("[" + String.fromCharCode(0xE000) + "-" + String.fromCharCode(0xF8FF) + "]", "g");
  const DOUBLE_SLASH = new RegExp("(?<!:)/{2,}", "g"); // // sobrantes (no en URLs)
  return text
    .split(REVERSE).join("giro inverso")
    .split(SPOON).join("cuchara")
    .replace(PUA, "")
    .replace(DOUBLE_SLASH, "/");
}

function cleanHtmlFromText(text: string): string {
  if (!text) return text;
  return normalizeThermomixGlyphs(text)
    .replace(/<nobr>/gi, '')
    .replace(/<\/nobr>/gi, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')  // Remove all HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeNumericHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, value) => String.fromCodePoint(Number(value)))
    .replace(/&#x([0-9a-f]+);/gi, (_, value) => String.fromCodePoint(parseInt(value, 16)));
}

export function extractInstagramCaption(html: string): string {
  if (!html) return '';

  const captionMatch = html.match(
    /<div[^>]*class=["'][^"']*\bCaption\b[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<div[^>]*class=["'][^"']*\bFooter\b/i
  );
  if (!captionMatch?.[1]) return '';

  return decodeNumericHtmlEntities(
    normalizeThermomixGlyphs(captionMatch[1])
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(?:p|li)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
  )
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n');
}

export function extractSuggestionsFromText(text: string): string[] {
  if (!text) return [];

  const suggestionHeading = /^(?:[^\p{L}\p{N}]*)?(?:tips?|consejos?|sugerencias?|notas?|trucos?|recomendaciones?|variantes?)(?:\s+de\s+[^:]+)?\s*:?\s*$/iu;
  const inlineSuggestion = /^(?:[^\p{L}\p{N}]*)?(?:tips?|consejos?|sugerencias?|notas?|trucos?|recomendaciones?|variantes?)(?:\s+de\s+[^:]+)?\s*:\s*(.+)$/iu;
  const otherSectionHeading = /^(?:ingredientes?|preparaci[oó]n|instrucciones?|procedimiento|para la masa|para el relleno)\s*:?\s*$/i;
  const suggestions: string[] = [];
  let inSuggestionSection = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const inlineMatch = line.match(inlineSuggestion);
    if (inlineMatch?.[1]) {
      suggestions.push(inlineMatch[1]);
      inSuggestionSection = false;
      continue;
    }

    if (suggestionHeading.test(line)) {
      inSuggestionSection = true;
      continue;
    }

    if (otherSectionHeading.test(line)) {
      inSuggestionSection = false;
      continue;
    }

    if (inSuggestionSection) {
      if (/^#/.test(line)) {
        inSuggestionSection = false;
        continue;
      }
      suggestions.push(line);
    }
  }

  return sanitizeSuggestions(suggestions);
}

function parseDurationMinutes(value: string): number | undefined {
  const hours = value.match(/(\d+)\s*h/i);
  const minutes = value.match(/(\d+)\s*min/i);
  if (!hours && !minutes) return undefined;
  return Number(hours?.[1] || 0) * 60 + Number(minutes?.[1] || 0);
}

export function normalizeCookidooSummary(
  description: string | undefined,
  prepTime: number,
  cookTime?: number,
  title = ''
): { description?: string; cookTime?: number } {
  if (!description) return { description, cookTime };

  const cleanDescription = cleanHtmlFromText(description);
  const yieldUnits = 'raciones|porciones|portions|servings|piezas|pieces';
  const isTimingSummary =
    /\bprep(?:araci[oó]n)?\.?\s*\d/i.test(cleanDescription)
    && /\btotal\s*\d/i.test(cleanDescription)
    && new RegExp(`\\b(?:${yieldUnits})\\b`, 'i').test(cleanDescription);

  if (!isTimingSummary) {
    return { description: cleanDescription, cookTime };
  }

  const totalText = cleanDescription.match(
    new RegExp(`\\btotal\\s+(.+?)(?=[.\\s]+\\d+\\s*(?:${yieldUnits})\\b|$)`, 'i')
  )?.[1];
  const totalMinutes = totalText ? parseDurationMinutes(totalText) : undefined;
  const descriptionPrefix = cleanDescription
    .split(/\bprep(?:araci[oó]n)?\.?\s*\d/i)[0]
    .replace(/[.\s]+$/, '')
    .trim();
  const remainingDescription = normalizeSuggestion(descriptionPrefix) === normalizeSuggestion(title)
    ? undefined
    : descriptionPrefix || undefined;

  return {
    description: remainingDescription,
    cookTime: totalMinutes !== undefined
      ? Math.max(totalMinutes - prepTime, 0)
      : cookTime,
  };
}

type ExtractedIngredient = {
  name: string;
  amount: string;
  unit?: string;
  section?: string;
};

type CookidooAlternative = {
  primary: string;
  alternative: string;
};

type CookidooIngredientDescription = {
  name: string;
  description: string;
};

export function extractCookidooIngredientDescriptions(html: string): CookidooIngredientDescription[] {
  if (!html || !/recipe-ingredient__description/i.test(html)) return [];

  const descriptions: CookidooIngredientDescription[] = [];
  const blocks = html.match(/<recipe-ingredient\b[^>]*>[\s\S]*?<\/recipe-ingredient>/gi) || [];

  for (const block of blocks) {
    const nameMatch = block.match(
      /<span[^>]*class=["'][^"']*\brecipe-ingredient__name\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i
    );
    const descriptionMatch = block.match(
      /<span[^>]*class=["'][^"']*\brecipe-ingredient__description\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i
    );
    if (!nameMatch || !descriptionMatch) continue;

    const name = cleanHtmlFromText(nameMatch[1]);
    const description = cleanHtmlFromText(descriptionMatch[1]);
    if (name && description) descriptions.push({ name, description });
  }

  return descriptions;
}

// Cookidoo renders substitutions inside the same ingredient block, while its
// JSON-LD only contains the primary option.
export function extractCookidooAlternatives(html: string): CookidooAlternative[] {
  if (!html || !/recipe-ingredient__alternative/i.test(html)) return [];

  const alternatives: CookidooAlternative[] = [];
  const blocks = html.match(/<recipe-ingredient\b[^>]*>[\s\S]*?<\/recipe-ingredient>/gi) || [];

  for (const block of blocks) {
    const primaryMatch = block.match(
      /<span[^>]*class=["'][^"']*\brecipe-ingredient__name\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i
    );
    const alternativeMatch = block.match(
      /<span[^>]*class=["'][^"']*\brecipe-ingredient__alternative\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i
    );
    if (!primaryMatch || !alternativeMatch) continue;

    const descriptionMatch = block.match(
      /<span[^>]*class=["'][^"']*\brecipe-ingredient__description\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i
    );
    const primary = cleanHtmlFromText(`${primaryMatch[1]} ${descriptionMatch?.[1] || ''}`);
    const alternative = cleanHtmlFromText(alternativeMatch[1]);

    if (primary && alternative) alternatives.push({ primary, alternative });
  }

  return alternatives;
}

function normalizeIngredientText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\bde\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function ingredientText(ingredient: ExtractedIngredient): string {
  return [ingredient.amount, ingredient.unit, ingredient.name].filter(Boolean).join(' ');
}

function ingredientMatchesText(ingredient: ExtractedIngredient, text: string): boolean {
  const ingredientNormalized = normalizeIngredientText(ingredientText(ingredient));
  const textNormalized = normalizeIngredientText(text);
  return ingredientNormalized === textNormalized
    || ingredientNormalized.includes(textNormalized)
    || textNormalized.includes(ingredientNormalized);
}

export function mergeCookidooIngredientDescriptions(
  ingredients: ExtractedIngredient[],
  html: string
): ExtractedIngredient[] {
  const descriptions = extractCookidooIngredientDescriptions(html);
  if (descriptions.length === 0) return ingredients;

  const merged = [...ingredients];

  for (const detail of descriptions) {
    const nameKey = normalizeIngredientText(detail.name);
    const descriptionKey = normalizeIngredientText(detail.description);
    const primaryIndex = merged.findIndex(ingredient => {
      const ingredientName = normalizeIngredientText(ingredient.name);
      return ingredientName === nameKey
        || ingredientName.startsWith(`${nameKey} `)
        || nameKey.startsWith(`${ingredientName} `);
    });
    if (primaryIndex < 0) continue;

    const currentName = merged[primaryIndex].name;
    if (!normalizeIngredientText(currentName).includes(descriptionKey)) {
      merged[primaryIndex] = {
        ...merged[primaryIndex],
        name: `${currentName}, ${detail.description}`
      };
    }

    const duplicateDescriptionIndex = merged.findIndex((ingredient, index) =>
      index !== primaryIndex
      && normalizeIngredientText(ingredient.name) === descriptionKey
      && !ingredient.amount?.trim()
      && !ingredient.unit?.trim()
    );
    if (duplicateDescriptionIndex >= 0) {
      merged.splice(duplicateDescriptionIndex, 1);
    }
  }

  return merged;
}

export function mergeCookidooAlternativeIngredients(
  ingredients: ExtractedIngredient[],
  html: string
): ExtractedIngredient[] {
  const pairs = extractCookidooAlternatives(html);
  if (pairs.length === 0) return ingredients;

  const merged = [...ingredients];

  for (const pair of pairs) {
    const alternativeText = normalizeIngredientText(pair.alternative);
    const primaryIndex = merged.findIndex(ingredient => {
      const currentText = normalizeIngredientText(ingredientText(ingredient));
      return ingredientMatchesText(ingredient, pair.primary)
        && !currentText.includes(alternativeText);
    });
    if (primaryIndex < 0) continue;

    const alternativeIndex = merged.findIndex((ingredient, index) =>
      index !== primaryIndex
      && ingredientMatchesText(ingredient, pair.alternative)
      && !ingredientMatchesText(ingredient, pair.primary)
    );
    const primary = merged[primaryIndex];
    merged[primaryIndex] = {
      ...primary,
      name: `${primary.name} o ${pair.alternative}`,
    };

    if (alternativeIndex >= 0) merged.splice(alternativeIndex, 1);
  }

  return merged;
}

// Convierte el cuerpo del HTML a texto legible: elimina scripts, estilos, head, SVG y
// comentarios (que son la mayor parte del markup ruidoso) y deja saltos de línea entre
// bloques. Así el presupuesto de caracteres se gasta en CONTENIDO real, no en markup.
function htmlToReadableText(html: string): string {
  if (!html) return '';
  return normalizeThermomixGlyphs(html)
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<head[\s\S]*?<\/head>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    // Forzar salto de línea en cierres/aperturas de bloque para no pegar pasos entre sí
    .replace(/<\/(p|div|li|ol|ul|h[1-6]|section|article|tr|td|br)>/gi, '\n')
    .replace(/<(p|div|li|ol|ul|h[1-6]|section|article|tr|br)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderedTextToHtml(renderedText?: string): string {
  if (!renderedText?.trim()) return '';

  const sectionHeading = /^(?:ingredientes?|preparaci[oó]n|instrucciones?|procedimiento|tips?|consejos?|sugerencias?|notas?|trucos?|recomendaciones?|variantes?|informaci[oó]n nutricional)\s*:?\s*$/i;
  const lines = renderedText
    .slice(0, 50000)
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  return `<section data-tastebox-rendered-text="true">
${lines.map(line => sectionHeading.test(line)
    ? `<h2>${escapeHtml(line)}</h2>`
    : `<p>${escapeHtml(line)}</p>`
  ).join('\n')}
</section>`;
}

function normalizeSuggestion(value: string): string {
  return cleanHtmlFromText(value)
    .replace(/^\s*(?:\d+[.)]|[-*•·▪◦]|â€¢|\.)\s*/, '')
    .trim();
}

function suggestionKey(value: string): string {
  return normalizeSuggestion(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isSuggestionInterfaceLabel(value: string): boolean {
  const key = suggestionKey(value);
  if (!key) return true;

  const exactLabels = new Set([
    'dispositivos y accesorios',
    'utensilios',
    'dificultad',
    'inf nutricional',
    'informacion nutricional',
    'pais',
    'compartir',
    'buscar recetas similares',
    'tambien incluido en',
    'tambien podria gustarte',
  ]);

  return exactLabels.has(key)
    || /^tm(?:\d+)?$/.test(key);
}

export function sanitizeSuggestions(values: string[]): string[] {
  const sanitized: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const suggestion = normalizeSuggestion(value);
    const key = suggestionKey(suggestion);
    if (!suggestion || !key || isSuggestionInterfaceLabel(suggestion) || seen.has(key)) {
      continue;
    }
    seen.add(key);
    sanitized.push(suggestion);
  }

  return sanitized;
}

export function extractSuggestionsFromHtml(html: string): string[] {
  if (!html) return [];

  const suggestionHeading = '(?:tips?|consejos?|sugerencias?|notas?|trucos?|recomendaciones?|variantes?)';
  const markedText = normalizeThermomixGlyphs(html)
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<head[\s\S]*?<\/head>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, (_, heading) =>
      `\n__HEADING__${cleanHtmlFromText(heading)}\n`
    )
    // Algunos sitios usan div/span/p con estilo de título en lugar de h1-h6.
    .replace(
      new RegExp(`<(?:div|span|p)[^>]*>\\s*(${suggestionHeading})\\s*:?[\\s]*<\\/(?:div|span|p)>`, 'gi'),
      (_, heading) => `\n__HEADING__${cleanHtmlFromText(heading)}\n`
    )
    .replace(/<\/(p|div|li|ol|ul|section|article|tr|td|br)>/gi, '\n')
    .replace(/<(p|div|li|ol|ul|section|article|tr|br)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ');

  const headingPattern = /^(tips?|consejos?|sugerencias?|notas?|trucos?|recomendaciones?|variantes?)\s*:?\s*$/i;
  const suggestions: string[] = [];
  let inSuggestionSection = false;

  for (const rawLine of markedText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('__HEADING__')) {
      const heading = normalizeSuggestion(line.slice('__HEADING__'.length));
      inSuggestionSection = headingPattern.test(heading);
      continue;
    }

    // Encabezado de sección que no quedó envuelto en <h*>/<div>/<p> simple
    // (p.ej. <p><strong>Tip</strong></p>): una línea corta que es exactamente
    // la palabra clave también abre la sección de sugerencias.
    if (headingPattern.test(normalizeSuggestion(line))) {
      inSuggestionSection = true;
      continue;
    }

    if (!inSuggestionSection) continue;
    const suggestion = normalizeSuggestion(line);
    if (suggestion) suggestions.push(suggestion);
  }

  // Notas marcadas con asterisco fuera de una sección formal.
  const starredParagraphs = html.match(/<(?:p|li)[^>]*>\s*\*+[\s\S]*?<\/(?:p|li)>/gi) || [];
  starredParagraphs
    .map(value => normalizeSuggestion(value))
    .filter(Boolean)
    .forEach(value => suggestions.push(value));

  return sanitizeSuggestions(suggestions);
}

function mergeSuggestions(htmlSuggestions: string[], llmSuggestions?: string): string | undefined {
  const merged = sanitizeSuggestions([
    ...htmlSuggestions,
    ...(llmSuggestions || '').split(/\r?\n/),
  ]);

  return merged.length ? merged.join('\n') : undefined;
}

// Normaliza el campo "image" de schema.org (string | string[] | ImageObject | array)
// y devuelve la primera URL válida.
function firstImageUrl(image: any): string | null {
  if (!image) return null;
  if (typeof image === 'string') return image;
  if (Array.isArray(image)) {
    for (const it of image) { const u = firstImageUrl(it); if (u) return u; }
    return null;
  }
  if (typeof image === 'object') return image.url || image.contentUrl || null;
  return null;
}

// Junta URLs de imagen de la página: og:image / twitter:image (meta tags) + el campo
// image del JSON-LD Recipe. La conversión a texto borra los <img>, así que sin esto
// el LLM no vería ninguna imagen. Devuelve hasta 3 URLs absolutas, sin duplicados.
function extractImageUrls(html: string): string[] {
  if (!html) return [];
  const urls: string[] = [];
  const add = (u?: string | null) => {
    if (u && /^https?:\/\//i.test(u) && !urls.includes(u)) urls.push(u);
  };

  // Meta tags og:image / twitter:image (con property o name, en cualquier orden de atributos)
  const metaRe = /<meta[^>]+(?:property|name)=["'](?:og:image(?::url)?|twitter:image(?::src)?)["'][^>]*>/gi;
  for (const tag of html.match(metaRe) || []) {
    add(tag.match(/content=["']([^"']+)["']/i)?.[1]);
  }

  // image del JSON-LD Recipe
  const blocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const block of blocks) {
    const jsonText = block.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
    try {
      const visit = (node: any) => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) { node.forEach(visit); return; }
        const type = node['@type'];
        if (type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'))) add(firstImageUrl(node.image));
        if (node['@graph']) visit(node['@graph']);
      };
      visit(JSON.parse(jsonText));
    } catch { /* ignorar JSON-LD malformado */ }
  }

  return dedupeBestImages(urls);
}

// Clave de "imagen base": ignora el token de tamaño/transform del CDN y el query string,
// para detectar que dos URLs son la MISMA foto en distinta resolución.
// Ej: .../upload/t_web_recipe_584x480/img/... y .../upload/t_web_recipe_584x480_1_5x/img/...
function imageAssetKey(url: string): string {
  return url
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/[?#].*$/, '')
    // CDNs tipo Cloudinary/tmecosys: /image/upload/<transform>/resto → quitar el transform
    .replace(/\/image\/upload\/[^/]+\//, '/image/upload/')
    // Segmentos de tamaño sueltos: /584x480/ , /w_800/ , /800x600/
    .replace(/\/(?:w_\d+|h_\d+|\d+x\d+)\//g, '/');
}

// Puntaje de calidad para elegir, entre duplicados, la versión de mayor resolución.
function imageQualityScore(url: string): number {
  const dim = url.match(/(\d{2,5})x(\d{2,5})/);
  let score = dim ? parseInt(dim[1], 10) * parseInt(dim[2], 10) : 0;
  // Multiplicadores de escala: _1_5x (1.5x), _2x (2x), @2x, etc.
  const scale = url.match(/[_@](\d+)(?:_(\d+))?x(?:[/._]|$)/i);
  if (scale) {
    const mult = parseFloat(`${scale[1]}.${scale[2] || 0}`);
    if (mult > 0) score = (score || 1) * mult;
  }
  return score;
}

// Agrupa URLs que son la misma imagen (por asset base) y se queda con la de mayor
// calidad de cada grupo. Devuelve hasta 3 imágenes DISTINTAS.
function dedupeBestImages(urls: string[]): string[] {
  const groups = new Map<string, string>();
  for (const url of urls) {
    const key = imageAssetKey(url);
    const current = groups.get(key);
    if (!current || imageQualityScore(url) > imageQualityScore(current)) {
      groups.set(key, url);
    }
  }
  return Array.from(groups.values()).slice(0, 3);
}

// Extrae la tabla de información nutricional de Cookidoo (componente <rdp-nutritious>),
// con los valores EXACTOS por porción que muestra la página (incl. grasas saturadas).
export function extractCookidooNutrition(html: string): Record<string, number> | null {
  if (!html || !html.includes('rdp-nutritious')) return null;
  const num = (s: string): number | undefined => {
    const m = String(s).replace(/ /g, ' ').replace(',', '.').match(/-?\d+(?:\.\d+)?/);
    return m ? parseFloat(m[0]) : undefined;
  };
  const out: Record<string, number> = {};
  const items = html.split('rdp-nutritious__item').slice(1);
  for (const it of items) {
    const name = it.match(/rdp-nutritious__name"[^>]*>\s*([^<]+?)\s*</i)?.[1]?.toLowerCase();
    const value = it.match(/rdp-nutritious__value"[^>]*>\s*([^<]+?)\s*</i)?.[1];
    if (!name || !value) continue;
    let v: number | undefined;
    if (name.includes('calor')) {
      // "2074.1 kJ / 495.7 kcal" → preferir kcal
      const k = value.toLowerCase().match(/([\d.,]+)\s*kcal/);
      v = k ? parseFloat(k[1].replace(',', '.')) : num(value);
      if (v !== undefined) out.calories = v;
    } else if (name.includes('proteína') || name.includes('proteina')) { v = num(value); if (v !== undefined) out.protein = v; }
    else if (name.includes('carbohidrat')) { v = num(value); if (v !== undefined) out.carbohydrates = v; }
    else if (name.includes('saturad')) { v = num(value); if (v !== undefined) out.saturatedFat = v; } // antes que "grasa"
    else if (name.includes('grasa')) { v = num(value); if (v !== undefined) out.fat = v; }
    else if (name.includes('fibra')) { v = num(value); if (v !== undefined) out.fiber = v; }
    else if (name.includes('sodio')) { v = num(value); if (v !== undefined) out.sodium = v; }
    else if (name.includes('azúc') || name.includes('azuc')) { v = num(value); if (v !== undefined) out.sugar = v; }
  }
  return Object.keys(out).length ? out : null;
}

// Extrae datos estructurados schema.org/Recipe de los bloques JSON-LD.
// La mayoría de los sitios de recetas los incluyen y contienen los ingredientes e
// instrucciones EXACTOS, por lo que son la fuente más fiable (evita alucinaciones).
function extractRecipeJsonLd(html: string): string | null {
  if (!html) return null;
  const blocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (!blocks || blocks.length === 0) return null;

  const recipes: any[] = [];
  const visit = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    const type = node['@type'];
    const isRecipe = type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'));
    if (isRecipe) recipes.push(node);
    if (node['@graph']) visit(node['@graph']);
  };

  for (const block of blocks) {
    const jsonText = block.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
    try { visit(JSON.parse(jsonText)); } catch { /* JSON-LD malformado: ignorar */ }
  }

  if (recipes.length === 0) return null;

  // Devuelve los pasos con su sección REAL (solo si el JSON-LD usa HowToSection).
  const flattenInstructions = (instr: any, section?: string): { text: string; section?: string }[] => {
    if (!instr) return [];
    if (typeof instr === 'string') return [{ text: cleanHtmlFromText(instr), section }];
    if (Array.isArray(instr)) return instr.flatMap(x => flattenInstructions(x, section));
    // HowToSection: su "name" es una sección REAL de la receta (ej. "Masa", "Relleno")
    if (instr.itemListElement) {
      const name = instr.name ? cleanHtmlFromText(String(instr.name)) : section;
      return flattenInstructions(instr.itemListElement, name);
    }
    const text = instr.text || instr.name;
    return text ? [{ text: cleanHtmlFromText(String(text)), section }] : [];
  };

  const out: string[] = [];
  recipes.forEach((r, i) => {
    if (recipes.length > 1) out.push(`--- Receta ${i + 1} ---`);
    if (r.name) out.push(`Título: ${cleanHtmlFromText(String(r.name))}`);
    const img = firstImageUrl(r.image);
    if (img) out.push(`Imagen principal: ${img}`);
    if (r.recipeYield) out.push(`Porciones/Rinde: ${Array.isArray(r.recipeYield) ? r.recipeYield.join(', ') : r.recipeYield}`);
    if (r.totalTime || r.cookTime || r.prepTime) out.push(`Tiempos: prep=${r.prepTime || '-'} cook=${r.cookTime || '-'} total=${r.totalTime || '-'}`);
    const ings = Array.isArray(r.recipeIngredient) ? r.recipeIngredient : (r.recipeIngredient ? [r.recipeIngredient] : []);
    if (ings.length) {
      out.push('Ingredientes:');
      ings.forEach((ing: any) => out.push(`- ${cleanHtmlFromText(String(ing))}`));
    }
    const steps = flattenInstructions(r.recipeInstructions);
    if (steps.length) {
      out.push('Instrucciones (TEXTO EXACTO - transcribir sin modificar):');
      let curSection: string | undefined;
      let n = 0;
      steps.forEach((s) => {
        if (s.section && s.section !== curSection) {
          curSection = s.section;
          out.push(`Sección: ${curSection}`); // sección REAL del origen
        }
        out.push(`${++n}. ${s.text}`);
      });
    }
  });

  return out.length ? out.join('\n') : null;
}

// Esquema de validation para respuesta LLM - VERSIÓN ULTRA RESILIENTE
const llmResponseSchema = z.object({
  error: z.boolean().optional(),
  title: z.string().min(1).catch('Receta Importada'), // título por defecto
  description: z.string().optional().nullable().transform(val => val || undefined),
  suggestions: z.union([
    z.string(),
    z.array(z.string()).transform(values => values.filter(Boolean).join('\n'))
  ]).optional().nullable().transform(val => val || undefined),
  images: z.array(z.object({
    url: z.string().url().catch(''), // URLs inválidas se convierten en vacías
    altText: z.string().optional().nullable().transform(val => val || undefined),
    order: z.number().min(1).max(3).catch(1) // orden inválido se convierte en 1
  })).max(3).optional().catch([]).transform(val => val || []), // hacer imágenes completamente opcionales con fallback
  ingredients: z.array(z.object({
    name: z.string().min(1).catch('Ingrediente'), // nombre de ingrediente por defecto
    amount: z.string().min(0).transform(val => val?.trim() === '' ? 'al gusto' : (val || 'al gusto')),
    unit: z.string().optional().nullable().transform(val => val || undefined),
    section: z.string().optional().nullable().transform(val => val || undefined) // Sección para recetas multiparte
  }).catch({name: 'Ingrediente', amount: 'al gusto', unit: undefined, section: undefined})) // capturar errores de ingredientes individuales
    .transform(ingredients => ingredients.filter(ing => ing.name && ing.name.trim() !== '' && ing.name !== 'Ingrediente')) // filtrar nombres vacíos y fallback
    .transform(ingredients => ingredients.length > 0 ? ingredients : [{name: 'Ingredientes no especificados', amount: 'al gusto', unit: undefined, section: undefined}]), // asegurar al menos 1 ingrediente
  instructions: z.array(z.object({
    step: z.number().min(1).catch(1), // números de paso inválidos se convierten en 1
    description: z.string().min(1).transform(val => cleanHtmlFromText(val)).catch('Paso de preparación'), // Limpiar HTML y descripción fallback
    function: z.string().optional().nullable().transform(val => val || undefined), // Función Thermomix
    time: z.string().optional().nullable().transform(val => val || undefined), // Tiempo Thermomix
    temperature: z.string().optional().nullable().transform(val => val || undefined), // Temperatura Thermomix
    speed: z.string().optional().nullable().transform(val => val || undefined), // Velocidad Thermomix
    section: z.string().optional().nullable().transform(val => val || undefined) // Sección para recetas multiparte
  })).min(1).catch([{step: 1, description: 'Preparar según la receta original', function: undefined, time: undefined, temperature: undefined, speed: undefined, section: undefined}]), // mínimo 1 instrucción
  prepTime: z.number().min(1).nullable().catch(30).transform(val => val ?? 30), // siempre retornar número válido
  cookTime: z.number().nullable().optional().catch(null).transform(val => val === null ? undefined : val),
  servings: z.number().min(1).nullable().catch(4).transform(val => val ?? 4), // siempre retornar número válido
  difficulty: z.enum(['Fácil', 'Medio', 'Difícil']).nullable().optional().catch(null).transform(val => val ?? undefined), // vacío si la receta no indica dificultad
  recipeType: z.string().nullable().optional().catch(null).transform(val => val === null || val === '' ? undefined : val),
  tags: z.array(z.string()).max(4).optional().catch([]).transform(val => val || []) // Límite de 4 tags máximo
});

export class LLMServiceImproved {
  private openai: OpenAI;

  constructor() {
    this.openai = createOpenAIClient({
      timeout: 60000 // Timeout de 60 segundos para requests LLM
    });
  }

  async extractRecipeFromUrl(url: string): Promise<RecipeImportResponse> {
    console.log('\n🚀 INICIANDO EXTRACCIÓN DE RECETA');
    console.log('📍 URL:', url);

    try {
      // Check if it's a video URL and handle differently
      if (this.isVideoUrl(url)) {
        console.log('🎥 URL de video detectada, intentando extracción de transcripción...');
        return await this.extractRecipeFromVideo(url);
      }

      // Fetch HTML content for regular pages
      console.log('🌐 Obteniendo contenido web...');
      const html = await this.fetchWebContent(url);
      console.log('✅ Contenido web obtenido successfully');
      console.log('📏 Longitud del contenido:', html.length, 'characters');

      // Extract recipe data with LLM
      console.log('🤖 Iniciando extracción LLM...');
      const recipeData = await this.extractRecipeWithLLM(html, url);

      console.log('🎉 EXTRACCIÓN DE RECETA COMPLETADA EXITOSAMENTE');
      console.log('📋 Título final de receta:', recipeData.title);
      console.log('=====================================\n');

      return recipeData;
    } catch (error) {
      console.error('\n💥 EXTRACCIÓN DE RECETA FALLÓ');
      console.error('❌ Error:', error);
      console.error('📍 URL que falló:', url);
      console.error('=====================================\n');
      throw new Error(`Error al extraer receta: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  private isVideoUrl(url: string): boolean {
    const videoPatterns = [
      /youtube\.com\/watch/i,
      /youtu\.be\//i,
      /instagram\.com\/p\//i,
      /instagram\.com\/reel\//i,
      /instagram\.com\/tv\//i,
      /tiktok\.com\//i,
      /facebook\.com\/.*\/videos\//i,
      /vimeo\.com\//i,
    ];

    return videoPatterns.some(pattern => pattern.test(url));
  }

  private async extractRecipeFromVideo(url: string): Promise<RecipeImportResponse> {
    console.log('🎥 Procesando URL de video para extracción de receta');

    try {
      let content: string = '';
      let instagramUsername: string | undefined;
      let instagramCanonicalUrl: string | undefined;

      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        console.log('📺 Video de YouTube detectado');
        content = await this.extractYouTubeContent(url);
      } else if (url.includes('instagram.com')) {
        console.log('📷 Video de Instagram detectado');
        const ig = await this.extractInstagramContent(url);
        content = ig.content;
        instagramUsername = ig.username;
        instagramCanonicalUrl = ig.canonicalUrl;
      } else {
        console.log('🎬 Otra plataforma de video, obteniendo contenido de página');
        try {
          content = await this.fetchWebContent(url);
        } catch (fetchError) {
          console.log('Error al obtener contenido de video, usando URL como respaldo');
          content = `Video URL: ${url}\nPlatform: Other video platform`;
        }
      }

      // Ensure we have some content to work with
      if (!content || content.trim().length === 0) {
        content = `Video URL: ${url}\nNote: Limited content available for extraction.`;
      }

      console.log('📝 Longitud de contenido para procesar:', content.length, 'characters');

      // Use specialized video prompt
      const recipeData = await this.extractRecipeFromVideoContent(content, url);

      // Instagram: la URL del post no incluye el usuario. Si lo detectamos, reconstruimos
      // la URL de origen como instagram.com/<usuario>/reel/<código> para que la fuente
      // muestre el usuario (formato que Instagram soporta y mantiene el enlace al post).
      if (url.includes('instagram.com')) {
        recipeData.sourceUrl = instagramCanonicalUrl
          || this.buildInstagramSourceUrl(url, instagramUsername);
      }

      console.log('✅ Extracción de receta de video completada');
      return recipeData;

    } catch (error) {
      console.error('❌ Extracción de video falló:', error);

      // Create a fallback recipe based on the URL
      const fallbackRecipe = this.createFallbackVideoRecipe(url, error instanceof Error ? error.message : 'Error desconocido');
      return fallbackRecipe;
    }
  }

  private createFallbackVideoRecipe(url: string, errorMessage: string): RecipeImportResponse {
    console.log('🔄 Creando receta de respaldo para URL de video');

    const urlParts = url.split('/');
    const videoId = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2] || 'video';

    const fallbackTitle = url.includes('instagram.com') ? 'Receta de Instagram' :
                         url.includes('youtube.com') ? 'Receta de YouTube' :
                         url.includes('tiktok.com') ? 'Receta de TikTok' : 'Receta de Video';

    return {
      title: fallbackTitle,
      description: `Receta extraída de video. ID: ${videoId}`,
      images: [],
      ingredients: [
        { name: 'Ingredientes según el video', amount: 'al gusto', unit: undefined }
      ],
      instructions: [
        { step: 1, description: 'Seguir las instrucciones mostradas en el video' },
        { step: 2, description: 'Visitar el enlace original para ver el contenido completo' }
      ],
      prepTime: 30,
      cookTime: undefined,
      servings: 4,
      difficulty: 'Medio',
      recipeType: 'Video Recipe',
      tags: ['video', 'importado']
    };
  }

  private async extractYouTubeContent(url: string): Promise<string> {
    console.log('📺 Obteniendo página de YouTube para transcripción/descripción...');

    try {
      // Fetch the YouTube page to get video metadata, description, etc.
      const html = await this.fetchWebContent(url);

      // Extract key information from YouTube page
      // This includes title, description, and any available transcript information
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      const descriptionMatch = html.match(/"shortDescription":"([^"]+)"/);
      const transcriptMatch = html.match(/"captions":\s*{[^}]*"playerCaptionsTracklistRenderer"/);

      let content = '';

      if (titleMatch) {
        content += `Title: ${titleMatch[1]}\n\n`;
      }

      if (descriptionMatch) {
        // Decode JSON string
        const description = descriptionMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
        content += `Description:\n${description}\n\n`;
      }

      if (transcriptMatch) {
        content += 'Note: Video has captions/transcript available\n';
      }

      // Extract video ID and add thumbnail image
      const videoIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
      if (videoIdMatch) {
        const videoId = videoIdMatch[1];
        // YouTube provides different quality thumbnails
        const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        content += `\nVideo Thumbnail: ${thumbnailUrl}\n`;
        console.log('🖼️ Miniatura de YouTube extraída:', thumbnailUrl);
      }

      // Also include relevant metadata from the page
      const scriptMatches = html.match(/<script[^>]*>var ytInitialData = ({.*?});<\/script>/s);
      if (scriptMatches) {
        try {
          const data = JSON.parse(scriptMatches[1]);
          // Extract any recipe-related information from structured data
          const videoData = JSON.stringify(data).substring(0, 5000); // Limit size
          content += `\nVideo metadata:\n${videoData}`;
        } catch (parseError) {
          console.log('No se pudo parsear datos estructurados de YouTube');
        }
      }

      if (!content.trim()) {
        content = html; // Fallback to full HTML if we couldn't extract specific parts
      }

      return content;

    } catch (error) {
      console.error('Error al extraer contenido de YouTube:', error);
      throw error;
    }
  }

  private async extractInstagramContent(url: string): Promise<{
    content: string;
    username?: string;
    canonicalUrl?: string;
  }> {
    console.log('📷 Obteniendo página de Instagram para caption/contenido...');

    try {
      const postMatch = url.match(/instagram\.com\/(?:[^/]+\/)?(p|reel|tv)\/([A-Za-z0-9_-]+)/i);
      let caption = '';

      if (postMatch) {
        try {
          const embedUrl = `https://www.instagram.com/${postMatch[1].toLowerCase()}/${postMatch[2]}/embed/captioned/`;
          const embedHtml = await this.fetchWebContent(embedUrl);
          caption = extractInstagramCaption(embedHtml);
          if (caption) {
            console.log('📝 Caption completo de Instagram obtenido:', caption.length, 'characters');
          }
        } catch (captionError) {
          console.log('⚠️ No se pudo obtener el caption embebido de Instagram');
        }
      }

      let html = '';
      try {
        html = await this.fetchWebContent(url);
      } catch (pageError) {
        if (!caption) throw pageError;
        console.log('⚠️ Página normal de Instagram no disponible; se usará el caption embebido');
      }

      if ((!html || typeof html !== 'string' || html.length === 0) && !caption) {
        throw new Error('No se recibió contenido HTML de Instagram');
      }

      const canonicalUrl = html.match(
        /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i
      )?.[1];
      const username = this.extractInstagramUsername(html)
        || this.extractInstagramUsername(canonicalUrl || '');
      if (username) console.log('👤 Usuario de Instagram detectado:', '@' + username);

      // Extract Instagram post metadata
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      const metaDescMatch = html.match(/<meta name="description" content="([^"]+)"/i);
      const ogDescMatch = html.match(/<meta property="og:description" content="([^"]+)"/i);
      const ogImageMatch = html.match(/<meta property="og:image" content="([^"]+)"/i);

      let content = caption ? `Instagram caption:\n${caption}\n\n` : '';

      if (titleMatch && titleMatch[1]) {
        content += `Title: ${titleMatch[1]}\n\n`;
      }

      if (metaDescMatch && metaDescMatch[1]) {
        content += `Description: ${metaDescMatch[1]}\n\n`;
      } else if (ogDescMatch && ogDescMatch[1]) {
        content += `Description: ${ogDescMatch[1]}\n\n`;
      }

      // Extract Instagram images - try multiple sources to avoid play button overlay
      const twitterImageMatch = html.match(/<meta name="twitter:image" content="([^"]+)"/i);
      const videoPosterMatch = html.match(/<meta property="og:video:poster" content="([^"]+)"/i);
      const videoThumbnailMatch = html.match(/<meta property="video:thumbnail" content="([^"]+)"/i);

      // Prefer alternative image sources that might not have play button overlay
      let selectedImageUrl = null;
      let imageSource = '';

      if (videoPosterMatch && videoPosterMatch[1]) {
        selectedImageUrl = videoPosterMatch[1];
        imageSource = 'video:poster';
        console.log('🖼️ Poster de video de Instagram encontrado (may have less overlay):', selectedImageUrl);
      } else if (videoThumbnailMatch && videoThumbnailMatch[1]) {
        selectedImageUrl = videoThumbnailMatch[1];
        imageSource = 'video:thumbnail';
        console.log('🖼️ Miniatura de video de Instagram encontrada:', selectedImageUrl);
      } else if (twitterImageMatch && twitterImageMatch[1]) {
        selectedImageUrl = twitterImageMatch[1];
        imageSource = 'twitter:image';
        console.log('🖼️ Imagen de twitter de Instagram encontrada (may have different overlay):', selectedImageUrl);
      } else if (ogImageMatch && ogImageMatch[1]) {
        selectedImageUrl = ogImageMatch[1];
        imageSource = 'og:image';
        console.log('🖼️ og:image de Instagram encontrada (likely has play button overlay):', selectedImageUrl);
      }

      // Look for structured data with recipe information and alternative images
      const jsonLdMatches = html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/g);
      let jsonImageFound = false;

      if (jsonLdMatches && jsonLdMatches.length > 0) {
        for (const match of jsonLdMatches) {
          try {
            const jsonContent = match.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
            const data = JSON.parse(jsonContent);
            if (data) {
              // Look for images in JSON-LD data
              const findImages = (obj: any): string[] => {
                const images: string[] = [];
                if (typeof obj === 'string' && (obj.includes('.jpg') || obj.includes('.jpeg') || obj.includes('.png') || obj.includes('.webp'))) {
                  images.push(obj);
                } else if (Array.isArray(obj)) {
                  obj.forEach(item => images.push(...findImages(item)));
                } else if (typeof obj === 'object' && obj !== null) {
                  Object.values(obj).forEach(value => images.push(...findImages(value)));
                }
                return images;
              };

              const foundImages = findImages(data);
              if (foundImages.length > 0 && !selectedImageUrl) {
                // Prefer first image from JSON-LD if we don't have a better source
                selectedImageUrl = foundImages[0];
                imageSource = 'json-ld';
                console.log('🖼️ Imagen JSON-LD de Instagram encontrada:', selectedImageUrl);
                jsonImageFound = true;
              }

              content += `\nStructured data: ${JSON.stringify(data).substring(0, 2000)}\n`;
            }
          } catch (e) {
            // Continue with next match
            console.log('Error al parsear datos JSON-LD, continuando...');
          }
        }
      }

      // Add final selected image URL to content
      if (selectedImageUrl) {
        content += `Video Thumbnail (${imageSource}): ${selectedImageUrl}\n`;
      }

      // Try to extract content from Instagram's data
      const instagramDataMatch = html.match(/window\._sharedData\s*=\s*({.*?});/);
      if (instagramDataMatch && instagramDataMatch[1]) {
        try {
          const sharedData = JSON.parse(instagramDataMatch[1]);
          if (sharedData && sharedData.entry_data) {
            content += `\nInstagram data found: ${JSON.stringify(sharedData).substring(0, 1000)}\n`;
          }
        } catch (e) {
          console.log('Error al parsear datos compartidos de Instagram');
        }
      }

      if (!content.trim()) {
        // If we can't extract specific data, create a basic recipe from URL info
        const urlParts = url.split('/');
        const reelId = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2];
        content = `Instagram Reel ID: ${reelId}\nURL: ${url}\nNote: Limited content extraction from Instagram. Creating basic recipe from available information.`;
      }

      console.log('📱 Contenido de Instagram extracted:', content.length, 'characters');
      return { content, username, canonicalUrl };

    } catch (error) {
      console.error('Error al extraer contenido de Instagram:', error);
      // Return a fallback content instead of throwing
      return {
        content: `Instagram Video URL: ${url}\nNote: Could not extract detailed content. Creating basic recipe from URL information.`,
        username: undefined,
        canonicalUrl: undefined,
      };
    }
  }

  // Detecta el nombre de usuario (@handle) de una página de Instagram a partir de
  // varias señales del HTML (datos embebidos y meta tags), de más a menos fiable.
  private extractInstagramUsername(html: string): string | undefined {
    if (!html) return undefined;
    const reserved = new Set(['instagram', 'explore', 'p', 'reel', 'reels', 'tv', 'stories', 'accounts']);
    const patterns = [
      /"owner"\s*:\s*\{[^}]*?"username"\s*:\s*"([A-Za-z0-9._]{1,30})"/i,
      /"user"\s*:\s*\{[^}]*?"username"\s*:\s*"([A-Za-z0-9._]{1,30})"/i,
      /"username"\s*:\s*"([A-Za-z0-9._]{1,30})"/i,
      /"alternateName"\s*:\s*"@?([A-Za-z0-9._]{1,30})"/i,
      /<meta[^>]+property=["']og:title["'][^>]+content=["'][^"']*?\(@([A-Za-z0-9._]{1,30})\)/i,
      /<meta[^>]+(?:name=["']description["']|property=["']og:description["'])[^>]+content=["'][^"']*?-\s*([A-Za-z0-9._]{1,30})\s+(?:el|on)\s+/i,
      /instagram\.com\/([A-Za-z0-9._]{1,30})\/(?:p|reel|tv)\//i,
    ];
    for (const p of patterns) {
      const m = html.match(p);
      if (m && m[1] && !reserved.has(m[1].toLowerCase())) return m[1];
    }
    return undefined;
  }

  // Reconstruye la URL de origen de Instagram incluyendo el usuario, conservando el
  // tipo (p/reel/tv) y el código del post. Si no hay usuario, devuelve la URL original.
  private buildInstagramSourceUrl(originalUrl: string, username?: string): string {
    if (!username) return originalUrl;
    const m = originalUrl.match(/instagram\.com\/(?:[^/]+\/)?(p|reel|tv)\/([A-Za-z0-9_-]+)/i);
    if (!m) return originalUrl;
    return `https://www.instagram.com/${username}/${m[1].toLowerCase()}/${m[2]}/`;
  }

  private async extractRecipeFromVideoContent(content: string, sourceUrl: string): Promise<RecipeImportResponse> {
    console.log('🤖 Processing video content with specialized prompt...');

    try {
      if (!content || content.trim().length === 0) {
        throw new Error('No content provided for video extraction');
      }

      const videoPrompt = this.buildVideoExtractionPrompt(content);

      const completion = await this.openai.chat.completions.create({
        model: getModel(),
        messages: [
          {
            role: 'system',
            content: `Eres un extractor especializado de recetas de videos de cocina. Responde rápido sin demoras en razonamiento. Tu trabajo es extraer información de recetas desde:
- Títulos y descripciones de videos de cocina
- Transcripciones o subtítulos cuando estén disponibles
- Metadatos de videos que contengan recetas

BUSCA información sobre:
- Ingredientes mencionados en títulos, descripciones o transcripciones
- Pasos de preparación descritos en el contenido
- Tips, sugerencias de salsa, consejos, notas y recomendaciones, separados de los pasos
- Tiempos de cocción o preparación mencionados
- Número de porciones
- Dificultad (si se menciona)

IMPORTANTE para videos:
- Si solo tienes el título/descripción, infiere los ingredientes básicos
- Para ingredientes sin cantidades específicas, usa "al gusto"
- Crea pasos básicos de preparación basados en el tipo de receta
- Conserva las sugerencias explícitas en "suggestions"; no las conviertas en instrucciones
- Si no hay información completa, proporciona una receta básica funcional

La respuesta DEBE ser un JSON válido con la estructura exacta solicitada.`
          },
          {
            role: 'user',
            content: videoPrompt
          }
        ],
        max_completion_tokens: 4000,
        response_format: { type: 'json_object' }
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        throw new Error('No response content from OpenAI API');
      }

      console.log('📄 LLM Response received');
      console.log('📏 Response longitud:', responseContent.length, 'characters');

      let parsedResponse: any;
      try {
        parsedResponse = parseLlmJson(responseContent);
      } catch (parseError) {
        console.error('❌ JSON Parse Error:', parseError);
        console.error('📄 Raw response:', responseContent.substring(0, 500));
        throw new Error('Error al parse LLM response as JSON');
      }

      // Apply ultra-resilient validation
      console.log('🛡️ Applying ultra-resilient validation...');
      const validatedData = llmResponseSchema.parse(parsedResponse);

      console.log('✅ Validation successful!');
      console.log('📊 Final data:', {
        title: validatedData.title,
        ingredientsCount: validatedData.ingredients?.length || 0,
        instructionsCount: validatedData.instructions?.length || 0,
        imagesCount: validatedData.images?.length || 0
      });

      // Clean title by removing emojis
      const cleanedTitle = this.cleanRecipeTitle(validatedData.title || 'Receta de Video');
      const suggestions = mergeSuggestions(
        extractSuggestionsFromText(content),
        validatedData.suggestions
      );
      const suggestionKeys = new Set(
        (suggestions || '')
          .split(/\r?\n/)
          .map(suggestionKey)
          .filter(Boolean)
      );
      const instructions = (validatedData.instructions || [])
        .filter(inst => inst.description && typeof inst.step === 'number')
        .filter(inst => !suggestionKeys.has(suggestionKey(inst.description)))
        .map((inst, index) => ({ ...inst, step: index + 1 }));

      return {
        title: cleanedTitle,
        description: validatedData.description || '',
        suggestions,
        prepTime: validatedData.prepTime || 0,
        cookTime: validatedData.cookTime || 0,
        servings: validatedData.servings || 1,
        difficulty: validatedData.difficulty,
        recipeType: validatedData.recipeType,
        images: (validatedData.images || []).filter(img => img.url && typeof img.order === 'number') as any[],
        ingredients: (validatedData.ingredients || []).filter(ing => ing.name && ing.amount) as any[],
        instructions: instructions as any[],
        tags: validatedData.tags || []
      };

    } catch (error) {
      console.error('❌ Error in extractRecipeFromVideoContent:', error);
      throw error; // Re-throw to be handled by the calling method
    }
  }

  private buildVideoExtractionPrompt(content: string): string {
    // Limit content size for API limits
    const truncatedContent = content.length > 8000 ? content.substring(0, 8000) + '\n[Content truncated...]' : content;

    return `Extrae una receta de este contenido de video de cocina.

IMPORTANTE para imágenes:
- Si encuentras "Video Thumbnail:" seguido de una URL, inclúyela en el array de imágenes
- Las imágenes de thumbnails de videos son válidas para recetas
- Usa order: 1 para la imagen principal del thumbnail

IMPORTANTE para sugerencias:
- Extrae todos los tips, consejos, notas, recomendaciones, variantes y sugerencias de salsa.
- No los incluyas como pasos de preparación.
- Devuelve cada sugerencia en un elemento independiente del array "suggestions".

Si el contenido es limitado (solo título/descripción), crea una receta básica pero completa basándote en:
- El tipo de plato mencionado
- Ingredientes comunes para ese tipo de comida
- Pasos básicos de preparación típicos

Formato JSON requerido:
{
  "title": "Título exacto o inferido del plato",
  "description": "Descripción breve del plato",
  "suggestions": ["Primer tip o sugerencia", "Segunda recomendación"],
  "images": [
    {
      "url": "URL_del_thumbnail_si_está_disponible",
      "altText": "descripción de la imagen del video",
      "order": 1
    }
  ],
  "ingredients": [
    {"name": "ingrediente", "amount": "cantidad_o_al_gusto", "unit": "unidad_si_aplica"}
  ],
  "instructions": [
    {"step": 1, "description": "paso_de_preparación_detallado"}
  ],
  "prepTime": tiempo_estimado_en_minutos,
  "cookTime": tiempo_cocción_si_aplica,
  "servings": porciones_estimadas,
  "difficulty": "Fácil|Medio|Difícil",
  "recipeType": "tipo_de_receta",
  "tags": ["etiquetas_relevantes"]
}

Contenido del video:
${truncatedContent}`;
  }

  private async fetchWebContent(url: string): Promise<string> {
    console.log('🌐 Fetching content from:', url);

    // Cookpad-specific headers to bypass anti-bot measures
    const cookpadHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Cache-Control': 'max-age=0',
      'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'Referer': 'https://cookpad.com/',
      'Origin': 'https://cookpad.com'
    };

    const modernHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'DNT': '1',
      'Connection': 'keep-alive'
    };

    // Cookidoo-specific headers with additional auth-like headers
    const cookidooHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Cache-Control': 'max-age=0',
      'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'Referer': 'https://cookidoo.international/',
      'Origin': 'https://cookidoo.international'
    };

    // Use specific headers based on domain
    let headers;
    if (url.includes('cookpad.com')) {
      headers = cookpadHeaders;
    } else if (url.includes('cookidoo.international')) {
      headers = cookidooHeaders;
    } else {
      headers = modernHeaders;
    }

    try {
      console.log('🔄 Attempt 1: Site-specific headers with axios...');

      // Add delay for cookpad and other sites that might have rate limiting
      if (url.includes('cookpad.com')) {
        console.log('⏳ Adding delay for cookpad.com...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      const response = await axios({
        method: 'GET',
        url: url,
        headers: headers,
        timeout: 45000, // Increased from 30s to 45s (50% increase)
        maxRedirects: 5,
        responseType: 'text',
        validateStatus: (status) => status < 400,
        // Additional settings for specific sites
        withCredentials: false
      });

      console.log('✅ Axios request successful!');
      console.log('📊 Response info:', {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers['content-type'],
        contentLength: response.data.length
      });

      console.log('📏 Longitud del contenido:', response.data.length, 'characters');

      // Detect Cookidoo authentication issues
      if (url.includes('cookidoo.international') && this.isCookidooLoginPage(response.data)) {
        console.log('🔒 Cookidoo authentication required - content indicates login needed');
        throw new Error('Cookidoo requiere estar autenticado para acceder a esta receta. Por favor, abre la URL en tu navegador donde ya estés logueado y copia el contenido de la receta manualmente.');
      }

      return response.data;

    } catch (axiosError: any) {
      console.log('❌ Axios attempt failed:', axiosError.message);
      console.log('🔄 Attempt 2: Simplified headers with axios...');

      try {
        const simplifiedResponse = await axios({
          method: 'GET',
          url: url,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
          },
          timeout: 45000, // Increased from 30s to 45s (50% increase)
          maxRedirects: 5,
          responseType: 'text',
          validateStatus: (status) => status < 400
        });

        console.log('✅ Simplified axios successful!');
        console.log('📏 Longitud del contenido:', simplifiedResponse.data.length, 'characters');
        return simplifiedResponse.data;

      } catch (secondError: any) {
        console.log('❌ Second axios attempt also failed:', secondError.message);

        // Last attempt with basic fetch as fallback
        console.log('🔄 Attempt 3: Basic fetch fallback...');
        try {
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const content = await response.text();
          console.log('✅ Basic fetch successful!');
          console.log('📏 Longitud del contenido:', content.length, 'characters');
          return content;

        } catch (fetchError) {
          console.log('❌ Basic fetch also failed:', fetchError instanceof Error ? fetchError.message : 'Error desconocido');
          throw new Error(`Error al fetch content from URL after all attempts: ${axiosError.message}`);
        }
      }
    }
  }

  private async extractRecipeWithLLM(html: string, sourceUrl: string): Promise<RecipeImportResponse> {
    const prompt = this.buildExtractionPrompt(html, sourceUrl);

    console.log('\n=== 🤖 LLM REQUEST START ===');
    console.log('📍 Source URL:', sourceUrl);
    console.log('📝 HTML Content Length:', html.length, 'characters');
    console.log('🎯 Model:', getModel());
    console.log('🌡️ Temperature:', 0.1);
    console.log('📄 Max Tokens:', 4000);
    console.log('\n📋 SYSTEM PROMPT:');
    console.log('---');
    console.log(`Eres un extractor de recetas de cocina. Tu trabajo es encontrar y extraer recetas de páginas web.

BUSCA cualquier contenido que contenga:
- Lista de ingredientes + instrucciones de preparación
- Cantidades + ingredientes + pasos de cocina
- Cualquier información culinaria estructurada

EXTRAE los datos EXACTAMENTE como aparecen:
- Cantidades: tal como están escritas ("200g", "1 taza", "un poquito")
- Ingredientes: nombres completos, no omitas ninguno
- Instrucciones: copia el texto exacto
- Tiempos y porciones: valores exactos mencionados
- Sugerencias: extrae todos los tips, consejos, notas, trucos, recomendaciones o variantes que pertenezcan a la receta
- No mezcles las sugerencias con las instrucciones de preparación

IMÁGENES: Busca hasta 3 URLs de imágenes de comida

Si hay CUALQUIER indicio de receta (ingredientes + preparación), extráela.
Solo responde {"error": true} si definitivamente no hay ninguna receta en la página.`);
    console.log('\n📝 USER PROMPT (first 500 chars):');
    console.log('---');
    console.log(prompt.substring(0, 500) + (prompt.length > 500 ? '...[truncated]' : ''));
    console.log('\n🚀 Enviando solicitud a OpenAI...');

    let parsedResponse: any;
    let responseContent: string | undefined;
    try {
      // El LLM ocasionalmente devuelve JSON inválido o respuesta vacía (error transitorio).
      // Reintentamos hasta 3 veces antes de fallar.
      const maxAttempts = 3;
      let parseErr: any;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
       try {
      const completion = await this.openai.chat.completions.create({
        model: getModel(),
        messages: [
          {
            role: 'system',
            content: `Eres un extractor de recetas de cocina. Responde directamente sin razonamiento extenso. Tu trabajo es encontrar y extraer recetas de páginas web.

BUSCA cualquier contenido que contenga:
- Lista de ingredientes + instrucciones de preparación
- Cantidades + ingredientes + pasos de cocina
- Cualquier información culinaria estructurada

EXTRAE los datos EXACTAMENTE como aparecen:
- Cantidades: tal como están escritas ("200g", "1 taza", "un poquito")
- Ingredientes: nombres completos, no omitas ninguno
- Instrucciones: copia el texto exacto
- Tiempos y porciones: valores exactos mencionados

⚠️ INSTRUCCIONES - REGLAS CRÍTICAS:
- Si ves pasos numerados (1., 2., 3...) incluye TODOS sin excepción
- Si ves bullets o guiones (-, *, •) incluye TODOS los puntos
- Si hay párrafos largos, divídelos en pasos lógicos
- NUNCA generes comentarios como "instrucciones no visibles" o "preparación típica basada en..."
- SOLO incluye pasos de cocina reales: "Mezclar", "Hornear", "Añadir", etc.
- 🚫 NUNCA inventes pasos: si no hay instrucciones visibles en el contenido, devuelve "instructions": [] (vacío). Es preferible vacío a inventado.
- Cada step debe ser una acción concreta de cocina presente en el texto

IMÁGENES: Busca hasta 3 URLs de imágenes de comida

Si hay CUALQUIER indicio de receta (ingredientes + preparación), extráela.
Solo responde {"error": true} si definitivamente no hay ninguna receta en la página.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        max_completion_tokens: 4000
      });

      console.log('\n✅ LLM RESPONSE RECEIVED');
      console.log('💰 Usage:', completion.usage);

      responseContent = completion.choices[0]?.message?.content || undefined;

      console.log('\n📋 RAW LLM RESPONSE:');
      console.log('---');
      console.log(responseContent);
      console.log('\n=== 🤖 LLM REQUEST END ===\n');
      if (!responseContent) {
        throw new Error('Respuesta vacía de LLM');
      }

      // Parse and validate response
      console.log('🔄 Parsing JSON response...');
      parsedResponse = parseLlmJson(responseContent);
      parseErr = undefined;
      break; // parseo OK → salir del bucle de reintentos
       } catch (attemptError) {
         // Reintentar ante respuesta vacía / JSON inválido / error transitorio de la API.
         parseErr = attemptError;
         console.log(`⚠️ Respuesta inválida del LLM (intento ${attempt}/${maxAttempts}): ${attemptError instanceof Error ? attemptError.message : attemptError}`);
       }
      } // fin bucle de reintentos
      if (parseErr || !parsedResponse) {
        throw new SyntaxError('Formato de respuesta inválido de LLM tras varios intentos');
      }

      console.log('🔍 Parsed response keys:', Object.keys(parsedResponse));

      // Check for error flag
      if (parsedResponse.error) {
        console.log('❌ LLM returned error flag - no recipe found');
        throw new Error('No valid recipe found on this page');
      }

      console.log('✅ No error flag detected, proceeding with validation...');

      // Validate with schema
      console.log('🛡️ Validating response with Zod schema...');
      const validatedData = llmResponseSchema.parse(parsedResponse);
      console.log('✅ Schema validation passed successfully');

      console.log('📊 Extracted recipe summary:');
      console.log('  - Title:', validatedData.title);
      console.log('  - Cantidad de ingredientes:', validatedData.ingredients.length);
      console.log('  - Cantidad de instrucciones:', validatedData.instructions.length);
      console.log('  - Cantidad de imágenes:', validatedData.images.length);
      console.log('  - Tiempo de preparación:', validatedData.prepTime, 'minutos');
      console.log('  - Porciones:', validatedData.servings);
      console.log('  - Dificultad:', validatedData.difficulty);

      // Log sections
      const ingredientsWithSection = validatedData.ingredients.filter(ing => ing.section);
      const instructionsWithSection = validatedData.instructions.filter(inst => inst.section);
      console.log('📦 SECCIONES DETECTADAS:');
      console.log('  - Ingredientes con sección:', ingredientsWithSection.length, '/', validatedData.ingredients.length);
      console.log('  - Instrucciones con sección:', instructionsWithSection.length, '/', validatedData.instructions.length);
      if (ingredientsWithSection.length > 0) {
        const ingredientSections = [...new Set(ingredientsWithSection.map(ing => ing.section))];
        console.log('  - Secciones de ingredientes:', ingredientSections);
      }
      if (instructionsWithSection.length > 0) {
        const instructionSections = [...new Set(instructionsWithSection.map(inst => inst.section))];
        console.log('  - Secciones de instrucciones:', instructionSections);
      }

      // Guarda anti-alucinación para Cookidoo: su página pública NO trae los pasos
      // (están detrás de login). Si no llegaron pasos reales, NO devolvemos inventados:
      // damos un error accionable que guía al usuario a usar la extensión ya logueado.
      const isCookidooSource = sourceUrl?.includes('cookidoo') || false;
      const placeholderDescriptions = ['preparar según la receta original', 'paso de preparación', 'seguir las instrucciones'];
      const realInstructions = validatedData.instructions.filter(inst =>
        inst.description &&
        !placeholderDescriptions.some(p => inst.description.toLowerCase().startsWith(p))
      );
      if (isCookidooSource && realInstructions.length === 0) {
        throw new Error('Esta receta de Cookidoo no incluye los pasos de preparación en su página pública (requieren login/suscripción). Para importarla con la preparación completa: abrí la receta en Cookidoo ya logueado y usá el botón de la extensión TasteBox, que lee la página tal como la ves.');
      }

      // Clean title to remove emojis
      const cleanTitle = this.cleanRecipeTitle(validatedData.title);

      // Imágenes: lo que devolvió el LLM + fallback robusto desde el HTML (og:image /
      // JSON-LD), por si el modelo no las incluyó. Así nunca quedamos sin imagen.
      let images = this.deduplicateImages(validatedData.images || []).filter(img => img.url && img.url.trim() !== '');
      if (images.length === 0) {
        const fallback = extractImageUrls(html);
        if (fallback.length > 0) {
          console.log(`🖼️ LLM no devolvió imágenes; usando ${fallback.length} del HTML (og:image/JSON-LD)`);
          images = fallback.map((url, i) => ({ url, altText: cleanTitle, order: i + 1 })) as any[];
        }
      }

      // Nutrición exacta de Cookidoo (si está en el HTML). Para otros sitios queda
      // undefined y la app la calcula con IA bajo demanda como hasta ahora.
      const nutrition = extractCookidooNutrition(html) || undefined;
      if (nutrition) {
        console.log('🥗 Nutrición Cookidoo extraída:', nutrition);
      }

      // Es receta Thermomix si viene de Cookidoo o si algún paso tiene una configuración
      // EXCLUSIVA de Thermomix: velocidad (vel/Mariposa/Turbo) o temperatura Varoma.
      // OJO: time/temperature/function NO sirven como señal porque cualquier receta común
      // tiene tiempos de cocción y temperaturas de horno (ej. "180°C por 30 min").
      const isCookidooRecipe = /cookidoo/i.test(sourceUrl || '');
      const hasThermomixEvidence = validatedData.instructions.some(instruction => {
        const evidence = [
          instruction.description,
          instruction.function,
          instruction.speed,
          instruction.temperature
        ].filter(Boolean).join(' ');

        return /\b(?:thermomix|tm[3567]\b|varoma|giro inverso|vel(?:ocidad)?\s*(?:cuchara|\d+)|mariposa|turbo)\b/i.test(evidence);
      });
      const thermomix = isCookidooRecipe || hasThermomixEvidence;
      const instructions = thermomix
        ? validatedData.instructions
        : validatedData.instructions.map(instruction => ({
            ...instruction,
            function: undefined,
            time: undefined,
            temperature: undefined,
            speed: undefined
          }));

      // País (Cookidoo: componente <rdp-country>) e idioma (JSON-LD inLanguage).
      const countryMatch = html.match(/rdp-country__country"[^>]*>\s*([^<]+?)\s*</i);
      const country = countryMatch ? cleanHtmlFromText(countryMatch[1]) : undefined;
      // Idioma: 1) atributo <html lang>, 2) JSON-LD inLanguage, 3) <meta og:locale>.
      const langDeclared =
        html.match(/<html[^>]*\blang=["']([^"']+)["']/i)?.[1]
        || html.match(/"inLanguage"\s*:\s*"([^"]+)"/i)?.[1]
        || html.match(/property=["']og:locale["'][^>]*content=["']([^"']+)["']/i)?.[1];
      let language: string | undefined;
      if (langDeclared) {
        const l = langDeclared.toLowerCase();
        if (l.startsWith('es')) language = 'Español';
        else if (l.startsWith('en')) language = 'Inglés';
      }
      // Si la página no declara un idioma reconocido, lo detectamos del contenido de la
      // receta (salida del LLM) + una muestra del texto crudo de la página (idioma original).
      if (!language) {
        const rawSample = cleanHtmlFromText(html.slice(0, 12000));
        language = detectRecipeLanguage([
          cleanTitle,
          validatedData.description,
          ...validatedData.ingredients.map(i => i.name),
          ...validatedData.instructions.map(s => s.description),
          rawSample,
        ].filter(Boolean).join(' '));
      }
      console.log('🌐 Idioma detectado:', language, '(declarado:', langDeclared || 'no', ')');

      // Sin gluten: por las etiquetas extraídas o por las keywords de la página.
      const keywordsStr = html.match(/"keywords"\s*:\s*"([^"]*)"/i)?.[1] || '';
      const glutenFree = validatedData.tags.some(t => /sin gluten|gluten[\s-]?free|libre de gluten/i.test(t))
        || /sin gluten|gluten[\s-]?free|libre de gluten/i.test(keywordsStr);

      // Keto / cetogénica: por etiquetas o keywords.
      const keto = validatedData.tags.some(t => /keto|cetog[eé]nic/i.test(t))
        || /keto|cetog[eé]nic/i.test(keywordsStr);

      // Saludable (campo lowCarb): low carb / bajo en carbohidratos, o baja en calorías.
      const healthyRegex = /low[\s-]?carb|bajo en carbo|low[\s-]?cal(?:orie)?s?|baj[ao] en cal(?:or[ií]as)?|hipocal[oó]ric[ao]/i;
      const healthyEvidence = [
        cleanTitle,
        validatedData.description,
        ...validatedData.tags,
        keywordsStr
      ].filter(Boolean).join(' ');
      const lowCarb = healthyRegex.test(healthyEvidence);

      const vegetarian = validatedData.tags.some(t => /vegetarian[ao]?/i.test(t))
        || /vegetarian[ao]?/i.test(keywordsStr);

      const airFryerEvidence = [
        cleanTitle,
        validatedData.description,
        ...validatedData.instructions.map(instruction => instruction.description),
        ...validatedData.tags,
        keywordsStr
      ].filter(Boolean).join(' ');
      const airFryer = /\b(?:freidora\s+de\s+aire|freidora\s+sin\s+aceite|air[\s-]?fryer)\b/i.test(airFryerEvidence);

      const ingredients = isCookidooSource
        ? mergeCookidooAlternativeIngredients(
            mergeCookidooIngredientDescriptions(
              validatedData.ingredients.filter(ing => ing.name && ing.amount) as ExtractedIngredient[],
              html
            ),
            html
          )
        : validatedData.ingredients.filter(ing => ing.name && ing.amount);
      const suggestions = mergeSuggestions(
        extractSuggestionsFromHtml(html),
        validatedData.suggestions
      );
      const cookidooSummary = isCookidooSource
        ? normalizeCookidooSummary(
            validatedData.description,
            validatedData.prepTime,
            validatedData.cookTime,
            cleanTitle
          )
        : {
            description: validatedData.description,
            cookTime: validatedData.cookTime,
          };

      // Transform to our interface
      return {
        title: cleanTitle,
        description: cookidooSummary.description,
        suggestions,
        images: images as any[],
        ingredients: ingredients.map((ing, index) => ({
          ...ing,
          order: index + 1
        })) as any[],
        instructions: instructions.filter(inst => inst.description && typeof inst.step === 'number').sort((a, b) => a.step - b.step) as any[],
        prepTime: validatedData.prepTime,
        cookTime: cookidooSummary.cookTime,
        servings: validatedData.servings,
        difficulty: validatedData.difficulty,
        recipeType: validatedData.recipeType,
        country,
        language,
        tags: validatedData.tags,
        thermomix,
        airFryer,
        glutenFree,
        keto,
        lowCarb,
        vegetarian,
        nutrition
      };
    } catch (error: any) {
      console.log('\n❌ ERROR IN LLM PROCESSING');
      console.log('Error type:', error.constructor.name);
      console.log('Error message:', error.message);

      if (error instanceof z.ZodError) {
        console.error('🛡️ Zod validation errors:');
        error.errors.forEach((err, index) => {
          console.error(`  ${index + 1}. Path: ${err.path.join('.')} - ${err.message}`);
        });
        console.error('📋 Raw parsed response that failed validation:');
        console.error(JSON.stringify(parsedResponse || 'undefined', null, 2));
        throw new Error('Datos de receta inválidos data extracted from page');
      }

      if (error instanceof SyntaxError) {
        console.error('🔧 JSON parse error details:', error.message);
        console.error('📋 Raw response that failed to parse:');
        console.error(responseContent);
        throw new Error('Formato de respuesta inválido de LLM');
      }

      console.error('🚨 Error inesperado:', error);
      throw error;
    }
  }

  private buildExtractionPrompt(html: string, sourceUrl?: string): string {
    // 1) Datos estructurados JSON-LD (fuente más fiable: ingredientes/pasos EXACTOS).
    //    Se ponen al inicio y NUNCA se truncan, así siempre llegan completos al modelo.
    const jsonLd = extractRecipeJsonLd(html);

    // 2) HTML convertido a texto legible (sin scripts/estilos/head) para que el
    //    presupuesto de caracteres se gaste en contenido real y no en markup ruidoso.
    const readable = htmlToReadableText(html);

    // Truncar el TEXTO (no el HTML crudo): así caben muchísimos más pasos reales.
    const maxTextLength = 24000;
    const truncatedHtml = readable.length > maxTextLength
      ? readable.substring(0, maxTextLength) + '...[truncado]'
      : readable;

    const structuredBlock = jsonLd
      ? `\n🟢 DATOS ESTRUCTURADOS (JSON-LD schema.org/Recipe) — FUENTE PRIORITARIA Y FIABLE.
Usa ESTO como verdad para la LISTA de ingredientes (cuáles y cuántos) y para las instrucciones. Transcribe los pasos EXACTAMENTE como aparecen aquí.
⚠️ IMPORTANTE: el JSON-LD a veces lista el ingrediente SIN su forma de preparación (ej: "1 Taza Zanahorias"), pero el cuerpo de la página de abajo SÍ la incluye (ej: "1 Taza Zanahorias Rallada"). En esos casos COMPLETA cada ingrediente con su corte/estado tomándolo del cuerpo de la página: "cortada en cubos", "rallada", "cortada finamente", "en rodajas", etc. NO descartes ese detalle. Empareja cada ingrediente del JSON-LD con su línea correspondiente en la página para enriquecerlo.
También usa el contenido de la página de abajo para completar datos que falten (imágenes, secciones).
${jsonLd}\n`
      : '';

    // 3) Imágenes: la conversión a texto borra los <img>, así que las extraemos aparte
    //    (og:image + JSON-LD) y se las damos explícitas al modelo para el array images.
    const imageUrls = extractImageUrls(html);
    const imagesBlock = imageUrls.length
      ? `\n🖼️ IMÁGENES DE LA RECETA — incluí estas URLs EXACTAS en el array "images" (order 1,2,3):
${imageUrls.map((u, i) => `${i + 1}. ${u}`).join('\n')}\n`
      : '';

    // Check if this is a Cookidoo recipe
    const isCookidoo = sourceUrl?.includes('cookidoo.international') || false;

    return `Analiza esta página web y busca CUALQUIER contenido relacionado con recetas de cocina.

🔍 SÉ MUY FLEXIBLE EN LA DETECCIÓN - BUSCA:
- Listas de ingredientes (formales o informales)
- Instrucciones de preparación (paso a paso o párrafos)
- Recetas en blogs, comentarios, descripciones de videos
- Menciones de cantidades + ingredientes + preparación
- Cualquier contenido culinario que pueda ser una receta

🚨 PERO SÉ PRECISO EN LA EXTRACCIÓN - NO MODIFIQUES NADA:
- CANTIDADES: Extrae EXACTAMENTE ("300g", "1 cdta", "2 tazas", "un puñado")
  * Si NO hay cantidad específica (ej: "sal", "aceite"), usa string VACÍO "" en amount
  * ⚠️ CRÍTICO: Si la cantidad YA incluye unidad (ej: "40g"), NO dupliques en unit
  * Formato correcto: {"name": "mantequilla", "amount": "40", "unit": "g"}
  * Formato INCORRECTO: {"amount": "40 g", "unit": "g"} → resultaría en "40 g g"
- INGREDIENTES: Nombres COMPLETOS y EXACTOS, no omitas ninguno. Copia el ingrediente TAL CUAL
  aparece en la página.
  * ⚠️ CONSERVA SIEMPRE la forma/estado de preparación que acompaña al ingrediente dentro de "name":
    "cortado en cubos", "picado", "rallado", "en rodajas", "en juliana", "fileteado", "molido",
    "tamizado", "a temperatura ambiente", "sin piel", "desmenuzado", "blando", "frío", "en trozos", etc.
  * NUNCA elimines ni resumas esos detalles: forman parte del nombre del ingrediente.
  * Ejemplos correctos:
    - "2 dientes de ajo picados" → {"name": "dientes de ajo picados", "amount": "2", "unit": ""}
    - "200 g de queso rallado" → {"name": "queso rallado", "amount": "200", "unit": "g"}
    - "1 cebolla cortada en cubos" → {"name": "cebolla cortada en cubos", "amount": "1", "unit": ""}
    - "100 g de manteca a temperatura ambiente" → {"name": "manteca a temperatura ambiente", "amount": "100", "unit": "g"}
  * Ejemplo INCORRECTO (NO hagas esto): "1 cebolla cortada en cubos" → {"name": "cebolla", ...} (perdiste "cortada en cubos")
- INSTRUCCIONES: Transcribe SIN MODIFICAR, mantén el texto original, LIMPIA tags HTML
- TIEMPOS/PORCIONES: Valores EXACTOS o estimaciones mencionadas

🔢 INSTRUCCIONES - CAPTURA TODOS LOS PASOS COMPLETOS:
- Si hay secuencia numerada (1., 2., 3...) incluye TODOS los números sin saltar
- Si hay viñetas/bullets (-, *, •) incluye TODOS los puntos
- Si un paso tiene sub-pasos o detalles, inclúyelos completos
- Verifica que no falten pasos en la secuencia (ej: si ves 1,2,4 busca el 3)
- Mantén orden exacto y numeración como aparece

💡 SUGERENCIAS/TIPS - CAPTURA TODOS LOS ITEMS:
- Extrae TODOS los tips, consejos, notas, trucos, recomendaciones y variantes que pertenezcan a la receta.
- Incluye CADA item por separado, sin importar cómo esté marcado: viñetas/bullets (•, -, *),
  números (1., 2.), guiones, o párrafos con asterisco (*). Un encabezado tipo "Tip", "Consejos",
  "Notas" suele agrupar VARIOS items: captúralos TODOS, no solo el primero o el último.
- Coloca cada uno como un elemento independiente del array "suggestions" (NO los unifiques en uno solo).
- Transcribe el texto tal cual; quita únicamente el marcador inicial (•, -, *, número).
- NO mezcles las sugerencias con las instrucciones de preparación.

${isCookidoo ? `
🚨 COOKIDOO/THERMOMIX ESPECIAL:
Esta es una receta de Cookidoo.international (Thermomix). EXTRACCIÓN MEJORADA:

1. PORCIONES - EXTRACCIÓN PRECISA:
   - Busca números antes de: "personas", "porciones", "raciones", "comensales", "servings"
   - Si dice "4-6 personas" → usa el número MAYOR: 6
   - Si dice "rinde 8 porciones" → usa 8
   - Busca iconos de personas (👥, 🍽️) con números cerca
   - Formato JSON: "servings": 8 (número entero)

2. INSTRUCCIONES - SOLO TRANSCRIBE LO QUE ESTÉ EN EL CONTENIDO:
   - 🚫 PROHIBIDO INVENTAR: las páginas públicas de Cookidoo NO incluyen los pasos
     de preparación (están detrás de login/suscripción).
   - Si NO encuentras pasos de preparación reales en el contenido, devuelve
     "instructions": [] (array VACÍO). NO los generes de memoria ni los deduzcas
     de los ingredientes. Es preferible vacío a inventado.

3. CONFIGURACIONES THERMOMIX (NUEVO - MUY IMPORTANTE):
   Cada paso puede tener hasta 4 datos Thermomix. Busca en el TEXTO del paso:

   a) FUNCIÓN: Palabras clave como:
      - Amasar, Batir, Picar, Mezclar, Triturar, Cocinar, Calentar
      - Emulsionar, Moler, Sofreír, Cocer, etc.
      - Formato: "function": "Amasar"

   b) TIEMPO: Patrones como:
      - "2 min", "30 seg", "5 segundos", "1 minuto"
      - Formato: "time": "2 min" o "time": "30 sec"

   c) TEMPERATURA: Busca:
      - Números + "°C", "grados", o palabra "Varoma"
      - Formato: "temperature": "80°C" o "temperature": "Varoma"

   d) VELOCIDAD: Busca:
      - "vel 1-10", "velocidad 5", "v.10", "Mariposa", "Turbo"
      - Formato: "speed": "5" o "speed": "Mariposa"

   Ejemplo de paso Thermomix:
   Texto: "Amasar 2 min / 90°C / vel 3"
   JSON: {
     "step": 1,
     "description": "Amasar 2 min / 90°C / vel 3",
     "function": "Amasar",
     "time": "2 min",
     "temperature": "90°C",
     "speed": "3"
   }

4. SECCIONES - SOLO SI EXISTEN DE VERDAD (NO INVENTAR):
   🚫 NO agrupes los ingredientes en secciones salvo que el contenido tenga subtítulos
      EXPLÍCITOS que separen la LISTA DE INGREDIENTES (ej. un encabezado "Para la masa" justo
      encima de un subconjunto de ingredientes).
   🚫 NUNCA deduzcas las secciones a partir de los pasos de preparación ni del tipo de receta.
   - Si la lista de ingredientes aparece plana (sin esos subtítulos), deja "section": null en
     TODOS los ingredientes. Repórtalos en el MISMO ORDEN en que aparecen, tal cual.
   - Para las instrucciones, usa "section" SOLO si los pasos vienen agrupados bajo títulos
     explícitos en el origen; si no, "section": null.

5. TAGS - SOLO 3-4 RELEVANTES:
   - Ingrediente principal (ej: "pollo", "chocolate")
   - Tipo de plato (ej: "postre", "entrada")
   - Característica especial (ej: "sin gluten", "vegano")
   - NO incluyas nombres de recetas similares
   - Máximo 4 tags

6. INGREDIENTES ALTERNATIVOS:
   - La clase "recipe-ingredient__alternative" indica un reemplazo, no otro
     ingrediente acumulativo.
   - Devuelve ambas opciones como un solo ingrediente unido con "o", conservando
     las dos cantidades.
   - Ejemplo: "10 g de levadura fresca" y "5 g de levadura seca" deben quedar
     como una sola fila: "10 g de levadura fresca o 5 g de levadura seca".

7. ACLARACIONES DE INGREDIENTES:
   - La clase "recipe-ingredient__description" es una aclaración del ingrediente
     inmediatamente anterior, NO es un ingrediente nuevo.
   - Agrégala al final del nombre del mismo ingrediente.
   - Ejemplo: "150 g de cebolla" + "en cuartos" debe quedar como una sola fila:
     amount "150", unit "g", name "cebolla, en cuartos".
` : ''}

⭐ IMÁGENES: Busca hasta 3 URLs de imágenes de comida/cocina.

📦 SECCIONES (si aplica):
- Usa "section" SOLO si el origen tiene subtítulos EXPLÍCITOS que agrupan los ingredientes/pasos.
- 🚫 NO inventes secciones ni las deduzcas de los pasos. Si la lista es plana, "section": null en todos
  y manténlos en su orden original.

⚠️ INSTRUCCIONES - MUY IMPORTANTE:
1. **EXTRAE TODOS LOS PASOS NUMERADOS** - Si hay 11 pasos numerados, debes devolver exactamente 11 pasos
2. **PARSEA CONFIGURACIONES THERMOMIX DEL TEXTO**:
   - Si ves "15 seg/vel 10" → time: "15 seg", speed: "vel 10"
   - Si ves "5 min/100°" → time: "5 min", temperature: "100°"
   - Si ves "2 min/80°/vel 3" → time: "2 min", temperature: "80°", speed: "vel 3"
   - "giro inverso" y "vel cuchara" SON parte de la velocidad: inclúyelos TAL CUAL en speed.
     Ej: "5 min/120°C/giro inverso/vel cuchara" → time: "5 min", temperature: "120°C", speed: "giro inverso vel cuchara"
   - Si NO encuentras configuraciones, deja los campos como null
   - NO es obligatorio que todos los pasos tengan configuraciones Thermomix
3. **MANTÉN LAS CONFIGURACIONES DENTRO DE LA DESCRIPCIÓN** (MUY IMPORTANTE):
   - Las configuraciones Thermomix (tiempos/velocidades/temperaturas, ej. "20 seg/vel 5",
     "5 min/120°C/giro inverso/vel cuchara") deben quedar DENTRO de la descripción, EN EL MISMO
     LUGAR donde aparecen en el original. NO las borres ni las muevas al final.
   - Además, copia esos mismos valores en los campos time/temperature/speed (para clasificación interna).
   - Ejemplo: description "Coloque la harina y mezcle 20 seg/vel 5. Reserve." (texto IGUAL al original),
     y además time: "20 seg", speed: "vel 5".

Extrae en formato JSON exacto:
{
  "title": "Título EXACTO de la receta tal como aparece",
  "description": "Descripción tal como está escrita (máximo 200 caracteres)",
  "suggestions": ["Primer tip o consejo exacto", "Segunda nota o recomendación"],
  "images": [
    {
      "url": "URL_completa_absoluta_de_imagen",
      "altText": "descripción de la imagen",
      "order": 1
    }
  ],
  "ingredients": [
    {"name": "nombre", "amount": "cantidad", "unit": "unidad", "section": "Componente 1"},
    {"name": "nombre", "amount": "cantidad", "unit": "", "section": null}
  ],
  "instructions": [
    {
      "step": 1,
      "description": "Colocar ingredientes en el vaso (sin configuraciones Thermomix en el texto)",
      "function": "Picar",
      "time": "15 seg",
      "temperature": null,
      "speed": "vel 10",
      "section": "Componente 1"
    },
    {
      "step": 2,
      "description": "Otro paso (texto limpio sin configuraciones)",
      "function": null,
      "time": "2 min",
      "temperature": "100°",
      "speed": null,
      "section": null
    }
    // ⚠️ IMPORTANTE: Si el HTML tiene 11 pasos, JSON debe tener 11 pasos
  ],
  "prepTime": tiempo_en_minutos_exacto,
  "cookTime": tiempo_cocción_en_minutos_si_existe,
  "servings": número_exacto_porciones,
  "difficulty": "Fácil|Medio|Difícil" SOLO si la receta lo indica explícitamente; si no, null (NO inventes),
  "recipeType": "tipo_de_receta_si_se_menciona",
  "tags": ["etiquetas_relevantes_basadas_en_contenido"]
}

❌ NO HAGAS:
- No cambies "200g" por "200 gramos"
- No omitas ingredientes
- No modifiques cantidades
- No agregues información que no está
- No conviertas unidades de medida
- **NO OMITAS PASOS DE INSTRUCCIONES** - Cuenta cuántos pasos numerados hay en el HTML y devuelve exactamente ese número

✅ ANTES DE RESPONDER:
1. Cuenta los pasos numerados en la sección de instrucciones del HTML
2. Verifica que tu JSON tenga exactamente ese número de pasos
3. Busca patrones como "X min/Y°/vel Z" en cada paso y extrae las configuraciones

${structuredBlock}${imagesBlock}
Contenido de la página (texto):
${truncatedHtml}`;
  }

  // For compatibility with existing code
  async extractRecipeFromHtml(
    html: string,
    sourceUrl: string,
    renderedText?: string
  ): Promise<RecipeImportResponse> {
    const renderedHtml = renderedTextToHtml(renderedText);
    const combinedHtml = renderedHtml ? `${html}\n${renderedHtml}` : html;
    return this.extractRecipeWithLLM(combinedHtml, sourceUrl);
  }

  /**
   * Elimina emojis de un texto
   */
  private removeEmojis(text: string): string {
    // Regex que detecta la mayoría de emojis Unicode
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F018}-\u{1F270}]|[\u{238C}]|[\u{2194}-\u{2199}]|[\u{21A9}-\u{21AA}]|[\u{231A}]|[\u{231B}]|[\u{23E9}-\u{23F3}]|[\u{25FD}-\u{25FE}]|[\u{2614}]|[\u{2615}]|[\u{2648}-\u{2653}]|[\u{267F}]|[\u{2693}]|[\u{26A1}]|[\u{26AA}]|[\u{26AB}]|[\u{26BD}]|[\u{26BE}]|[\u{26C4}]|[\u{26C5}]|[\u{26CE}]|[\u{26D4}]|[\u{26EA}]|[\u{26F2}]|[\u{26F3}]|[\u{26F5}]|[\u{26FA}]|[\u{26FD}]|[\u{2705}]|[\u{270A}]|[\u{270B}]|[\u{2728}]|[\u{274C}]|[\u{274E}]|[\u{2753}-\u{2755}]|[\u{2757}]|[\u{2795}-\u{2797}]|[\u{27B0}]|[\u{27BF}]|[\u{2B1B}]|[\u{2B1C}]|[\u{2B50}]|[\u{2B55}]/gu;
    return text.replace(emojiRegex, '').trim();
  }

  /**
   * Limpia un título de receta eliminando emojis y espacios extra
   */
  private cleanRecipeTitle(title: string): string {
    return this.removeEmojis(title).replace(/\s+/g, ' ').trim();
  }

  /**
   * Extract multiple recipes from PDF pages using GPT-4o-mini multimodal (for PDF processing)
   */
  async extractMultipleRecipesFromPdfPages(pages: { pageNum: number; imageBase64: string; text?: string }[]): Promise<{ success: boolean; recipes: any[]; error?: string }> {
    try {
      console.log('🤖 Enviando PDF pages to GPT-4o-mini for multimodal recipe extraction...');
      console.log(`📄 Processing ${pages.length} PDF pages`);

      const prompt = `
Analiza estas páginas de un documento PDF que contiene recetas de cocina.

IMPORTANTE - Busca y extrae información tanto VISUAL como TEXTUAL:

🔍 ELEMENTOS VISUALES A DETECTAR:
- ICONOS de reloj/tiempo (⏰) para tiempos de preparación y cocción
- ICONOS de personas/cubiertos (👥🍽️) para número de porciones
- ICONOS de dificultad (⭐) o nivel de habilidad
- IMÁGENES DE RECETAS: Fotos de platos terminados, ingredientes, pasos (NO incluir páginas completas)
- LAYOUT y disposición visual para entender estructura de recetas

🖼️ IMPORTANTE PARA IMÁGENES:
- Si detectas UNA FOTO CLARA del plato terminado, marca hasImage: true
- Si solo ves texto/página completa sin foto del plato, marca hasImage: false
- NO uses thumbnails de páginas completas como imágenes de recetas

📝 ELEMENTOS TEXTUALES A EXTRAER:
- Títulos de recetas
- Listas de ingredientes con cantidades exactas
- Instrucciones paso a paso
- Metadatos (categoría, tipo de plato, etc.)

⚠️ REGLAS IMPORTANTES:
- NO inventes tiempos/porciones si no ves iconos o texto específico
- Si detectas iconos visuales, úsalos para extraer datos precisos
- Incluye referencias a imágenes si las detectas
- Detecta correctamente dónde termina una receta y empieza otra
- Usa la disposición visual para entender la estructura

🎯 CLASIFICACIÓN AUTOMÁTICA:
- DIFFICULTY: Analiza complejidad de ingredientes e instrucciones ("Fácil", "Medio", "Difícil")
- RECIPE_TYPE: Clasifica por tipo de plato ("postre", "plato principal", "entrada", "bebida", "snack", "acompañamiento", "salsa")
- TAGS: Genera 3-4 etiquetas relevantes basadas en ingredientes principales, técnica de cocción, dieta especial, etc.

Responde SOLO con un JSON válido con este formato exacto:
{
  "recipes": [
    {
      "title": "Título exacto de la receta",
      "description": "Descripción incluyendo referencias a imágenes detectadas",
      "prepTime": 30,
      "cookTime": 45,
      "servings": 4,
      "hasImage": true,
      "imageUrl": "recipe_photo_detected", // Si detectas foto del plato, usa este valor
      "difficulty": "Fácil",
      "recipeType": "postre",
      "tags": ["chocolate", "sin gluten", "vegano", "navidad"],
      "ingredients": [
        {"name": "naranja en rodajas para decorar", "amount": "1", "unit": ""},
        {"name": "edulcorante de fruta del monje", "amount": "140-155", "unit": "gramos"}
      ],
      "instructions": [
        {"step": 1, "description": "Paso 1 de la preparación"},
        {"step": 2, "description": "Paso 2 de la preparación"}
      ],
      "pageNumbers": [1, 2]
    }
  ]
}
`;

      // Build multimodal messages with page images
      const messages: any[] = [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt
            },
            ...pages.map(page => ({
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${page.imageBase64}`,
                detail: 'high'
              }
            }))
          ]
        }
      ];

      console.log(`🖼️ Enviando ${pages.length} page images to GPT-4o-mini for multimodal analysis`);

      const response = await this.openai.chat.completions.create({
        model: getVisionModel(),
        messages,
        max_completion_tokens: 8000,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content?.trim();
      if (!content) {
        throw new Error('Respuesta vacía de GPT-4o-mini');
      }

      console.log('🤖 GPT-4o-mini Response received, parsing JSON...');

      // Parse the JSON response
      let jsonResponse;
      try {
        // Try to extract JSON if wrapped in markdown or other formatting
        const jsonMatch = content.match(/```json\n(.*)\n```/s) ||
                         content.match(/```\n(.*)\n```/s) ||
                         content.match(/\{[\s\S]*\}/);
        const jsonString = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
        jsonResponse = parseLlmJson(jsonString);
      } catch (parseError) {
        console.error('❌ Error al parse GPT-5-mini JSON response:', parseError);
        console.log('Raw response sample:', content.substring(0, 500));
        throw new Error('JSON inválido respuesta de GPT-5-mini');
      }

      if (!jsonResponse.recipes || !Array.isArray(jsonResponse.recipes)) {
        throw new Error('GPT-5-mini response does not contain recipes array');
      }

      console.log(`✅ Successfully extracted ${jsonResponse.recipes.length} recipes from PDF pages`);
      jsonResponse.recipes.forEach((recipe: any, index: number) => {
        console.log(`  ${index + 1}. "${recipe.title}" (${recipe.ingredients?.length || 0} ingredients, ${recipe.instructions?.length || 0} steps, hasImage: ${recipe.hasImage})`);
      });

      return {
        success: true,
        recipes: jsonResponse.recipes
      };

    } catch (error: any) {
      console.error('❌ Error in GPT-5-mini PDF recipe extraction:', error);
      return {
        success: false,
        recipes: [],
        error: error.message
      };
    }
  }

  /**
   * Extract multiple recipes from a document text (for DOCX processing)
   */
  async extractMultipleRecipesFromDocument(documentText: string): Promise<{ success: boolean; recipes: any[]; error?: string }> {
    try {
      console.log('🤖 Enviando document to LLM for multiple recipe extraction...');
      console.log(`📄 Document longitud: ${documentText.length} characters`);

      const prompt = `
Analiza el siguiente documento y extrae TODAS las recetas que encuentres. El documento puede contener múltiples recetas.

Para cada receta que encuentres, extrae:
- Título de la receta
- Descripción (si existe)
- Tiempo de preparación (en minutos, solo números)
- Tiempo de cocción (en minutos, solo números)
- Número de porciones (solo números)
- Lista completa de ingredientes con cantidades exactas
- Lista completa de instrucciones paso a paso
- Tipo de receta (ej: "postre", "plato principal", "entrada", "bebida", "snack")
- Etiquetas/tags relevantes (máximo 5)
- Si hay referencias a imágenes embebidas, menciónalas en la descripción

IMPORTANTE:
- Si una receta tiene metadatos como "Nombre:", "Categoría:", etc., úsalos
- Detecta correctamente dónde termina una receta y empieza otra
- Incluye TODA la información disponible para cada receta
- No inventes información que no esté en el documento
- Si hay imágenes mencionadas o embebidas, inclúyelas en la descripción
- Para recipe type y tags, infiere basándote en ingredientes y tipo de preparación

Responde SOLO con un JSON válido con este formato exacto:
{
  "recipes": [
    {
      "title": "Título exacto de la receta",
      "description": "Descripción o información adicional",
      "prepTime": 30,
      "cookTime": 45,
      "servings": 4,
      "recipeType": "postre",
      "tags": ["dulce", "sin gluten", "keto", "navidad"],
      "ingredients": [
        "1 naranja, más extra en rodajas para decorar",
        "140-155 gramos edulcorante de fruta del monje"
      ],
      "instructions": [
        "Paso 1 de la preparación",
        "Paso 2 de la preparación"
      ]
    }
  ]
}

DOCUMENTO A ANALIZAR:
${documentText}
`;

      const response = await this.openai.chat.completions.create({
        model: getModel(),
        messages: [{ role: 'user', content: prompt }],
        max_completion_tokens: 8000,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content?.trim();
      if (!content) {
        throw new Error('Respuesta vacía de OpenAI');
      }

      console.log('🤖 LLM Response received, parsing JSON...');

      // Parse the JSON response
      let jsonResponse;
      try {
        jsonResponse = parseLlmJson(content);
      } catch (parseError) {
        console.error('❌ Error al parse LLM JSON response:', parseError);
        console.log('Raw response sample:', content.substring(0, 500));
        throw new Error('JSON inválido respuesta de LLM');
      }

      if (!jsonResponse.recipes || !Array.isArray(jsonResponse.recipes)) {
        throw new Error('LLM response does not contain recipes array');
      }

      console.log(`✅ Successfully extracted ${jsonResponse.recipes.length} recipes from document`);
      jsonResponse.recipes.forEach((recipe: any, index: number) => {
        console.log(`  ${index + 1}. "${recipe.title}" (${recipe.ingredients?.length || 0} ingredients, ${recipe.instructions?.length || 0} steps)`);
      });

      return {
        success: true,
        recipes: jsonResponse.recipes
      };

    } catch (error: any) {
      console.error('❌ Error in LLM multiple recipe extraction:', error);
      return {
        success: false,
        recipes: [],
        error: error.message
      };
    }
  }

  /**
   * Extract recipe from direct text content (for DOCX processing)
   */
  async extractRecipeFromText(
    text: string,
    options: { suggestedTitle?: string; context?: string } = {}
  ): Promise<RecipeImportResponse> {
    console.log('\n🚀 INICIANDO EXTRACCIÓN DE RECETA FROM TEXT');
    console.log('📏 Text longitud:', text.length, 'characters');
    console.log('💡 Suggested title:', options.suggestedTitle || 'none');
    console.log('🏷️ Context:', options.context || 'general');

    try {
      const prompt = this.buildTextExtractionPrompt(text, options);

      console.log('\n=== 🤖 TEXT EXTRACTION LLM REQUEST START ===');
      console.log('🎯 Model:', getModel());
      console.log('🌡️ Temperature: 0.1');
      console.log('📄 Max Tokens: 4000');

      const completion = await this.openai.chat.completions.create({
        model: getModel(),
        messages: [
          {
            role: 'system',
            content: `Eres un extractor de recetas especializado en procesar contenido de documentos Word. Extrae información directamente sin análisis prolongado.

TAREA: Extraer UNA receta completa del texto proporcionado.

REGLAS ESTRICTAS:
- Extrae datos EXACTAMENTE como aparecen, sin modificaciones
- Si encuentras múltiples recetas en el texto, extrae solo la PRIMERA completa
- Cantidades: mantén formato original ("200g", "1 cucharada", "al gusto")
- Ingredientes: nombres completos sin omitir ninguno
- Instrucciones: texto original sin cambios, todos los pasos en orden

FORMATO ESPERADO: JSON válido con estructura exacta solicitada.

Si el texto no contiene una receta válida, responde: {"error": true}`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        max_completion_tokens: 4000
      });

      console.log('\n✅ LLM RESPONSE RECEIVED');
      console.log('💰 Usage:', completion.usage);

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        throw new Error('Respuesta vacía de LLM');
      }

      console.log('\n📋 RAW TEXT EXTRACTION RESPONSE:');
      console.log('---');
      console.log(responseContent.substring(0, 1000) + (responseContent.length > 1000 ? '...[truncated]' : ''));
      console.log('\n=== 🤖 TEXT EXTRACTION LLM REQUEST END ===\n');

      // Parse and validate response
      console.log('🔄 Parsing JSON response...');
      let parsedResponse: any;
      try {
        parsedResponse = parseLlmJson(responseContent);
      } catch (parseError) {
        console.error('❌ JSON Parse Error:', parseError);
        throw new SyntaxError('JSON inválido respuesta de LLM');
      }

      console.log('🔍 Parsed response keys:', Object.keys(parsedResponse));

      // Check for error flag
      if (parsedResponse.error) {
        console.log('❌ LLM returned error flag - no recipe found in text');
        throw new Error('No valid recipe found in provided text');
      }

      console.log('✅ No error flag detected, proceeding with validation...');

      // Validate with schema
      console.log('🛡️ Validating response with Zod schema...');
      const validatedData = llmResponseSchema.parse(parsedResponse);
      console.log('✅ Schema validation passed successfully');

      console.log('📊 Extracted recipe summary:');
      console.log('  - Title:', validatedData.title);
      console.log('  - Cantidad de ingredientes:', validatedData.ingredients.length);
      console.log('  - Cantidad de instrucciones:', validatedData.instructions.length);
      console.log('  - Tiempo de preparación:', validatedData.prepTime, 'minutos');
      console.log('  - Porciones:', validatedData.servings);

      // Clean title
      const cleanTitle = this.cleanRecipeTitle(validatedData.title);

      return {
        title: cleanTitle,
        description: validatedData.description,
        suggestions: validatedData.suggestions,
        images: (validatedData.images || []).filter(img => img.url && typeof img.order === 'number') as any[], // DOCX typically won't have images
        ingredients: validatedData.ingredients.filter(ing => ing.name && ing.amount).map((ing, index) => ({
          ...ing,
          order: index + 1
        })) as any[],
        instructions: validatedData.instructions.filter(inst => inst.description && typeof inst.step === 'number').sort((a, b) => a.step - b.step) as any[],
        prepTime: validatedData.prepTime,
        cookTime: validatedData.cookTime,
        servings: validatedData.servings,
        difficulty: validatedData.difficulty,
        recipeType: validatedData.recipeType,
        language: detectRecipeLanguage([
          cleanTitle,
          validatedData.description,
          ...validatedData.ingredients.map(i => i.name),
          ...validatedData.instructions.map(s => s.description),
        ].filter(Boolean).join(' ')),
        tags: validatedData.tags
      };

    } catch (error: any) {
      console.log('\n❌ ERROR IN TEXT EXTRACTION');
      console.log('Error type:', error.constructor.name);
      console.log('Error message:', error.message);

      if (error instanceof z.ZodError) {
        console.error('🛡️ Zod validation errors:');
        error.errors.forEach((err, index) => {
          console.error(`  ${index + 1}. Path: ${err.path.join('.')} - ${err.message}`);
        });
        throw new Error('Datos de receta inválidos data extracted from text');
      }

      if (error instanceof SyntaxError) {
        console.error('🔧 JSON parse error details:', error.message);
        throw new Error('Formato de respuesta inválido de LLM');
      }

      console.error('🚨 Error inesperado:', error);
      throw error;
    }
  }

  /**
   * Generate text using OpenAI for general purposes
   */
  async generateText(prompt: string): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      console.log('🤖 Generando texto con LLM...');
      console.log('📏 Prompt longitud:', prompt.length, 'characters');

      const completion = await this.openai.chat.completions.create({
        model: getModel(),
        messages: [
          {
            role: 'system',
            content: 'Eres un asistente especializado en cocina que ayuda a generar scripts naturales y conversacionales para recetas. Responde directamente sin demoras.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_completion_tokens: 2000
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Respuesta vacía de OpenAI');
      }

      console.log('✅ Text generation successful');
      console.log('📏 Response longitud:', content.length, 'characters');

      return {
        success: true,
        content: content.trim()
      };

    } catch (error: any) {
      console.error('❌ Error in text generation:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Build extraction prompt for direct text content
   */
  private buildTextExtractionPrompt(
    text: string,
    options: { suggestedTitle?: string; context?: string } = {}
  ): string {
    // Truncate text if too long
    const maxTextLength = 15000; // Smaller limit for text-only content
    const truncatedText = text.length > maxTextLength
      ? text.substring(0, maxTextLength) + '\n...[texto truncado]'
      : text;

    let contextHint = '';
    if (options.context === 'docx_import') {
      contextHint = `\n🗒️ CONTEXTO: Este texto proviene de un documento Word (.docx) que puede contener múltiples recetas.
Si encuentras varias recetas, extrae solo la PRIMERA receta completa que encuentres.`;
    }

    let titleHint = '';
    if (options.suggestedTitle) {
      titleHint = `\n📝 TÍTULO SUGERIDO: "${options.suggestedTitle}" (usa este como referencia, pero extrae el título real del texto)`;
    }

    return `Extrae UNA receta completa del siguiente texto.
${contextHint}${titleHint}

📋 INSTRUCCIONES DE EXTRACCIÓN:
- Busca patrones típicos: título, ingredientes, preparación/instrucciones
- Extrae cantidades EXACTAS como aparecen ("200g", "1 cucharada", "al gusto")
- Incluye TODOS los ingredientes mencionados sin omitir ninguno, copiados TAL CUAL
- ⚠️ CONSERVA dentro de "name" la forma/estado de preparación del ingrediente ("picado",
  "rallado", "cortado en cubos", "en rodajas", "en juliana", "a temperatura ambiente", etc.).
  NUNCA elimines esos detalles. Ej: "1 cebolla cortada en cubos" → {"name": "cebolla cortada en cubos", "amount": "1", "unit": ""}
- Captura TODOS los pasos de preparación en orden
- Si hay tiempos mencionados, extráelos exactamente
- Si hay número de porciones, extráelo

📊 FORMATO JSON REQUERIDO:
{
  "title": "Título exacto de la receta extracted del texto",
  "description": "Descripción breve si está disponible",
  "images": [],
  "ingredients": [
    {"name": "nombre_exacto_ingrediente", "amount": "cantidad_exacta", "unit": "unidad_si_separada"}
  ],
  "instructions": [
    {"step": 1, "description": "primer_paso_completo_exacto"},
    {"step": 2, "description": "segundo_paso_sin_modificar"}
  ],
  "prepTime": tiempo_preparacion_minutos_numero,
  "cookTime": tiempo_coccion_minutos_numero_o_null,
  "servings": numero_porciones,
  "difficulty": "Fácil|Medio|Difícil",
  "recipeType": "tipo_de_receta_si_mencionado",
  "tags": ["etiquetas_relevantes"]
}

⚠️ Si no encuentras una receta válida en el texto, responde: {"error": true}

TEXTO A PROCESAR:
${truncatedText}`;
  }

  /**
   * Calculate nutritional information for a recipe based on ingredients and servings
   */
  async calculateNutrition(ingredients: Array<{name: string; amount: string; unit?: string}>, servings: number = 4): Promise<{
    success: boolean;
    nutrition?: {
      calories: number;
      protein: number;
      carbohydrates: number;
      fat: number;
      fiber: number;
      sugar: number;
      sodium: number;
    };
    error?: string;
  }> {
    try {
      console.log('🥗 Iniciando nutrition calculation...');
      console.log('📊 Cantidad de ingredientes:', ingredients.length);
      console.log('🍽️ Porciones:', servings);

      const ingredientsList = ingredients.map(ing =>
        `${ing.amount} ${ing.unit || ''} ${ing.name}`.trim()
      ).join('\n');

      const prompt = `Calcula la información nutricional de esta receta con la mayor precisión posible.

INGREDIENTES DE LA RECETA (${servings} porciones):
${ingredientsList}

INSTRUCCIONES:
1. Para cada ingrediente, calcula: calorías, grasa total, sodio, carbohidratos totales, fibra, azúcares y proteína en la cantidad estipulada
2. Suma todos los valores para obtener el total de la receta
3. Divide el resultado entre ${servings} porciones para obtener valores por porción

IMPORTANTE - Estimaciones para ingredientes "al gusto":
- Si no hay cantidad específica o dice "al gusto", haz una estimación realista:
  * Sal: ~1 cucharadita (5g) para platos salados
  * Pimienta: ~1/4 cucharadita (0.5g)
  * Azúcar: ~1-2 cucharaditas (5-10g) para postres
  * Aceite para cocinar: ~1-2 cucharadas (15-30ml)
  * Especias secas: ~1/2 cucharadita (1-2g)
  * Hierbas frescas: ~1 cucharada (3-5g)

Responde SOLO con JSON, valores POR PORCIÓN:
{
  "calories": [número],
  "protein": [número],
  "carbohydrates": [número],
  "fat": [número],
  "fiber": [número],
  "sugar": [número],
  "sodium": [número]
}`;

      const completion = await this.openai.chat.completions.create({
        model: getModel(),
        messages: [
          {
            role: 'system',
            content: 'Eres un nutricionista experto. Utiliza tu conocimiento nutricional para calcular valores precisos y realistas. Responde rápidamente en JSON válido sin razonamiento extenso.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_completion_tokens: 500,
        response_format: { type: "json_object" }
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Respuesta vacía de OpenAI');
      }

      console.log('📦 Raw nutrition response:', content);

      let parsedResponse;
      try {
        parsedResponse = parseLlmJson(content);
      } catch (parseError) {
        console.error('❌ JSON parse error:', parseError);
        throw new Error('JSON inválido respuesta de AI');
      }

      // Validate required nutritional fields
      const requiredFields = ['calories', 'protein', 'carbohydrates', 'fat', 'fiber', 'sugar', 'sodium'];
      for (const field of requiredFields) {
        if (typeof parsedResponse[field] !== 'number') {
          throw new Error(`Missing or invalid ${field} in nutrition response`);
        }
      }

      console.log('✅ Nutrition calculation successful');
      console.log('📊 Calculated nutrition per serving:', parsedResponse);

      return {
        success: true,
        nutrition: {
          calories: Math.round(parsedResponse.calories * 10) / 10,
          protein: Math.round(parsedResponse.protein * 10) / 10,
          carbohydrates: Math.round(parsedResponse.carbohydrates * 10) / 10,
          fat: Math.round(parsedResponse.fat * 10) / 10,
          fiber: Math.round(parsedResponse.fiber * 10) / 10,
          sugar: Math.round(parsedResponse.sugar * 10) / 10,
          sodium: Math.round(parsedResponse.sodium)
        }
      };

    } catch (error: any) {
      console.error('❌ Error in nutrition calculation:', error);
      return {
        success: false,
        error: error.message || 'Error al calcular información nutricional'
      };
    }
  }

  /**
   * Search for real recipes using AI with natural language queries
   */
  async searchRecipesWithAI(query: string, count: number = 3, offset: number = 0): Promise<{ success: boolean; recipes: any[]; error?: string; hasMore?: boolean }> {
    try {
      console.log('🔍 Iniciando AI recipe search...');
      console.log('📝 Query:', query);
      console.log('📊 Count:', count, 'Offset:', offset);

      const offsetInstruction = offset > 0
        ? `IMPORTANTE: Esta es una búsqueda de continuación (offset: ${offset}). Busca recetas DIFERENTES y NUEVAS que no habrías mostrado en búsquedas anteriores de la misma consulta. Varía los sitios web y tipos de recetas.`
        : '';

      const prompt = `Busca ${count} recetas reales que coincidan con: "${query}"

${offsetInstruction}

INSTRUCCIONES CRUCIALES:
- Busca recetas EXISTENTES en sitios web reales de cocina
- Incluye la URL REAL y verificable de donde encontraste cada receta
- Extrae todos los datos completos de esas recetas originales
- NO inventes URLs, utiliza fuentes reales y conocidas

🖼️ IMÁGENES - MUY IMPORTANTE:
- Para cada receta, busca SOLO URLs de imágenes que sean públicamente accesibles
- Usa ÚNICAMENTE estas fuentes confiables:
  * Unsplash: https://images.unsplash.com/photo-[ID]?w=800
  * Pexels: https://images.pexels.com/photos/[ID]/[description].jpeg
  * Pixabay: https://cdn.pixabay.com/photo/[year]/[month]/[day]/[ID].jpg
- EJEMPLOS DE URLs REALES QUE FUNCIONAN:
  * Pasta: "https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=800"
  * Pizza: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800"
  * Ensalada: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800"
  * Pollo: "https://images.unsplash.com/photo-1606728035253-49e8a23146de?w=800"
- Si no puedes encontrar una imagen apropiada, déjalo VACÍO (no inventes URLs)

🚨 IMPORTANTE PARA URLs:
- TODAS las URLs deben comenzar con "https://"
- NO uses URLs incompletas o relativas
- Verifica que el formato sea correcto: https://sitio.com/ruta-completa
- Ejemplos de URLs válidas:
  • https://www.recetasgratis.net/receta-de-flan-de-coco-72345.html
  • https://cookpad.com/es/recetas/8765432-tarta-de-chocolate
  • https://www.allrecipes.com/recipe/123456/chocolate-cake

🍎 INFORMACIÓN NUTRICIONAL OBLIGATORIA:
- Calcula los valores nutricionales POR PORCIÓN basándote en los ingredientes
- Usa tu conocimiento nutricional para estimar valores realistas
- Incluye: calorías, proteínas (g), carbohidratos (g), grasas (g), fibra (g), azúcar (g), sodio (mg)
- Sé preciso: los valores deben ser coherentes con los ingredientes y cantidades
- Ejemplo: 100g de pollo = ~165 cal, 31g proteína, 0g carbohidratos, 3.6g grasa

🤖 CONFIGURACIONES THERMOMIX (cuando aplique):
- Si la receta es compatible con Thermomix o proviene de un sitio Thermomix, incluye configuraciones por paso:
- time: tiempo de procesamiento (ej: "30 sec", "2 min", "5 min")
- temperature: temperatura de cocción (ej: "80°C", "100°C", "Varoma", "sin temperatura")
- speed: velocidad del robot (ej: "3", "5", "7", "10", "Mariposa", "Turbo")
- Si un paso NO requiere Thermomix, puedes omitir thermomixSettings o usar valores null
- Solo incluye estos datos si la receta original los menciona o es claramente adaptable a Thermomix

Responde ÚNICAMENTE con JSON válido en este formato:
{
  "recipes": [
    {
      "title": "Título exacto de la receta encontrada",
      "description": "Descripción original del sitio web",
      "sourceUrl": "https://sitio-real.com/url-completa-de-la-receta",
      "siteName": "Nombre del sitio web",
      "foundAt": "${new Date().toISOString().split('T')[0]}",
      "images": [
        {
          "url": "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800",
          "altText": "Imagen del plato terminado"
        }
      ],
      "ingredients": [
        {
          "name": "nombre del ingrediente",
          "amount": "cantidad",
          "unit": "unidad de medida"
        }
      ],
      "instructions": [
        {
          "step": 1,
          "description": "descripción completa del paso",
          "thermomixSettings": {
            "time": "tiempo en segundos o minutos (ej: '30 sec', '2 min')",
            "temperature": "temperatura en grados (ej: '80°C', 'Varoma')",
            "speed": "velocidad del 1-10 o especial (ej: '5', 'Mariposa')"
          }
        }
      ],
      "prepTime": 30,
      "cookTime": 25,
      "servings": 4,
      "difficulty": "Fácil",
      "recipeType": "Tipo de receta",
      "tags": ["etiquetas", "relevantes", "de", "la", "receta"],
      "nutritionalInfo": {
        "calories": 250,
        "protein": 12.5,
        "carbohydrates": 35.0,
        "fat": 8.2,
        "fiber": 4.1,
        "sugar": 6.5,
        "sodium": 480
      }
    }
  ]
}

NO agregues explicaciones antes o después del JSON. Responde solo con el JSON válido.`;

      const completion = await this.openai.chat.completions.create({
        model: getModel(),
        messages: [
          {
            role: 'system',
            content: 'Eres un asistente experto en búsqueda de recetas que puede encontrar recetas reales en sitios web de cocina conocidos. Responde rápidamente con JSON válido sin análisis prolongado.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_completion_tokens: 4000,
        response_format: { type: "json_object" }
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Respuesta vacía de OpenAI');
      }

      console.log('📦 Raw AI response longitud:', content.length);

      let parsedResponse;
      try {
        parsedResponse = parseLlmJson(content);
      } catch (parseError) {
        console.error('❌ JSON parse error:', parseError);
        throw new Error('JSON inválido respuesta de AI');
      }

      // Validate that we have recipes
      if (!parsedResponse.recipes || !Array.isArray(parsedResponse.recipes)) {
        throw new Error('Inválido response format: missing recipes array');
      }

      // Basic validation for each recipe
      const validatedRecipes = parsedResponse.recipes
        .filter((recipe: any) => {
          return recipe.title &&
                 recipe.sourceUrl &&
                 recipe.ingredients &&
                 Array.isArray(recipe.ingredients) &&
                 recipe.instructions &&
                 Array.isArray(recipe.instructions);
        })
        .map((recipe: any) => ({
          ...recipe,
          // Ensure required fields have defaults
          description: recipe.description || 'Descripción no disponible',
          prepTime: recipe.prepTime || 30,
          servings: recipe.servings || 4,
          difficulty: recipe.difficulty || 'Medio',
          tags: recipe.tags || [],
          images: recipe.images || [],
          siteName: recipe.siteName || new URL(recipe.sourceUrl).hostname,
          foundAt: recipe.foundAt || new Date().toISOString().split('T')[0]
        }));

      console.log('✅ AI recipe search successful');
      console.log('📊 Found recipes:', validatedRecipes.length);

      if (validatedRecipes.length === 0) {
        return {
          success: false,
          recipes: [],
          error: 'No se encontraron recetas válidas para la consulta'
        };
      }

      return {
        success: true,
        recipes: validatedRecipes,
        hasMore: true // Siempre hay más recetas posibles
      };

    } catch (error: any) {
      console.error('❌ Error in AI recipe search:', error);
      return {
        success: false,
        recipes: [],
        error: error.message || 'Error al buscar recetas con IA'
      };
    }
  }

  private deduplicateImages(images: any[]): any[] {
    // Agrupa por "asset base" (misma foto en distinta resolución) y se queda con la
    // versión de mayor calidad de cada grupo. Mantiene el orden de aparición.
    const bestByKey = new Map<string, any>();
    const order: string[] = [];

    for (const image of images) {
      if (!image?.url) continue;
      const key = imageAssetKey(image.url);
      const current = bestByKey.get(key);
      if (!current) {
        order.push(key);
        bestByKey.set(key, image);
      } else if (imageQualityScore(image.url) > imageQualityScore(current.url)) {
        bestByKey.set(key, image); // misma imagen, mejor calidad → reemplazar
      }
    }

    const unique = order.map((key, i) => ({ ...bestByKey.get(key), order: i + 1 }));
    console.log(`🖼️ Images deduplication: ${images.length} → ${unique.length}`);
    return unique;
  }

  private isCookidooLoginPage(htmlContent: string): boolean {
    const loginIndicators = [
      'Un mundo de recetas Thermomix®',
      'Accede a Cookidoo®',
      'Iniciar sesión',
      'Log in to Cookidoo',
      'Please sign in',
      'authentication required',
      'login-form',
      'signin-form',
      'cookidoo-login',
      'data-testid="login"',
      'class="login-page"',
      'id="loginForm"',
      'Inicia sesión en tu cuenta',
      'Sign in to your account',
      'Cookidoo® es la plataforma',
      'subscription required',
      'premium content',
      'members only',
      'exclusive content'
    ];

    const lowerHtml = htmlContent.toLowerCase();

    for (const indicator of loginIndicators) {
      if (lowerHtml.includes(indicator.toLowerCase())) {
        console.log(`🔍 Login indicator found: "${indicator}"`);
        return true;
      }
    }

    // Check for generic Cookidoo landing page content (usually indicates no access)
    const genericIndicators = [
      'miles de recetas exclusivas',
      'thousands of exclusive recipes',
      'recetas paso a paso',
      'step-by-step recipes',
      'guías de cocina',
      'cooking guides'
    ];

    for (const indicator of genericIndicators) {
      if (lowerHtml.includes(indicator.toLowerCase())) {
        console.log(`🔍 Generic content indicator found: "${indicator}"`);
        return true;
      }
    }

    // Check if we have actual recipe content indicators
    const recipeContentIndicators = [
      'ingredientes:',
      'ingredients:',
      'preparación:',
      'preparation:',
      'instrucciones:',
      'instructions:',
      'tiempo de preparación',
      'preparation time',
      'porciones:',
      'servings:',
      'recipe-ingredients',
      'recipe-instructions'
    ];

    let hasRecipeContent = false;
    for (const indicator of recipeContentIndicators) {
      if (lowerHtml.includes(indicator.toLowerCase())) {
        hasRecipeContent = true;
        break;
      }
    }

    if (!hasRecipeContent) {
      console.log('🔍 No recipe content indicators found - likely a login/generic page');
      return true;
    }

    console.log('✅ Recipe content detected - page appears to be accessible');
    return false;
  }
}
