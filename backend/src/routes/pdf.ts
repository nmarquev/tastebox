import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { PdfGeneratorService } from '../services/pdfGeneratorService';
import { PdfKitService } from '../services/pdfKitService';
import { ModalPdfService } from '../services/modalPdfService';
import { resolveImageUrl } from '../utils/imageResolver';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { z } from 'zod';

const router = express.Router();
const prisma = new PrismaClient();

const multipleRecipesSchema = z.object({
  recipeIds: z.array(z.string().min(1)).min(1).max(100).refine(
    ids => new Set(ids).size === ids.length,
    'Las recetas no pueden repetirse'
  ),
  title: z.string().optional(),
  header: z.string().optional(),
  footer: z.string().optional(),
  pageNumber: z.boolean().optional(),
});

const transformRecipeForPdf = (recipe: any) => ({
  id: recipe.id,
  userId: recipe.userId,
  title: recipe.title,
  description: recipe.description || undefined,
  prepTime: recipe.prepTime || 0,
  cookTime: recipe.cookTime || undefined,
  servings: recipe.servings || 0,
  difficulty: recipe.difficulty || 'Medio',
  recipeType: recipe.recipeType || undefined,
  dishType: recipe.dishType || undefined,
  sourceUrl: recipe.sourceUrl || undefined,
  source: recipe.source || undefined,
  featured: recipe.featured ?? false,
  cooked: recipe.cooked ?? false,
  thermomix: recipe.thermomix ?? false,
  airFryer: recipe.airFryer ?? false,
  glutenFree: recipe.glutenFree ?? false,
  keto: recipe.keto ?? false,
  lowCarb: recipe.lowCarb ?? false,
  vegetarian: recipe.vegetarian ?? false,
  proteica: recipe.proteica ?? false,
  createdAt: recipe.createdAt,
  updatedAt: recipe.updatedAt,
  images: recipe.images.map((img: any) => ({
    id: img.id,
    url: resolveImageUrl(img.url),
    localPath: img.localPath || undefined,
    order: img.order,
    altText: img.altText || undefined,
  })),
  ingredients: recipe.ingredients.map((ing: any) => ({
    id: ing.id,
    name: ing.name,
    amount: ing.amount,
    unit: ing.unit || undefined,
    order: ing.order,
    section: ing.section || undefined,
  })),
  instructions: recipe.instructions.map((inst: any) => ({
    id: inst.id,
    step: inst.step,
    description: inst.description,
    section: inst.section || undefined,
    thermomixSettings: {
      time: inst.time || undefined,
      temperature: inst.temperature || undefined,
      speed: inst.speed || undefined,
    },
  })),
  tags: recipe.tags.map((tag: any) => tag.tag.name),
});

router.post('/recipes', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { recipeIds, title, header, footer, pageNumber } = multipleRecipesSchema.parse(req.body);
    const recipes = await prisma.recipe.findMany({
      where: {
        id: { in: recipeIds },
        userId,
      },
      include: {
        images: { orderBy: { order: 'asc' } },
        ingredients: { orderBy: { order: 'asc' } },
        instructions: { orderBy: { step: 'asc' } },
        tags: {
          orderBy: { order: 'asc' },
          include: { tag: true },
        },
      },
    });

    if (recipes.length !== recipeIds.length) {
      return res.status(404).json({ error: 'Una o más recetas no fueron encontradas' });
    }

    const recipesById = new Map(recipes.map(recipe => [recipe.id, recipe]));
    const mergedPdf = await PDFDocument.create();

    let isFirst = true;
    for (const recipeId of recipeIds) {
      const recipe = recipesById.get(recipeId);
      if (!recipe) continue;

      // El título de hoja solo se imprime en la primera receta (encabezado del documento).
      const recipeBuffer = await PdfKitService.generateRecipePdf(
        transformRecipeForPdf(recipe),
        { header, footer, title: isFirst ? title : undefined }
      );
      isFirst = false;
      const recipePdf = await PDFDocument.load(recipeBuffer);
      const pages = await mergedPdf.copyPages(recipePdf, recipePdf.getPageIndices());
      pages.forEach(page => mergedPdf.addPage(page));
    }

    // Número de página continuo sobre el PDF combinado.
    if (pageNumber) {
      const font = await mergedPdf.embedFont(StandardFonts.Helvetica);
      const pages = mergedPdf.getPages();
      pages.forEach((page, i) => {
        const text = `Pág. ${i + 1}`;
        const size = 9;
        const textWidth = font.widthOfTextAtSize(text, size);
        page.drawText(text, {
          x: page.getWidth() - textWidth - 40,
          y: 18,
          size,
          font,
          color: rgb(0.53, 0.53, 0.53),
        });
      });
    }

    const pdfBytes = await mergedPdf.save();
    const pdfBuffer = Buffer.from(pdfBytes);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="recetas_tastebox.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Seleccioná al menos una receta válida' });
    }
    console.error('Error generating combined PDF:', error);
    res.status(500).json({ error: 'Error al generar el PDF combinado' });
  }
});

// Generate PDF for a recipe
router.get('/recipe/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const recipeId = req.params.id;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get the recipe from database
    const recipe = await prisma.recipe.findFirst({
      where: {
        id: recipeId,
        userId: userId
      },
      include: {
        images: {
          orderBy: { order: 'asc' }
        },
        ingredients: {
          orderBy: { order: 'asc' }
        },
        instructions: {
          orderBy: { step: 'asc' }
        },
        tags: {
          orderBy: { order: 'asc' },
          include: { tag: true }
        }
      }
    });

    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    // Transform the recipe data to match our expected format
    const transformedRecipe = {
      id: recipe.id,
      userId: recipe.userId,
      title: recipe.title,
      description: recipe.description || undefined,
      prepTime: recipe.prepTime || 0,
      cookTime: recipe.cookTime || undefined,
      servings: recipe.servings || 0,
      difficulty: recipe.difficulty as "Fácil" | "Medio" | "Difícil",
      recipeType: recipe.recipeType || undefined,
      dishType: recipe.dishType || undefined,
      sourceUrl: recipe.sourceUrl || undefined,
      featured: recipe.featured ?? false,
      cooked: recipe.cooked ?? false,
      thermomix: recipe.thermomix ?? false,
      airFryer: recipe.airFryer ?? false,
      glutenFree: recipe.glutenFree ?? false,
      keto: recipe.keto ?? false,
      lowCarb: recipe.lowCarb ?? false,
      vegetarian: recipe.vegetarian ?? false,
      proteica: recipe.proteica ?? false,
      createdAt: recipe.createdAt,
      updatedAt: recipe.updatedAt,
      images: recipe.images.map(img => ({
        id: img.id,
        url: resolveImageUrl(img.url),
        localPath: img.localPath || undefined,
        order: img.order,
        altText: img.altText || undefined
      })),
      ingredients: recipe.ingredients.map(ing => ({
        id: ing.id,
        name: ing.name,
        amount: ing.amount,
        unit: ing.unit || undefined,
        order: ing.order
      })),
      instructions: recipe.instructions.map(inst => ({
        id: inst.id,
        step: inst.step,
        description: inst.description,
        thermomixSettings: {
          time: inst.time || undefined,
          temperature: inst.temperature || undefined,
          speed: inst.speed || undefined
        }
      })),
      tags: recipe.tags.map(tag => tag.tag.name)
    };

    // Generate PDF with PDFKit (funciona siempre, diseño mejorado)
    const pdfBuffer = await PdfKitService.generateRecipePdf(transformedRecipe);

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${recipe.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    // Send the PDF
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({
      error: 'Error al generate PDF',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

export default router;
