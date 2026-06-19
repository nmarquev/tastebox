import { Recipe } from '@/types/recipe';
import { resolveImageUrl } from './api';
import { getSourceFromUrl, isValidUrl } from './siteUtils';

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Icono SVG en línea (trazo), viewBox 24x24.
const svgIcon = (paths: string, extra = ''): string =>
  `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle">${paths}${extra}</svg>`;

const ICONS = {
  prep: svgIcon('<path d="M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589 5 5 0 0 0-9.186 0 4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1Z"/><path d="M6 17h12"/>'),
  clock: svgIcon('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'),
  user: svgIcon('<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
  glutenFree: svgIcon('<path d="M2 22 16 8"/><path d="M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/><path d="M7.47 8.53 9 7l1.53 1.53a3.5 3.5 0 0 1 0 4.94L9 15l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/><path d="M11.47 4.53 13 3l1.53 1.53a3.5 3.5 0 0 1 0 4.94L13 11l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/><path d="M20 2h2v2a4 4 0 0 1-4 4h-2V6a4 4 0 0 1 4-4Z"/><path d="M11.47 17.47 13 19l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L5 19l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z"/><path d="M15.47 13.47 17 15l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L9 15l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z"/><path d="M19.47 9.47 21 11l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L13 11l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z"/><path d="M4 4 L20 20"/>'),
  keto: svgIcon('<path d="M12 3c-1.7 0-2.9 1.5-2.9 3.1 0 1-0.6 1.7-1.3 2.6C6.3 10.5 5 12.5 5 15a7 7 0 0 0 14 0c0-2.5-1.3-4.5-2.8-6.3-0.7-0.9-1.3-1.6-1.3-2.6C14.9 4.5 13.7 3 12 3Z"/><circle cx="12" cy="14.5" r="2.6"/>'),
  vegetarian: svgIcon('<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>'),
  cooked: svgIcon('<path d="M3.5 9.5c2-2.2 5-3.3 8.5-3.3s6.5 1.1 8.5 3.3"/><path d="M10 5.7h4"/><path d="M4.8 12.3H3"/><path d="M19.2 12.3H21"/><path d="M4.8 9.5h14.4v7.7a2 2 0 0 1-2 2H6.8a2 2 0 0 1-2-2z"/><path d="M9.2 14.4l2.1 2.1 3.5-3.9"/>'),
  favorite: svgIcon('<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>'),
};

/**
 * Imprime las recetas con el mismo formato que la vista Lista:
 * imagen, nombre, tiempos/porciones y los iconos a la derecha.
 */
interface PrintListOptions {
  title?: string;
  header?: string;
  footer?: string;
  pageNumber?: boolean;
  variant?: 'list' | 'detail';
}

export const printRecipeList = async (recipes: Recipe[], options: PrintListOptions = {}): Promise<void> => {
  if (!recipes.length) return;

  const title = (options.title || '').trim();
  const header = (options.header || '').trim();
  const footer = (options.footer || '').trim();
  const pageNumber = options.pageNumber === true;
  const showMeta = options.variant === 'detail'; // 'detail' muestra tiempos/porciones e iconos; 'list' solo imagen/nombre/fuente

  const win = window.open('', '_blank');
  if (!win) {
    throw new Error('No se pudo abrir la ventana de impresión. Habilitá las ventanas emergentes.');
  }

  const origin = window.location.origin;

  const rows = recipes.map(recipe => {
    const imageUrl = recipe.images?.[0]?.url ? resolveImageUrl(recipe.images[0].url) : '';
    const name = escapeHtml(recipe.title || '');
    const source = recipe.sourceUrl
      ? (isValidUrl(recipe.sourceUrl) ? getSourceFromUrl(recipe.sourceUrl) : recipe.sourceUrl)
      : '';

    const stats: string[] = [];
    if (recipe.prepTime && recipe.prepTime > 0) stats.push(`${ICONS.prep} ${recipe.prepTime} min`);
    if (recipe.cookTime && recipe.cookTime > 0) stats.push(`${ICONS.clock} ${(recipe.prepTime || 0) + recipe.cookTime} min`);
    if (recipe.servings && recipe.servings > 0) stats.push(`${ICONS.user} ${recipe.servings}`);

    const icons: string[] = [];
    if (recipe.thermomix) icons.push(`<img src="${origin}/thermomix-logo.png" style="width:16px;height:16px;object-fit:contain" />`);
    if (recipe.airFryer) icons.push(`<img src="${origin}/air-fryer.png" style="width:16px;height:16px;object-fit:contain" />`);
    if (recipe.glutenFree) icons.push(ICONS.glutenFree);
    if (recipe.keto) icons.push(ICONS.keto);
    if (recipe.lowCarb) icons.push(`<img src="${origin}/logo-saludable.png" style="width:16px;height:16px;object-fit:contain;filter:grayscale(1)" />`);
    if (recipe.vegetarian) icons.push(ICONS.vegetarian);
    if (recipe.cooked) icons.push(ICONS.cooked);
    if (recipe.featured) icons.push(ICONS.favorite);

    return `
      <div class="row">
        ${imageUrl ? `<img class="thumb" src="${imageUrl}" crossorigin="anonymous" alt="" />` : `<div class="thumb"></div>`}
        <div class="name">
          <div class="title">${name}</div>
          ${source ? `<div class="source">${escapeHtml(source)}</div>` : ''}
        </div>
        ${showMeta ? `<div class="meta">
          ${stats.length ? `<div class="stats">${stats.join('')}</div>` : ''}
          ${icons.length ? `<div class="icons">${icons.join('')}</div>` : ''}
        </div>` : ''}
      </div>`;
  }).join('');

  win.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Lista de recetas</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: ui-sans-serif, system-ui, Arial, sans-serif; margin: 0; color: #1a1a1a; ${header ? 'padding-top: 8mm;' : ''} ${footer ? 'padding-bottom: 10mm;' : ''} }
    /* Márgenes visibles en la vista de pantalla (arriba, izquierda y derecha). Al imprimir los maneja @page. */
    @media screen { body { padding: 15mm 15mm 0 15mm; ${header ? 'padding-top: 23mm;' : ''} } }
    @page { size: A4 portrait; margin: 15mm; ${pageNumber ? '@bottom-right { content: "Pág. " counter(page); font-size: 9px; color: #888; }' : ''} }
    .page-title { font-size: 18px; font-weight: 700; text-align: center; margin: 0 0 6mm; }
    .page-header { position: fixed; top: 0; left: 0; right: 0; text-align: center; font-size: 10px; font-weight: 600; color: #888; font-style: italic; padding: 2mm 0; }
    .page-footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 10px; color: #888; font-style: italic; padding: 2mm 0; }
    .row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 9px 4px;
      border-bottom: 1px solid #e5e5e5;
      break-inside: avoid;
    }
    .thumb { width: 52px; height: 52px; flex: 0 0 auto; border-radius: 6px; object-fit: cover; background: #f1f1f1; }
    .name { flex: 1 1 auto; min-width: 0; }
    .title { font-weight: 600; font-size: 13px; }
    .source { font-size: 10px; color: #888; }
    /* Bloque derecho: tiempos arriba, iconos abajo (como la vista lista). */
    .meta { flex: 0 0 auto; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
    .stats { display: flex; align-items: center; gap: 12px; font-size: 12px; color: #444; white-space: nowrap; }
    .icons { display: flex; align-items: center; gap: 8px; }
  </style>
</head>
<body>
  ${header ? `<div class="page-header">${escapeHtml(header)}</div>` : ''}
  ${title ? `<h1 class="page-title">${escapeHtml(title)}</h1>` : ''}
  ${rows}
  ${footer ? `<div class="page-footer">${escapeHtml(footer)}</div>` : ''}
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
