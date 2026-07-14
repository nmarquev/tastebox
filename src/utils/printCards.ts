import { Recipe } from '@/types/recipe';
import { resolveImageUrl } from './api';
import { getSourceFromUrl, isValidUrl } from './siteUtils';

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Icono SVG en línea (trazo), viewBox 24x24.
const svgIcon = (paths: string, size = 16): string =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle">${paths}</svg>`;

const ICONS = {
  prep: svgIcon('<path d="M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589 5 5 0 0 0-9.186 0 4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1Z"/><path d="M6 17h12"/>'),
  clock: svgIcon('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'),
  user: svgIcon('<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
  glutenFree: svgIcon('<path d="M2 22 16 8"/><path d="M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/><path d="M7.47 8.53 9 7l1.53 1.53a3.5 3.5 0 0 1 0 4.94L9 15l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/><path d="M11.47 4.53 13 3l1.53 1.53a3.5 3.5 0 0 1 0 4.94L13 11l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/><path d="M20 2h2v2a4 4 0 0 1-4 4h-2V6a4 4 0 0 1 4-4Z"/><path d="M11.47 17.47 13 19l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L5 19l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z"/><path d="M15.47 13.47 17 15l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L9 15l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z"/><path d="M19.47 9.47 21 11l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L13 11l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z"/><path d="M4 4 L20 20"/>'),
  sugarFree: svgIcon('<path d="m15.5 7.5-7 7"/><path d="m21 3-3.5 3.5"/><path d="m6.5 17.5-3.5 3.5"/><path d="M9 3 3 9l12 12 6-6Z"/><path d="M3 3l18 18"/>'),
  keto: svgIcon('<path d="M12 3c-1.7 0-2.9 1.5-2.9 3.1 0 1-0.6 1.7-1.3 2.6C6.3 10.5 5 12.5 5 15a7 7 0 0 0 14 0c0-2.5-1.3-4.5-2.8-6.3-0.7-0.9-1.3-1.6-1.3-2.6C14.9 4.5 13.7 3 12 3Z"/><circle cx="12" cy="14.5" r="2.6"/>'),
  proteica: svgIcon('<path d="M16.4 13.8c1.9.3 3.6-.8 4.2-2.5.7-1.9-.3-4-2.2-4.7-1.2-.4-2.5-.2-3.5.6L8.3 13.8a4 4 0 1 0 2.8 2.8l1.2-1.2"/>'),
  vegetarian: svgIcon('<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>'),
  sweet: svgIcon('<path d="M8 2v2"/><path d="M16 2v2"/><path d="M3 10h18"/><path d="M5 10v10h14V10"/><path d="M5 15c2 1 3-1 5 0s3 1 5 0 3-1 4 0"/>'),
  savory: svgIcon('<path d="M3 2v7a3 3 0 0 0 6 0V2"/><path d="M6 2v20"/><path d="M18 2v20"/><path d="M18 2c-3 2-3 7 0 9"/>'),
};

interface PrintCardsFields {
  image?: boolean;
  title?: boolean;
  source?: boolean;
  difficulty?: boolean;
  dishType?: boolean;
  category?: boolean;
  times?: boolean;
  icons?: boolean;
}

interface PrintCardsOptions {
  title?: string;
  header?: string;
  footer?: string;
  pageNumber?: boolean;
  columns?: number;
  fields?: PrintCardsFields;
}

/**
 * Imprime las tarjetas de recetas (imagen + nombre) tal como se ven en la grilla,
 * abriendo una ventana de impresión con una grilla lista para imprimir.
 * Con 1 columna se imprime el formato horizontal: imagen a la izquierda y datos a la derecha.
 */
export const printRecipeCards = async (recipes: Recipe[], options: PrintCardsOptions = {}): Promise<void> => {
  if (!recipes.length) return;

  const title = (options.title || '').trim();
  const header = (options.header || '').trim();
  const footer = (options.footer || '').trim();
  const pageNumber = options.pageNumber === true;
  const columns = [1, 2, 3, 4, 5, 6].includes(options.columns ?? 5) ? (options.columns as number) : 5;
  const oneColumn = columns === 1;

  const win = window.open('', '_blank');
  if (!win) {
    throw new Error('No se pudo abrir la ventana de impresión. Habilitá las ventanas emergentes.');
  }

  const origin = window.location.origin;

  // Campos a imprimir (por defecto todos). Solo se imprime el campo si está marcado y si existe.
  const fld: Required<PrintCardsFields> = {
    image: true, title: true, source: true, difficulty: true, dishType: true, category: true, times: true, icons: true,
    ...(options.fields || {}),
  };

  const iconPx = oneColumn ? 18 : 16;

  // Devuelve las piezas HTML de los campos de texto/iconos (sin la imagen).
  const buildFieldPieces = (recipe: Recipe): string => {
    const name = escapeHtml(recipe.title || '');
    const source = recipe.sourceUrl
      ? (isValidUrl(recipe.sourceUrl) ? getSourceFromUrl(recipe.sourceUrl) : recipe.sourceUrl)
      : '';
    const category = (recipe.recipeType || '').trim();
    const dish = (recipe.dishType || '').trim();
    const difficulty = (recipe.difficulty || '').trim();

    const stats: string[] = [];
    if (recipe.prepTime && recipe.prepTime > 0) stats.push(`${ICONS.prep} ${recipe.prepTime} min`);
    if (recipe.cookTime && recipe.cookTime > 0) stats.push(`${ICONS.clock} ${(recipe.prepTime || 0) + recipe.cookTime} min`);
    if (recipe.servings && recipe.servings > 0) stats.push(`${ICONS.user} ${recipe.servings}`);

    const icons: string[] = [];
    if (recipe.thermomix) icons.push(`<img src="${origin}/thermomix-logo.png" style="width:${iconPx}px;height:${iconPx}px;object-fit:contain" />`);
    if (recipe.airFryer) icons.push(`<img src="${origin}/air-fryer.png" style="width:${iconPx}px;height:${iconPx}px;object-fit:contain" />`);
    if (recipe.glutenFree) icons.push(ICONS.glutenFree);
    if (recipe.sugarFree) icons.push(ICONS.sugarFree);
    if (recipe.keto) icons.push(ICONS.keto);
    if (recipe.lowCarb) icons.push(`<img src="${origin}/logo-saludable.png" style="width:${iconPx}px;height:${iconPx}px;object-fit:contain;filter:grayscale(1)" />`);
    if (recipe.proteica) icons.push(ICONS.proteica);
    if (recipe.vegetarian) icons.push(ICONS.vegetarian);
    if (recipe.sweet) icons.push(ICONS.sweet);
    if (recipe.savory) icons.push(ICONS.savory);

    const parts: string[] = [];
    if (fld.title && name) parts.push(`<div class="fld-title">${name}</div>`);
    if (fld.source && source) parts.push(`<div class="fld-source"><b>Fuente:</b> ${escapeHtml(source)}</div>`);
    if (fld.difficulty && difficulty) parts.push(`<div class="fld-meta"><b>Dificultad:</b> ${escapeHtml(difficulty)}</div>`);
    if (fld.dishType && dish) parts.push(`<div class="fld-meta"><b>Tipo de receta:</b> ${escapeHtml(dish)}</div>`);
    if (fld.category && category) parts.push(`<div class="fld-meta"><b>Categoría:</b> ${escapeHtml(category)}</div>`);
    if (fld.times && stats.length) parts.push(`<div class="fld-stats">${stats.join('')}</div>`);
    if (fld.icons && icons.length) parts.push(`<div class="fld-icons">${icons.join('')}</div>`);
    return parts.join('');
  };

  const imageOf = (recipe: Recipe): string =>
    recipe.images?.[0]?.url ? resolveImageUrl(recipe.images[0].url) : '';

  // Fila horizontal (vista de 1 columna): imagen a la izquierda, datos a la derecha.
  const buildRowCard = (recipe: Recipe): string => {
    const imageUrl = imageOf(recipe);
    const imgHtml = fld.image && imageUrl ? `<img class="row-img" src="${imageUrl}" crossorigin="anonymous" alt="" />` : '';
    return `
      <div class="row-card">
        ${imgHtml}
        <div class="row-body">${buildFieldPieces(recipe)}</div>
      </div>`;
  };

  // Tarjeta de grilla (2-6 columnas): imagen arriba + campos debajo.
  const buildGridCard = (recipe: Recipe): string => {
    const imageUrl = imageOf(recipe);
    const imgHtml = fld.image && imageUrl ? `<img src="${imageUrl}" crossorigin="anonymous" alt="" />` : '';
    const body = buildFieldPieces(recipe);
    return `
      <div class="card">
        ${imgHtml}
        ${body ? `<div class="card-body">${body}</div>` : ''}
      </div>`;
  };

  const cards = oneColumn
    ? recipes.map(buildRowCard).join('')
    : recipes.map(buildGridCard).join('');

  const titleHtml = title ? `<h1 class="page-title">${escapeHtml(title)}</h1>` : '';
  const headerHtml = header ? `<div class="page-header">${escapeHtml(header)}</div>` : '';
  const footerHtml = footer ? `<div class="page-footer">${escapeHtml(footer)}</div>` : '';

  win.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${title ? escapeHtml(title) : 'Tarjetas de recetas'}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: ui-sans-serif, system-ui, Arial, sans-serif; margin: 0; color: #1a1a1a; ${header ? 'padding-top: 8mm;' : ''} ${footer ? 'padding-bottom: 10mm;' : ''} }
    /* Márgenes en los 4 lados de la hoja A4. */
    @page { size: A4 portrait; margin: 15mm; ${pageNumber ? '@bottom-right { content: "Pág. " counter(page); font-size: 9px; color: #888; }' : ''} }
    .page-title { font-size: 16px; font-weight: 700; text-align: center; margin: 0 0 4mm; }
    .page-header {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 10px;
      font-weight: 600;
      color: #444;
      padding: 2mm 0;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(${columns}, 1fr);
      grid-auto-rows: auto;
      gap: 3mm;
    }
    .card {
      display: flex;
      flex-direction: column;
      border: 1px solid #e5e5e5;
      border-radius: 6px;
      overflow: hidden;
      break-inside: avoid;
    }
    /* Imagen cuadrada para que se vea mejor; margen arriba, izquierda y derecha. */
    .card img, .card .noimg {
      margin: 2mm 2mm 0 2mm;
      width: calc(100% - 4mm);
      aspect-ratio: 1 / 1;
      object-fit: cover;
      display: block;
      border-radius: 4px;
      background: #f1f1f1;
    }
    /* Cuerpo de la tarjeta de grilla (campos debajo de la imagen). */
    .card-body { padding: 2mm; display: flex; flex-direction: column; gap: 1.2mm; }
    .card .fld-title { font-size: 12px; font-weight: 700; line-height: 1.2; }
    .card .fld-source { font-size: 10px; color: #888; }
    .card .fld-meta { font-size: 10px; color: #555; }
    .card .fld-stats { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 11px; color: #444; }
    .card .fld-icons { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
    /* Vista de 1 columna: imagen a la izquierda, datos a la derecha. */
    .list { display: flex; flex-direction: column; gap: 4mm; }
    .row-card {
      display: flex;
      gap: 5mm;
      align-items: flex-start;
      border: 1px solid #e5e5e5;
      border-radius: 8px;
      padding: 4mm;
      break-inside: avoid;
    }
    .row-img {
      width: 45mm;
      height: 45mm;
      flex: 0 0 auto;
      object-fit: cover;
      border-radius: 6px;
      background: #f1f1f1;
    }
    .row-body { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 1.5mm; }
    .row-card .fld-title { font-size: 18px; font-weight: 700; line-height: 1.2; }
    .row-card .fld-source { font-size: 12px; color: #888; }
    .row-card .fld-meta { font-size: 12px; color: #555; }
    .row-card .fld-stats { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; font-size: 13px; color: #444; }
    .row-card .fld-icons { display: flex; align-items: center; gap: 10px; }
    .page-footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 9px;
      color: #666;
      padding: 2mm 0;
    }
    @media print { .card { box-shadow: none; } }
  </style>
</head>
<body>
  ${headerHtml}
  ${titleHtml}
  <div class="${oneColumn ? 'list' : 'grid'}">${cards}</div>
  ${footerHtml}
  <script>
    (function () {
      var imgs = Array.prototype.slice.call(document.images);
      var pending = imgs.length;
      var finished = false;
      function done() { if (finished) return; finished = true; window.focus(); window.print(); }
      if (!pending) { done(); return; }
      function check() { if (--pending <= 0) done(); }
      imgs.forEach(function (img) {
        if (img.complete) { check(); }
        else { img.addEventListener('load', check); img.addEventListener('error', check); }
      });
      setTimeout(done, 5000);
    })();
  <\/script>
</body>
</html>`);
  win.document.close();
};
