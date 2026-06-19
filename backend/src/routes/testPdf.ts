import { Router } from 'express';
import puppeteer from 'puppeteer';
import { PdfGeneratorService } from '../services/pdfGeneratorService';
import { PdfKitService } from '../services/pdfKitService';
import { ModalPdfService } from '../services/modalPdfService';

const router = Router();

// Test endpoint para PDF sin autenticación - VERSION SIMPLE
router.get('/test-pdf', async (req, res) => {
  console.log('🧪 Test PDF endpoint called');

  try {
    // Test simple con HTML básico
    console.log('🧪 Generando PDF con HTML mínimo...');

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    const simpleHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Test PDF</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; }
        </style>
      </head>
      <body>
        <h1>Test PDF Generation</h1>
        <p>Este es un PDF de prueba muy simple.</p>
        <p>Si esto funciona, el problema está en el HTML complejo.</p>
        <p>Fecha: ${new Date().toLocaleDateString('es-ES')}</p>
      </body>
      </html>
    `;

    await page.setContent(simpleHtml);
    const simplePdfBuffer = await page.pdf({ format: 'A4' });
    await browser.close();

    console.log(`✅ PDF simple generado. Tamaño: ${simplePdfBuffer.length} bytes`);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="simple-test.pdf"');
    res.setHeader('Content-Length', simplePdfBuffer.length);

    res.send(simplePdfBuffer);

  } catch (error) {
    console.error('❌ Error en test PDF simple:', error);
    res.status(500).json({
      error: 'Error generando PDF de prueba simple',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// Test endpoint con servicio real
router.get('/test-recipe-pdf', async (req, res) => {
  console.log('🧪 Test Recipe PDF endpoint called');

  try {
    // Receta de prueba simple
    const testRecipe = {
      id: 'test-123',
      title: 'Receta de Prueba Simplificada',
      description: 'Receta simple para probar PDF',
      prepTime: 15,
      cookTime: 30,
      servings: 4,
      difficulty: 'Fácil',
      ingredients: [
        { name: 'Huevos', amount: '2', unit: 'unidades' },
        { name: 'Harina', amount: '200', unit: 'gramos' },
        { name: 'Leche', amount: '250', unit: 'ml' }
      ],
      instructions: [
        { step: 1, description: 'Batir los huevos en un bowl' },
        { step: 2, description: 'Agregar la harina gradualmente' },
        { step: 3, description: 'Incorporar la leche' }
      ],
      tags: ['test', 'simple'],
      images: [], // Sin imágenes
      sourceUrl: null
    };

    console.log('📝 Generando PDF con servicio real...');

    const pdfBuffer = await PdfGeneratorService.generateRecipePdf(testRecipe as any);

    console.log(`✅ PDF con servicio real generado. Tamaño: ${pdfBuffer.length} bytes`);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="recipe-test.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);

  } catch (error) {
    console.error('❌ Error en test PDF con servicio real:', error);
    res.status(500).json({
      error: 'Error generando PDF con servicio real',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// Test endpoint con PDFKit (SOLUCIÓN REAL)
router.get('/test-pdfkit', async (req, res) => {
  console.log('🧪 Test PDFKit endpoint called');

  try {
    // Receta de prueba
    const testRecipe = {
      id: 'test-pdfkit',
      title: 'Pancakes Clásicos',
      description: 'Deliciosos pancakes esponjosos para el desayuno',
      prepTime: 10,
      cookTime: 15,
      servings: 4,
      difficulty: 'Fácil',
      ingredients: [
        { name: 'Harina', amount: '200', unit: 'g' },
        { name: 'Huevos', amount: '2', unit: 'unidades' },
        { name: 'Leche', amount: '300', unit: 'ml' },
        { name: 'Azúcar', amount: '2', unit: 'cucharadas' },
        { name: 'Sal', amount: '1', unit: 'pizca' },
        { name: 'Mantequilla', amount: '30', unit: 'g' }
      ],
      instructions: [
        {
          step: 1,
          description: 'Mezclar la harina, azúcar y sal en un bowl grande',
          thermomixSettings: { time: '10 seg', speed: '4' }
        },
        {
          step: 2,
          description: 'En otro bowl, batir los huevos y agregar la leche'
        },
        {
          step: 3,
          description: 'Combinar los ingredientes húmedos con los secos hasta obtener una masa homogénea'
        },
        {
          step: 4,
          description: 'Calentar una sartén antiadherente y cocinar los pancakes por 2-3 minutos de cada lado',
          thermomixSettings: { temperature: 'Media', time: '3 min' }
        }
      ],
      tags: ['desayuno', 'dulce', 'fácil', 'thermomix'],
      images: [],
      sourceUrl: 'https://tastebox.local/recetas/pancakes'
    };

    console.log('📝 Generando PDF con PDFKit mejorado...');

    const pdfBuffer = await PdfKitService.generateRecipePdf(testRecipe as any);

    console.log(`✅ PDF con PDFKit mejorado generado. Tamaño: ${pdfBuffer.length} bytes`);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="pdfkit-test.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);

  } catch (error) {
    console.error('❌ Error en test PDFKit:', error);
    res.status(500).json({
      error: 'Error generando PDF con PDFKit',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

export default router;
