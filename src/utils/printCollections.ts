const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface PrintCollectionItem {
  name: string;
  count: number;
  cover?: string;
}

interface PrintCollectionsOptions {
  title?: string;
  header?: string;
  footer?: string;
  pageNumber?: boolean;
  columns?: number;
}

const openPrintWindow = (bodyHtml: string, styles: string, title: string) => {
  const win = window.open('', '_blank');
  if (!win) {
    throw new Error('No se pudo abrir la ventana de impresión. Habilitá las ventanas emergentes.');
  }
  win.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>* { box-sizing: border-box; } ${styles}</style>
</head>
<body>
  ${bodyHtml}
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

// Imprime las colecciones como tarjetas (imagen cuadrada + nombre + cantidad de recetas).
export const printCollectionCards = async (items: PrintCollectionItem[], options: PrintCollectionsOptions = {}): Promise<void> => {
  if (!items.length) return;
  const title = (options.title || '').trim();
  const header = (options.header || '').trim();
  const footer = (options.footer || '').trim();
  const pageNumber = options.pageNumber === true;
  const columns = [1, 2, 3, 4, 5, 6].includes(options.columns ?? 4) ? (options.columns as number) : 4;

  const cards = items.map((c) => `
    <div class="card">
      ${c.cover ? `<img src="${c.cover}" crossorigin="anonymous" alt="" />` : `<div class="noimg"></div>`}
      <div class="body">
        <div class="name">${escapeHtml(c.name)}</div>
        <div class="count">${c.count} receta${c.count === 1 ? '' : 's'}</div>
      </div>
    </div>`).join('');

  const styles = `
    body { font-family: ui-sans-serif, system-ui, Arial, sans-serif; margin: 0; color: #1a1a1a; ${header ? 'padding-top: 8mm;' : ''} ${footer ? 'padding-bottom: 10mm;' : ''} }
    @page { size: A4 portrait; margin: 15mm; ${pageNumber ? '@bottom-right { content: "Pág. " counter(page); font-size: 9px; color: #888; }' : ''} }
    .page-title { font-size: 16px; font-weight: 700; text-align: center; margin: 0 0 4mm; }
    .page-header { position: fixed; top: 0; left: 0; right: 0; text-align: center; font-size: 10px; font-weight: 600; color: #444; padding: 2mm 0; }
    .page-footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 9px; color: #666; padding: 2mm 0; }
    .grid { display: grid; grid-template-columns: repeat(${columns}, 1fr); grid-auto-rows: auto; gap: 3mm; }
    .card { display: flex; flex-direction: column; border: 1px solid #e5e5e5; border-radius: 6px; overflow: hidden; break-inside: avoid; }
    .card img, .card .noimg { margin: 2mm 2mm 0 2mm; width: calc(100% - 4mm); aspect-ratio: 1 / 1; object-fit: cover; display: block; border-radius: 4px; background: #f1f1f1; }
    .body { padding: 2mm; }
    .name { font-size: 12px; font-weight: 700; line-height: 1.2; }
    .count { font-size: 10px; color: #888; }
  `;
  const body = `
    ${header ? `<div class="page-header">${escapeHtml(header)}</div>` : ''}
    ${title ? `<h1 class="page-title">${escapeHtml(title)}</h1>` : ''}
    <div class="grid">${cards}</div>
    ${footer ? `<div class="page-footer">${escapeHtml(footer)}</div>` : ''}`;
  openPrintWindow(body, styles, title || 'Colecciones');
};

// Imprime las colecciones como lista (imagen + nombre + cantidad de recetas).
export const printCollectionList = async (items: PrintCollectionItem[], options: PrintCollectionsOptions = {}): Promise<void> => {
  if (!items.length) return;
  const title = (options.title || '').trim();
  const header = (options.header || '').trim();
  const footer = (options.footer || '').trim();
  const pageNumber = options.pageNumber === true;

  const rows = items.map((c) => `
    <div class="row">
      ${c.cover ? `<img class="thumb" src="${c.cover}" crossorigin="anonymous" alt="" />` : `<div class="thumb"></div>`}
      <div class="name">${escapeHtml(c.name)}</div>
      <div class="count">${c.count} receta${c.count === 1 ? '' : 's'}</div>
    </div>`).join('');

  const styles = `
    body { font-family: ui-sans-serif, system-ui, Arial, sans-serif; margin: 0; color: #1a1a1a; ${header ? 'padding-top: 8mm;' : ''} ${footer ? 'padding-bottom: 10mm;' : ''} }
    @page { size: A4 portrait; margin: 15mm; ${pageNumber ? '@bottom-right { content: "Pág. " counter(page); font-size: 9px; color: #888; }' : ''} }
    @media screen { body { padding: 15mm 15mm 0 15mm; } }
    .page-title { font-size: 18px; font-weight: 700; text-align: center; margin: 0 0 6mm; }
    .page-header { position: fixed; top: 0; left: 0; right: 0; text-align: center; font-size: 10px; font-weight: 600; color: #888; font-style: italic; padding: 2mm 0; }
    .page-footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 10px; color: #888; font-style: italic; padding: 2mm 0; }
    .row { display: flex; align-items: center; gap: 12px; padding: 9px 4px; border-bottom: 1px solid #e5e5e5; break-inside: avoid; }
    .thumb { width: 52px; height: 52px; flex: 0 0 auto; border-radius: 6px; object-fit: cover; background: #f1f1f1; }
    .name { flex: 1 1 auto; min-width: 0; font-weight: 600; font-size: 14px; }
    .count { flex: 0 0 auto; font-size: 12px; color: #888; white-space: nowrap; }
  `;
  const body = `
    ${header ? `<div class="page-header">${escapeHtml(header)}</div>` : ''}
    ${title ? `<h1 class="page-title">${escapeHtml(title)}</h1>` : ''}
    ${rows}
    ${footer ? `<div class="page-footer">${escapeHtml(footer)}</div>` : ''}`;
  openPrintWindow(body, styles, title || 'Lista de colecciones');
};
