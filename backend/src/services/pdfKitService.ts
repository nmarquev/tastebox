import PDFDocument from 'pdfkit';
import { Recipe } from '../types/recipe';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { getSourceFromUrl } from '../utils/sourceUtils';

export class PdfKitService {
  static async downloadImage(url: string): Promise<Buffer | null> {
    return new Promise((resolve) => {
      try {
        const protocol = url.startsWith('https') ? https : http;
        const request = protocol.get(url, (response) => {
          if (response.statusCode === 200) {
            const chunks: Buffer[] = [];
            response.on('data', (chunk) => chunks.push(chunk));
            response.on('end', () => resolve(Buffer.concat(chunks)));
          } else {
            console.log(`❌ Error descargando imagen: ${response.statusCode}`);
            resolve(null);
          }
        });

        request.on('error', (error) => {
          console.log(`❌ Error descargando imagen: ${error.message}`);
          resolve(null);
        });

        request.setTimeout(5000, () => {
          console.log('❌ Timeout descargando imagen');
          request.destroy();
          resolve(null);
        });
      } catch (error) {
        console.log(`❌ Error descargando imagen: ${error}`);
        resolve(null);
      }
    });
  }

  // Obtiene el buffer de una imagen: si es local (/uploads/...) la lee del disco;
  // si es externa, la descarga por HTTP(S).
  static async getImageBuffer(url: string): Promise<Buffer | null> {
    if (!url) return null;

    // Imagen embebida como data URI base64 (data:image/...;base64,XXXX).
    if (url.startsWith('data:')) {
      try {
        const base64 = url.substring(url.indexOf(',') + 1);
        return Buffer.from(base64, 'base64');
      } catch (error) {
        console.log('⚠️ No se pudo decodificar la imagen base64:', error);
        return null;
      }
    }

    const uploadsIdx = url.indexOf('/uploads/');
    if (uploadsIdx !== -1) {
      const filename = decodeURIComponent(url.substring(uploadsIdx + '/uploads/'.length).split('?')[0]);
      const uploadDir = process.env.UPLOAD_DIR || './uploads';
      const filePath = path.join(uploadDir, filename);
      try {
        if (fs.existsSync(filePath)) {
          console.log('🗂️ Imagen leída del disco:', filePath);
          return fs.readFileSync(filePath);
        }
      } catch (error) {
        console.log('⚠️ No se pudo leer la imagen del disco, se intentará descargar:', error);
      }
    }

    return PdfKitService.downloadImage(url);
  }

  // Resuelve la ruta a un asset de /public (iconos PNG), tolerante a dev/prod.
  static assetPath(file: string): string | null {
    const candidates = [
      path.join(process.cwd(), '..', 'public', file),
      path.join(__dirname, '..', '..', '..', 'public', file),
      path.join(process.cwd(), 'public', file),
    ];
    for (const p of candidates) {
      try { if (fs.existsSync(p)) return p; } catch { /* ignore */ }
    }
    return null;
  }

  // Dibuja el icono de una característica de la receta en (x, y) con el tamaño dado.
  static drawAttrIcon(doc: any, key: string, x: number, y: number, size: number): void {
    const black = '#1a1a1a';
    const pngMap: Record<string, string> = {
      thermomix: 'thermomix-logo.transparent.png',
      airFryer: 'air-fryer.png',
      lowCarb: 'logo-saludable.png',
    };
    if (pngMap[key]) {
      const p = PdfKitService.assetPath(pngMap[key]);
      if (p) {
        // Los PNG tienen margen interno: se renderizan un poco más grandes y
        // centrados para igualar visualmente a los iconos vectoriales.
        // El Air Fryer se ve grande, así que va un poco más chico.
        const pngExtra = key === 'airFryer' ? 0 : 5;
        const pngSize = size + pngExtra;
        const off = (pngSize - size) / 2;
        try { doc.image(p, x - off, y - off, { fit: [pngSize, pngSize] }); return; } catch { /* fallback abajo */ }
      }
    }

    // Iconos vectoriales: mismos SVG que usan las tarjetas (viewBox 24x24, trazo).
    const svgPaths: Record<string, string[]> = {
      // lucide Heart
      featured: ['M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z'],
      // RecipePreparedIcon (olla con tilde)
      cooked: [
        'M3.5 9.5c2-2.2 5-3.3 8.5-3.3s6.5 1.1 8.5 3.3',
        'M10 5.7h4',
        'M4.8 12.3H3',
        'M19.2 12.3H21',
        'M4.8 9.5h14.4v7.7a2 2 0 0 1-2 2H6.8a2 2 0 0 1-2-2z',
        'M9.2 14.4l2.1 2.1 3.5-3.9',
      ],
      // AvocadoIcon (cuerpo; el carozo se dibuja aparte)
      keto: ['M12 3c-1.7 0-2.9 1.5-2.9 3.1 0 1-0.6 1.7-1.3 2.6C6.3 10.5 5 12.5 5 15a7 7 0 0 0 14 0c0-2.5-1.3-4.5-2.8-6.3-0.7-0.9-1.3-1.6-1.3-2.6C14.9 4.5 13.7 3 12 3Z'],
      // lucide Leaf
      vegetarian: [
        'M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z',
        'M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12',
      ],
      // lucide Wheat (espiga); se le agrega una línea de tachado aparte
      glutenFree: [
        'M2 22 16 8',
        'M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z',
        'M7.47 8.53 9 7l1.53 1.53a3.5 3.5 0 0 1 0 4.94L9 15l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z',
        'M11.47 4.53 13 3l1.53 1.53a3.5 3.5 0 0 1 0 4.94L13 11l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z',
        'M20 2h2v2a4 4 0 0 1-4 4h-2V6a4 4 0 0 1 4-4Z',
        'M11.47 17.47 13 19l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L5 19l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z',
        'M15.47 13.47 17 15l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L9 15l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z',
        'M19.47 9.47 21 11l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L13 11l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z',
      ],
      sugarFree: [
        'm8.5 8.5-1 1a4.95 4.95 0 0 0 7 7l1-1',
        'M11.843 6.187A4.947 4.947 0 0 1 16.5 7.5a4.947 4.947 0 0 1 1.313 4.657',
        'M14 16.5V14',
        'M14 6.5v1.843',
        'M10 10v7.5',
        'm16 7 1-5 1.367.683A3 3 0 0 0 19.708 3H21v1.292a3 3 0 0 0 .317 1.341L22 7l-5 1',
        'm8 17-1 5-1.367-.683A3 3 0 0 0 4.292 21H3v-1.292a3 3 0 0 0-.317-1.341L2 17l5-1',
      ],
      proteica: [
        'M12.5 2a6.5 6.5 0 0 0-6.22 4.6c-1.1 3.13-.78 3.9-3.18 6.08A3 3 0 0 0 5 18c4 0 8.4-1.8 11.4-4.3A6.5 6.5 0 0 0 12.5 2Z',
        'm18.5 6 2.19 4.5a6.48 6.48 0 0 1 .31 2 6.49 6.49 0 0 1-2.6 5.2C15.4 20.2 11 22 7 22a3 3 0 0 1-2.68-1.66L2.4 16.5',
      ],
      sweet: [
        'M7.2 7.9 3 11v9c0 .6.4 1 1 1h16c.6 0 1-.4 1-1v-9c0-2-3-6-7-8l-3.6 2.6',
        'M16 13H3',
        'M16 17H3',
      ],
      savory: [
        'M3 2v7a3 3 0 0 0 6 0V2',
        'M6 2v20',
        'M18 2v20',
        'M18 2c-3 2-3 7 0 9',
      ],
    };

    // Algunos iconos se ven chicos: se dibujan un poco más grandes y centrados.
    const vecExtra: Record<string, number> = { cooked: 5, airFryer: 4, keto: 4, sugarFree: 5 };
    const vecSize = size + (vecExtra[key] ?? 0);
    const voff = (vecSize - size) / 2;
    doc.save();
    doc.translate(x - voff, y - voff);
    doc.scale(vecSize / 24);
    doc.strokeColor(black).fillColor(black).lineWidth(key === 'sugarFree' ? 1.7 : 2).lineJoin('round').lineCap('round');

    const paths = svgPaths[key];
    if (key === 'airFryer') {
      // Freidora de aire dibujada como vector (borde más grueso y nítido).
      doc.lineWidth(2.4);
      doc.roundedRect(4.5, 3.5, 15, 17, 3.5).stroke(); // cuerpo del electrodoméstico
      doc.moveTo(4.5, 9).lineTo(19.5, 9).stroke();      // línea del panel superior
      doc.fillColor(black).circle(15.6, 6.2, 1).fill(); // perilla
      doc.roundedRect(9, 15, 6, 3.4, 1.2).stroke();     // canasta / agarre inferior
    } else if (key === 'sugarFree') {
      doc.lineWidth(2);
      doc.roundedRect(7, 7, 10, 10, 3).stroke();
      doc.path('M7 9 3 6 4 11 7 13').stroke();
      doc.path('M17 11 21 8 20 13 17 15').stroke();
      doc.moveTo(10, 8).lineTo(10, 16).stroke();
      doc.moveTo(14, 8).lineTo(14, 16).stroke();
      doc.moveTo(4, 4).lineTo(20, 20).stroke();
    } else if (key === 'proteica') {
      doc.lineWidth(2);
      doc.ellipse(11, 10, 7, 6).stroke();
      doc.ellipse(15.5, 14.5, 5.5, 4.5).stroke();
      doc.circle(10, 8.5, 2).stroke();
      doc.moveTo(7, 16).lineTo(4, 19).stroke();
      doc.moveTo(5, 18).lineTo(3, 16).stroke();
    } else if (key === 'sweet') {
      doc.lineWidth(2);
      doc.path('M4 11 L14 4 L21 11 L21 20 L4 20 Z').stroke();
      doc.moveTo(4, 13).lineTo(21, 13).stroke();
      doc.moveTo(4, 17).lineTo(21, 17).stroke();
      doc.moveTo(10, 4).lineTo(10, 2).stroke();
      doc.circle(10, 2, 1.2).stroke();
    } else if (key === 'savory') {
      doc.lineWidth(2);
      doc.moveTo(5, 3).lineTo(5, 10).stroke();
      doc.moveTo(8, 3).lineTo(8, 10).stroke();
      doc.moveTo(11, 3).lineTo(11, 10).stroke();
      doc.moveTo(5, 10).lineTo(11, 10).stroke();
      doc.moveTo(8, 10).lineTo(8, 21).stroke();
      doc.moveTo(17, 3).lineTo(17, 21).stroke();
      doc.path('M17 3 C14 6 14 10 17 12').stroke();
    } else if (paths) {
      if (key === 'featured') {
        doc.fillColor('#ef4444').strokeColor('#ef4444');
        for (const d of paths) doc.path(d).fillAndStroke();
        doc.restore();
        return;
      }
      for (const d of paths) doc.path(d).stroke();
      if (key === 'keto') doc.circle(12, 14.5, 2.6).stroke(); // carozo de la palta
      if (key === 'proteica') doc.circle(12.5, 8.5, 2.5).stroke();
      if (key === 'sweet') doc.circle(9, 7, 2).stroke();
      if (key === 'glutenFree') doc.path('M4 4 L20 20').stroke(); // tachado de la espiga
      if (key === 'sugarFree') doc.path('M2 2 L22 22').stroke(); // tachado del caramelo
    } else {
      doc.circle(12, 12, 9).stroke();
    }

    doc.restore();
  }

  // Dibuja los iconos de estadísticas (mismos que la tarjeta: ChefHat, Clock, User).
  static drawStatIcon(doc: any, type: string, x: number, y: number, size: number): void {
    const black = '#1a1a1a';
    doc.save();
    doc.translate(x, y);
    doc.scale(size / 24);
    doc.strokeColor(black).lineWidth(2).lineJoin('round').lineCap('round');

    if (type === 'prep') {
      // lucide ChefHat
      doc.path('M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589 5 5 0 0 0-9.186 0 4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1Z').stroke();
      doc.path('M6 17h12').stroke();
    } else if (type === 'total') {
      // lucide Clock
      doc.circle(12, 12, 10).stroke();
      doc.path('M12 6 L12 12 L16 14').stroke();
    } else if (type === 'servings') {
      // lucide User
      doc.path('M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2').stroke();
      doc.circle(12, 7, 4).stroke();
    }

    doc.restore();
  }

  static async generateRecipePdf(recipe: Recipe, options: { header?: string; footer?: string; title?: string } = {}): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        console.log('🎯 Generando PDF con PDFKit para:', recipe.title);

        // Configurar documento con encoding UTF-8
        const doc = new PDFDocument({
          margin: 30,
          info: {
            Title: recipe.title,
            Author: 'TasteBox',
            Subject: 'Receta de cocina',
            Producer: 'TasteBox Recipe Generator'
          }
        });

        // Encabezado y pie de página (se repiten en cada página).
        const pageHeader = (options.header || '').trim();
        const pageFooter = (options.footer || '').trim();
        let drawingHeaderFooter = false; // evita recursión por paginación
        const drawHeaderFooter = () => {
          if (drawingHeaderFooter) return;
          drawingHeaderFooter = true;
          try {
            if (pageHeader) {
              doc.fontSize(9).font('Helvetica-Oblique').fillColor('#888')
                 .text(pageHeader, 40, 16, { width: doc.page.width - 80, align: 'center', lineBreak: false });
            }
            if (pageFooter) {
              doc.fontSize(9).font('Helvetica-Oblique').fillColor('#888')
                 .text(pageFooter, 40, doc.page.height - 24, { width: doc.page.width - 80, align: 'center', lineBreak: false });
            }
          } finally {
            drawingHeaderFooter = false;
          }
        };
        if (pageHeader || pageFooter) {
          doc.on('pageAdded', drawHeaderFooter);
          drawHeaderFooter(); // primera página
        }

        const buffers: Buffer[] = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          console.log('✅ PDF generado con PDFKit, tamaño:', pdfBuffer.length, 'bytes');
          resolve(pdfBuffer);
        });

        doc.on('error', (error: Error) => {
          console.error('❌ Error en PDFKit:', error);
          reject(error);
        });

        // Obtener imagen si existe (local desde disco, o descarga si es externa)
        let imageBuffer: Buffer | null = null;
        if (recipe.images && recipe.images.length > 0) {
          console.log('📸 Obteniendo imagen de la receta...');
          imageBuffer = await PdfKitService.getImageBuffer(recipe.images[0].url);
        }

        // Descargar logo de TasteBox
        let logoBuffer: Buffer | null = null;
        try {
          logoBuffer = fs.readFileSync(path.join(process.cwd(), 'tastebox_white.png'));
          console.log('✅ Logo de TasteBox cargado');
        } catch (error) {
          console.log('⚠️ No se pudo cargar el logo de TasteBox:', error instanceof Error ? error.message : error);
        }

        // HEADER LIMPIO Y SIMPLE (como el modal). Si hay encabezado, dejar espacio arriba.
        let yPos = pageHeader ? 50 : 40;

        // Título de hoja (opcional): se imprime una sola vez, centrado, encima del título de la receta.
        const sheetTitle = (options.title || '').trim();
        if (sheetTitle) {
          doc.fillColor('#1a1a1a')
             .fontSize(16)
             .font('Helvetica-Bold')
             .text(sheetTitle, 40, yPos, { width: doc.page.width - 80, align: 'center' });
          yPos += 30;
        }

        // Título principal (más compacto). Avanzamos según la altura real del texto
        // para que un título de dos renglones no quede tapado por el recuadro de info.
        const titleWidth = doc.page.width - 80;
        doc.fillColor('#1a1a1a').fontSize(18).font('Helvetica-Bold');
        const titleHeight = doc.heightOfString(recipe.title, { width: titleWidth });
        doc.text(recipe.title, 40, yPos, { width: titleWidth });

        yPos += titleHeight + 12;

        // CUADRO DE INFORMACIÓN: tiempos, porciones y características de la receta
        const boxLeft = 30;
        const boxWidth = doc.page.width - 60;
        const contentLeft = 40;
        const contentRight = doc.page.width - 40;
        const iconSize = 13;
        const chipSize = 22;
        const chipGap = 6;
        const attrRowHeight = chipSize + chipGap;

        // Estadísticas (tiempos y porciones).
        const stats = [
          { icon: 'prep', label: 'Preparacion', value: `${recipe.prepTime ?? 0} min` },
          { icon: 'total', label: 'Total', value: `${recipe.cookTime ?? 0} min` },
          { icon: 'servings', label: 'Porciones', value: `${recipe.servings ?? '-'}` },
        ];

        // Características: solo las activas, una al lado de la otra (con wrap si no entran).
        const attrDefs = [
          { key: 'thermomix', label: 'Thermomix' },
          { key: 'airFryer', label: 'Air Fryer' },
          { key: 'glutenFree', label: 'Sin Gluten' },
          { key: 'sugarFree', label: 'Sin Azucar' },
          { key: 'keto', label: 'Keto' },
          { key: 'lowCarb', label: 'Low Carb' },
          { key: 'proteica', label: 'Proteica' },
          { key: 'vegetarian', label: 'Vegetariana' },
          { key: 'sweet', label: 'Receta Dulce' },
          { key: 'savory', label: 'Receta Salada' },
          { key: 'cooked', label: 'Cocinada' },
          { key: 'featured', label: 'Favorita' },
        ];
        const activeAttrs = attrDefs.filter(a => Boolean((recipe as any)[a.key]));

        const attrColumns = Math.max(1, Math.floor((contentRight - contentLeft + chipGap) / (chipSize + chipGap)));
        const attrRows = activeAttrs.length ? Math.ceil(activeAttrs.length / attrColumns) : 0;

        const statsHeight = 36;
        const attrsBlockHeight = attrRows ? (8 + attrRows * attrRowHeight) : 0;
        const boxHeight = statsHeight + attrsBlockHeight + 6;

        // Caja con borde naranja.
        doc.rect(boxLeft, yPos, boxWidth, boxHeight).fill('#f8f9fa');
        doc.strokeColor('#ff6b35').lineWidth(1).rect(boxLeft, yPos, boxWidth, boxHeight).stroke();

        // Fila de estadísticas (icono + etiqueta + valor).
        const statWidth = (doc.page.width - 80) / stats.length;
        stats.forEach((item, i) => {
          const x = contentLeft + i * statWidth;
          PdfKitService.drawStatIcon(doc, item.icon, x, yPos + 9, 14);
          doc.fillColor('#666').fontSize(8).font('Helvetica-Bold').text(item.label, x + 20, yPos + 7);
          doc.fillColor('#333').fontSize(12).font('Helvetica-Bold').text(item.value, x + 20, yPos + 18);
        });

        // Bloque de características activas debajo de las estadísticas.
        if (attrRows) {
          const attrsTop = yPos + statsHeight;
          doc.strokeColor('#ffd9c7').lineWidth(0.7)
             .moveTo(contentLeft, attrsTop - 2).lineTo(contentRight, attrsTop - 2).stroke();
          activeAttrs.forEach((attr, index) => {
            const col = index % attrColumns;
            const row = Math.floor(index / attrColumns);
            const px = contentLeft + col * (chipSize + chipGap);
            const py = attrsTop + 6 + row * attrRowHeight;
            doc.roundedRect(px, py, chipSize, chipSize, 4).fill('#eef7f5');
            PdfKitService.drawAttrIcon(
              doc,
              attr.key,
              px + (chipSize - iconSize) / 2,
              py + (chipSize - iconSize) / 2,
              iconSize
            );
          });
        }

        yPos += boxHeight + 15;

        // METADATOS (izquierda) + FOTO de la receta (derecha), debajo del recuadro.
        const categoriaText = (recipe.recipeType || '')
          .split('|').map(s => s.trim()).filter(Boolean).join(', ');
        const metaLines = [
          { label: 'Fuente', value: recipe.sourceUrl ? getSourceFromUrl(recipe.sourceUrl) : '' },
          { label: 'Dificultad', value: recipe.difficulty || '' },
          { label: 'Tipo de plato', value: (recipe as any).dishType || '' },
          { label: 'Categoría', value: categoriaText },
        ].filter(m => m.value);

        const photoW = 180;
        const photoH = 135;
        const photoX = doc.page.width - 40 - photoW;
        const metaWidth = (photoX - 15) - 40; // ancho disponible para los metadatos
        const blockTop = yPos;

        // Foto a la derecha
        if (imageBuffer) {
          try {
            doc.image(imageBuffer, photoX, blockTop, { fit: [photoW, photoH], align: 'center', valign: 'center' });
          } catch (imgError) {
            console.log('⚠️ Error al añadir imagen:', imgError);
          }
        }

        // Metadatos a la izquierda (títulos en negrita)
        let metaY = blockTop;
        for (const m of metaLines) {
          doc.fontSize(10).font('Helvetica-Bold').fillColor('#1a1a1a')
             .text(`${m.label}: `, 40, metaY, { continued: true, width: metaWidth });
          doc.font('Helvetica').fillColor('#333').text(m.value);
          metaY = doc.y + 5;
        }

        yPos = Math.max(metaY, blockTop + (imageBuffer ? photoH : 0)) + 15;

        // INGREDIENTES Y INSTRUCCIONES EN COLUMNAS
        const leftColumnWidth = (doc.page.width - 80) * 0.4; // 40% para ingredientes
        const rightColumnWidth = (doc.page.width - 80) * 0.55; // 55% para instrucciones
        const columnGap = 20;

        // INGREDIENTES (columna izquierda)
        let leftY = yPos;
        doc.fillColor('#2c3e50')
           .fontSize(14)
           .font('Helvetica-Bold')
           .text('Ingredientes', 40, leftY);

        leftY += 25;

        doc.fillColor('#333')
           .fontSize(9)
           .font('Helvetica');

        recipe.ingredients.forEach((ingredient, index) => {
          if (leftY > doc.page.height - 100) return; // Evitar overflow

          // Fondo alternado
          if (index % 2 === 0) {
            doc.rect(35, leftY - 2, leftColumnWidth + 10, 15).fill('#f9f9f9');
          }

          // Bullet (usar '•' U+2022, soportado por Helvetica/WinAnsi; '●' U+25CF no lo está)
          doc.fillColor('#ff6b35')
             .fontSize(10)
             .text('•', 40, leftY);

          // Texto del ingrediente (más compacto)
          const text = `${ingredient.amount || ''} ${ingredient.unit || ''} ${ingredient.name}`.trim();
          doc.fillColor('#333')
             .fontSize(9)
             .font('Helvetica')
             .text(text, 50, leftY, { width: leftColumnWidth - 15 });

          leftY += 15;
        });

        // INSTRUCCIONES (columna derecha) — solo si la receta tiene instrucciones.
        let rightY = yPos;
        const rightX = 40 + leftColumnWidth + columnGap;

        if (recipe.instructions && recipe.instructions.length > 0) {
        doc.fillColor('#2c3e50')
           .fontSize(14)
           .font('Helvetica-Bold')
           .text('Instrucciones', rightX, rightY);

        rightY += 25;

        recipe.instructions.forEach((instruction, index) => {
          if (rightY > doc.page.height - 100) return; // Evitar overflow

          // Número del paso (más pequeño)
          doc.circle(rightX + 8, rightY + 8, 8).fill('#ff6b35');
          doc.fillColor('white')
             .fontSize(10)
             .font('Helvetica-Bold')
             .text(`${instruction.step}`, rightX + (instruction.step < 10 ? 6 : 4), rightY + 5);

          // Descripción del paso
          doc.fillColor('#333')
             .fontSize(9)
             .font('Helvetica')
             .text(instruction.description, rightX + 20, rightY + 2, {
               width: rightColumnWidth - 25,
               lineGap: 1
             });

          const textHeight = doc.heightOfString(instruction.description, { width: rightColumnWidth - 25 });
          rightY += Math.max(textHeight + 8, 20);

          // Configuración Thermomix (si existe, más compacta)
          if (instruction.thermomixSettings) {
            const settings = instruction.thermomixSettings;
            const thermomixText = [];
            if (settings.time) thermomixText.push(`Tiempo: ${settings.time}`);
            if (settings.temperature) thermomixText.push(`Temp: ${settings.temperature}`);
            if (settings.speed) thermomixText.push(`Vel: ${settings.speed}`);

            if (thermomixText.length > 0) {
              doc.rect(rightX + 20, rightY, rightColumnWidth - 25, 12).fill('#e3f2fd');
              doc.fillColor('#1976d2')
                 .fontSize(7)
                 .font('Helvetica-Bold')
                 .text(`Thermomix: ${thermomixText.join(' | ')}`, rightX + 22, rightY + 3);
              rightY += 15;
            }
          }

          rightY += 5;
        });
        } // fin del bloque de instrucciones

        // FOOTER con logo de TasteBox
        const finalFooterY = doc.page.height - 40;

        // Logo de TasteBox en el footer
        if (logoBuffer) {
          try {
            const logoWidth = 80;
            const logoHeight = 20;
            const logoX = (doc.page.width - logoWidth) / 2;

            doc.image(logoBuffer, logoX, finalFooterY - 25, {
              width: logoWidth,
              height: logoHeight,
              fit: [logoWidth, logoHeight]
            });

            console.log('✅ Logo TasteBox añadido al footer');
          } catch (logoError) {
            console.log('⚠️ Error añadiendo logo al footer:', logoError);
            // Fallback al texto
            doc.fillColor('#999')
               .fontSize(10)
               .font('Helvetica-Bold')
               .text('TasteBox', 0, finalFooterY - 20, {
                 width: doc.page.width,
                 align: 'center'
               });
          }
        } else {
          // Fallback al texto si no hay logo
          doc.fillColor('#999')
             .fontSize(10)
             .font('Helvetica-Bold')
             .text('TasteBox', 0, finalFooterY - 20, {
               width: doc.page.width,
               align: 'center'
             });
        }

        // Texto del footer
        const finalFooter = `Generado por TasteBox - ${new Date().toLocaleDateString('es-ES')}`;
        doc.fillColor('#999')
           .fontSize(8)
           .font('Helvetica')
           .text(finalFooter, 0, finalFooterY, {
             width: doc.page.width,
             align: 'center'
           });

        doc.end();

      } catch (error) {
        console.error('❌ Error creando PDF con PDFKit:', error);
        reject(error);
      }
    });
  }
}
