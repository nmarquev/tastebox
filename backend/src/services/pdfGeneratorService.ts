import puppeteer from 'puppeteer';
import { Recipe } from '../types/recipe';

export class PdfGeneratorService {
  private static async generateRecipeHtml(recipe: Recipe): Promise<string> {
    const formatIngredients = (ingredients: any[]) => {
      return ingredients.map(ing => {
        const amount = ing.amount || '';
        const unit = ing.unit || '';
        const name = ing.name || '';
        return `<li class="ingredient-item">${amount} ${unit} ${name}`.trim() + '</li>';
      }).join('');
    };

    const formatInstructions = (instructions: any[]) => {
      return instructions.map(inst => {
        let instructionHtml = `<li class="instruction-item">
          <span class="step-number">${inst.step}.</span>
          <span class="step-description">${inst.description}</span>`;

        if (inst.thermomixSettings) {
          const settings = inst.thermomixSettings;
          instructionHtml += `<div class="thermomix-settings">
            <strong>Thermomix:</strong>`;

          if (settings.time) instructionHtml += ` ${settings.time}`;
          if (settings.temperature) instructionHtml += ` | ${settings.temperature}`;
          if (settings.speed) instructionHtml += ` | Velocidad ${settings.speed}`;

          instructionHtml += `</div>`;
        }

        instructionHtml += '</li>';
        return instructionHtml;
      }).join('');
    };

    // Desactivar imágenes temporalmente para evitar problemas de PDF
    const imageHtml = '';

    const tagsHtml = recipe.tags && recipe.tags.length > 0
      ? `<div class="tags-section">
           <h3>Etiquetas</h3>
           <div class="tags">
             ${recipe.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
           </div>
         </div>`
      : '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${recipe.title} - TasteBox</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.4;
            margin: 20px;
            color: #333;
            background: white;
          }

          .header {
            text-align: center;
            margin-bottom: 30px;
            background: #ff6b35;
            color: white;
            padding: 20px;
            border-radius: 8px;
          }

          .app-name {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
          }

          .recipe-title {
            font-size: 28px;
            font-weight: bold;
            margin: 10px 0;
          }

          .recipe-description {
            font-size: 16px;
            margin: 10px 0;
          }

          .recipe-meta {
            display: flex;
            justify-content: space-around;
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            border: 1px solid #ddd;
          }

          .meta-item {
            text-align: center;
          }

          .meta-label {
            font-weight: bold;
            color: #ff6b35;
            font-size: 12px;
          }

          .meta-value {
            font-size: 16px;
            color: #333;
            margin-top: 5px;
          }

          .content-section {
            margin: 25px 0;
          }

          .section-title {
            font-size: 20px;
            font-weight: bold;
            color: #333;
            margin-bottom: 15px;
            border-bottom: 2px solid #ff6b35;
            padding-bottom: 5px;
          }

          .ingredients-list {
            list-style: none;
            padding: 0;
          }

          .ingredient-item {
            background: #f8f9fa;
            margin: 5px 0;
            padding: 10px;
            border-left: 3px solid #ff6b35;
            border-radius: 3px;
          }

          .instructions-list {
            list-style: none;
            padding: 0;
          }

          .instruction-item {
            margin: 10px 0;
            padding: 10px;
            background: #fff;
            border: 1px solid #ddd;
            border-radius: 5px;
          }

          .step-number {
            background: #ff6b35;
            color: white;
            border-radius: 50%;
            width: 25px;
            height: 25px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            margin-right: 10px;
            font-size: 12px;
          }

          .thermomix-settings {
            margin-top: 8px;
            padding: 5px;
            background: #e3f2fd;
            border-radius: 3px;
            font-size: 12px;
            color: #1976d2;
          }

          .tags {
            margin: 15px 0;
          }

          .tag {
            background: #ff6b35;
            color: white;
            padding: 3px 8px;
            border-radius: 15px;
            font-size: 11px;
            margin: 2px;
            display: inline-block;
          }

          .footer {
            margin-top: 30px;
            text-align: center;
            color: #666;
            font-size: 11px;
            border-top: 1px solid #ddd;
            padding-top: 15px;
          }

          .source-url {
            margin: 15px 0;
            padding: 8px;
            background: #f0f0f0;
            border-radius: 3px;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="app-name">🍴 TasteBox</div>
          <h1 class="recipe-title">${recipe.title}</h1>
          ${recipe.description ? `<p class="recipe-description">${recipe.description}</p>` : ''}
        </div>

        <div class="recipe-meta">
          <div class="meta-item">
            <div class="meta-label">TIEMPO PREP</div>
            <div class="meta-value">${recipe.prepTime} min</div>
          </div>
          ${recipe.cookTime ? `
          <div class="meta-item">
            <div class="meta-label">TIEMPO COCCIÓN</div>
            <div class="meta-value">${recipe.cookTime} min</div>
          </div>` : ''}
          <div class="meta-item">
            <div class="meta-label">PORCIONES</div>
            <div class="meta-value">${recipe.servings}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">DIFICULTAD</div>
            <div class="meta-value">${recipe.difficulty}</div>
          </div>
        </div>

        <div class="content-section">
          <h2 class="section-title">Ingredientes</h2>
          <ul class="ingredients-list">
            ${formatIngredients(recipe.ingredients)}
          </ul>
        </div>

        <div class="content-section">
          <h2 class="section-title">Instrucciones</h2>
          <ol class="instructions-list">
            ${formatInstructions(recipe.instructions)}
          </ol>
        </div>

        ${tagsHtml}

        ${recipe.sourceUrl ? `
        <div class="source-url">
          <strong>Fuente:</strong> ${recipe.sourceUrl}
        </div>` : ''}

        <div class="footer">
          <p>Generado por TasteBox</p>
          <p>Fecha: ${new Date().toLocaleDateString('es-ES')}</p>
        </div>
      </body>
      </html>
    `;
  }

  static async generateRecipePdf(recipe: Recipe): Promise<Buffer> {
    let browser;

    try {
      console.log('🎯 Iniciando generation de PDF para:', recipe.title);

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
      const html = await this.generateRecipeHtml(recipe);

      console.log('📄 HTML generado, configurando página...');

      // Set viewport for consistent rendering
      await page.setViewport({ width: 1920, height: 1080 });

      await page.setContent(html, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      console.log('📄 Contenido HTML establecido, esperando imágenes...');

      // Wait for all images to load with better error handling
      try {
        await page.waitForFunction(`() => {
          const images = Array.from(document.images);
          console.log(\`Cargando \${images.length} imágenes...\`);
          const loadedImages = images.filter(img => img.complete && img.naturalWidth > 0);
          console.log(\`\${loadedImages.length} de \${images.length} imágenes cargadas\`);
          return images.length === 0 || images.every(img => img.complete);
        }`, { timeout: 15000 });
        console.log('✅ Todas las imágenes cargadas successfully');
      } catch (error) {
        console.log('⚠️ Timeout esperando imágenes, continuando con las imágenes cargadas...');
      }

      // Additional wait for any remaining network activity
      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log('📄 Imágenes cargadas, generando PDF...');

      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        },
        printBackground: true
      });

      console.log('✅ PDF generado successfully, tamaño:', pdfBuffer.length, 'bytes');

      // Simple buffer validation only
      if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new Error('PDF buffer is empty');
      }

      console.log('✅ PDF generated successfully, size:', pdfBuffer.length, 'bytes');
      return Buffer.from(pdfBuffer);
    } catch (error) {
      console.error('Error generando PDF:', error);
      throw new Error(`Error al generate PDF: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}
