import puppeteer from 'puppeteer';
import { Recipe } from '../types/recipe';
import fs from 'fs';
import path from 'path';

export class ModalPdfService {
  private static async generateModalHtml(recipe: Recipe): Promise<string> {
    const formatIngredients = (ingredients: any[]) => {
      return ingredients.map(ing => {
        const amount = ing.amount || '';
        const unit = ing.unit || '';
        const name = ing.name || '';
        return `
          <div class="ingredient-item">
            <span class="ingredient-bullet">•</span>
            <span class="ingredient-text">${amount} ${unit} ${name}`.trim() + `</span>
          </div>
        `;
      }).join('');
    };

    const formatInstructions = (instructions: any[]) => {
      return instructions.map(inst => {
        let instructionHtml = `
          <div class="instruction-item">
            <div class="instruction-number">${inst.step}</div>
            <div class="instruction-content">
              <p class="instruction-text">${inst.description}</p>
        `;

        if (inst.thermomixSettings) {
          const settings = inst.thermomixSettings;
          const thermomixParts = [];
          if (settings.time) thermomixParts.push(`⏱️ ${settings.time}`);
          if (settings.temperature) thermomixParts.push(`🌡️ ${settings.temperature}`);
          if (settings.speed) thermomixParts.push(`⚡ Velocidad ${settings.speed}`);

          if (thermomixParts.length > 0) {
            instructionHtml += `
              <div class="thermomix-settings">
                <span class="thermomix-label">Thermomix:</span>
                <span class="thermomix-values">${thermomixParts.join(' | ')}</span>
              </div>
            `;
          }
        }

        instructionHtml += `
            </div>
          </div>
        `;
        return instructionHtml;
      }).join('');
    };

    // Generar imagen principal
    const mainImage = recipe.images && recipe.images.length > 0
      ? `<div class="recipe-image">
           <img src="${recipe.images[0].url}" alt="${recipe.title}" />
           <div class="difficulty-badge ${recipe.difficulty?.toLowerCase()}">${recipe.difficulty}</div>
         </div>`
      : '';

    // Metadatos
    const metadata = `
      <div class="recipe-meta">
        <div class="meta-item">
          <div class="meta-icon">⏱️</div>
          <div class="meta-content">
            <div class="meta-label">Preparación</div>
            <div class="meta-value">${recipe.prepTime} min</div>
          </div>
        </div>
        ${recipe.cookTime ? `
        <div class="meta-item">
          <div class="meta-icon">🔥</div>
          <div class="meta-content">
            <div class="meta-label">Cocción</div>
            <div class="meta-value">${recipe.cookTime} min</div>
          </div>
        </div>` : ''}
        <div class="meta-item">
          <div class="meta-icon">👥</div>
          <div class="meta-content">
            <div class="meta-label">Porciones</div>
            <div class="meta-value">${recipe.servings}</div>
          </div>
        </div>
      </div>
    `;

    // Tags
    const tagsHtml = recipe.tags && recipe.tags.length > 0
      ? `<div class="tags-section">
           <div class="tags">
             ${recipe.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
           </div>
         </div>`
      : '';

    // Descripción
    const descriptionHtml = recipe.description
      ? `<div class="recipe-description">
           <p>${recipe.description}</p>
         </div>`
      : '';

    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>${recipe.title} - TasteBox</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            line-height: 1.6;
            color: #1a1a1a;
            background: white;
            padding: 0;
            margin: 0;
          }

          .recipe-container {
            max-width: 800px;
            margin: 0 auto;
            padding: 24px;
            min-height: 100vh;
            position: relative;
          }

          .recipe-header {
            margin-bottom: 24px;
          }

          .recipe-title {
            font-size: 2rem;
            font-weight: 700;
            color: #1a1a1a;
            margin-bottom: 16px;
            line-height: 1.2;
          }

          .recipe-image {
            position: relative;
            width: 100%;
            height: 300px;
            border-radius: 12px;
            overflow: hidden;
            margin-bottom: 24px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          }

          .recipe-image img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          .difficulty-badge {
            position: absolute;
            top: 16px;
            right: 16px;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 0.875rem;
            font-weight: 600;
            text-transform: capitalize;
            backdrop-filter: blur(10px);
            color: white;
          }

          .difficulty-badge.fácil {
            background: rgba(34, 197, 94, 0.9);
          }

          .difficulty-badge.medio {
            background: rgba(251, 146, 60, 0.9);
          }

          .difficulty-badge.difícil {
            background: rgba(239, 68, 68, 0.9);
          }

          .recipe-description {
            margin-bottom: 24px;
          }

          .recipe-description p {
            font-size: 1rem;
            color: #4a5568;
            line-height: 1.7;
          }

          .recipe-meta {
            display: flex;
            gap: 32px;
            margin-bottom: 32px;
            padding: 20px;
            background: #f8fafc;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
          }

          .meta-item {
            display: flex;
            align-items: center;
            gap: 12px;
            flex: 1;
          }

          .meta-icon {
            font-size: 1.5rem;
            opacity: 0.8;
          }

          .meta-content {
            display: flex;
            flex-direction: column;
          }

          .meta-label {
            font-size: 0.875rem;
            color: #64748b;
            font-weight: 500;
          }

          .meta-value {
            font-size: 1.125rem;
            font-weight: 600;
            color: #1a1a1a;
          }

          .content-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            margin-bottom: 32px;
          }

          .section-title {
            font-size: 1.5rem;
            font-weight: 700;
            color: #1a1a1a;
            margin-bottom: 20px;
            padding-bottom: 8px;
            border-bottom: 2px solid #e2e8f0;
          }

          .ingredients-section {
            background: #ffffff;
          }

          .ingredient-item {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            padding: 12px 0;
            border-bottom: 1px solid #f1f5f9;
          }

          .ingredient-item:last-child {
            border-bottom: none;
          }

          .ingredient-bullet {
            color: #ff6b35;
            font-weight: 700;
            font-size: 1.2rem;
            margin-top: 2px;
            flex-shrink: 0;
          }

          .ingredient-text {
            font-size: 1rem;
            color: #374151;
            line-height: 1.5;
          }

          .instructions-section {
            background: #ffffff;
          }

          .instruction-item {
            display: flex;
            gap: 16px;
            margin-bottom: 24px;
            align-items: flex-start;
          }

          .instruction-number {
            background: #ff6b35;
            color: white;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 0.875rem;
            flex-shrink: 0;
            margin-top: 4px;
          }

          .instruction-content {
            flex: 1;
          }

          .instruction-text {
            font-size: 1rem;
            color: #374151;
            line-height: 1.6;
            margin-bottom: 8px;
          }

          .thermomix-settings {
            background: #eff6ff;
            border: 1px solid #bfdbfe;
            border-radius: 8px;
            padding: 10px 12px;
            margin-top: 8px;
          }

          .thermomix-label {
            font-weight: 600;
            color: #1e40af;
            font-size: 0.875rem;
          }

          .thermomix-values {
            color: #1e40af;
            font-size: 0.875rem;
            margin-left: 8px;
          }

          .tags-section {
            margin-bottom: 32px;
          }

          .tags {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
          }

          .tag {
            background: #ff6b35;
            color: white;
            padding: 4px 12px;
            border-radius: 16px;
            font-size: 0.875rem;
            font-weight: 500;
          }

          .footer {
            position: absolute;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            align-items: center;
            gap: 12px;
            opacity: 0.7;
          }

          .footer-logo {
            height: 32px;
            width: auto;
          }

          .footer-text {
            font-size: 0.875rem;
            color: #64748b;
          }

          /* Para impresión */
          @media print {
            .recipe-container {
              padding: 16px;
            }

            .recipe-image {
              height: 250px;
            }

            .content-grid {
              gap: 24px;
            }
          }
        </style>
      </head>
      <body>
        <div class="recipe-container">
          <div class="recipe-header">
            <h1 class="recipe-title">${recipe.title}</h1>
          </div>

          ${mainImage}
          ${descriptionHtml}
          ${metadata}

          <div class="content-grid">
            <div class="ingredients-section">
              <h2 class="section-title">Ingredientes</h2>
              <div class="ingredients-list">
                ${formatIngredients(recipe.ingredients)}
              </div>
            </div>

            <div class="instructions-section">
              <h2 class="section-title">Instrucciones</h2>
              <div class="instructions-list">
                ${formatInstructions(recipe.instructions)}
              </div>
            </div>
          </div>

          ${tagsHtml}

          ${recipe.sourceUrl ? `
          <div class="source-section">
            <p style="font-size: 0.875rem; color: #64748b;">
              <strong>Fuente:</strong> ${recipe.sourceUrl}
            </p>
          </div>` : ''}

          <div class="footer">
            <img src="file://${path.join(process.cwd(), 'tastebox_white.png').replace(/\\/g, '/')}" alt="TasteBox" class="footer-logo" />
            <span class="footer-text">Generado por TasteBox - ${new Date().toLocaleDateString('es-ES')}</span>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  static async generateRecipePdf(recipe: Recipe): Promise<Buffer> {
    let browser;

    try {
      console.log('🎯 Iniciando generation de PDF modal para:', recipe.title);

      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });

      console.log('🌐 Browser lanzado successfully');

      const page = await browser.newPage();
      const html = await this.generateModalHtml(recipe);

      console.log('📄 HTML del modal generado, configurando página...');

      // Set viewport for consistent rendering
      await page.setViewport({ width: 1200, height: 1600 });

      await page.setContent(html, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      console.log('📄 Contenido HTML establecido, esperando imágenes...');

      // Wait for all images to load
      try {
        await page.waitForFunction(`() => {
          const images = Array.from(document.images);
          return images.length === 0 || images.every(img => img.complete);
        }`, { timeout: 15000 });
        console.log('✅ Todas las imágenes cargadas successfully');
      } catch (error) {
        console.log('⚠️ Timeout esperando imágenes, continuando...');
      }

      // Additional wait for any remaining network activity
      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log('📄 Generando PDF del modal...');

      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '25mm',
          left: '15mm'
        },
        printBackground: true,
        preferCSSPageSize: true
      });

      console.log('✅ PDF modal generado successfully, tamaño:', pdfBuffer.length, 'bytes');

      // Simple buffer validation
      if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new Error('PDF buffer is empty');
      }

      return Buffer.from(pdfBuffer);
    } catch (error) {
      console.error('Error generando modal PDF:', error);
      throw new Error(`Error al generate modal PDF: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}
