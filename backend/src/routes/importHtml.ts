import express from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { LLMServiceImproved } from '../services/llmServiceImproved';
import { ImageService } from '../services/imageService';
import { detectImportSource, getAuthorFromSourceUrl } from '../utils/importSource';
import { getRecipeTags } from '../utils/recipeTags';
import { normalizeInstructionDescription, normalizeRecipeTitle } from '../utils/recipeText';
import { sanitizeSuggestionText } from '../utils/suggestions';
import { mentionsGlutenFree } from '../utils/dietaryFeatures';

const router = express.Router();
const prisma = new PrismaClient();

// Validation schema for HTML import
const importHtmlSchema = z.object({
  html: z.string().min(100), // Ensure we have substantial HTML content
  renderedText: z.string().optional(),
  url: z.string().url(),
  title: z.string().optional() // Page title if available
});

// Initialize services
const llmService = new LLMServiceImproved();
const imageService = new ImageService();

function getImportedSourceUrl(html: string, originalUrl: string): string {
  try {
    if (!/(^|\.)instagram\.com$/i.test(new URL(originalUrl).hostname)) {
      return originalUrl;
    }

    return html.match(
      /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i
    )?.[1] || originalUrl;
  } catch {
    return originalUrl;
  }
}

// Import recipe from HTML content (for bookmarklet)
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { html, renderedText, url, title } = importHtmlSchema.parse(req.body);

    console.log('\n🔖 BOOKMARKLET RECIPE IMPORT');
    console.log('📍 Source URL:', url);
    console.log('📄 Page title:', title || 'Unknown');
    console.log('📏 HTML content length:', html.length, 'characters');

    // Step 1: Extract recipe data from HTML using LLM
    console.log('🤖 Extracting recipe data from HTML...');
    const recipeData = await llmService.extractRecipeFromHtml(html, url, renderedText);

    console.log(`✅ Extracted recipe: "${recipeData.title}"`);
    console.log(`🖼️ Found ${recipeData.images.length} images`);

    // Step 2: Download and process images (if any)
    let processedImages: any[] = [];
    if (recipeData.images.length > 0) {
      console.log('📥 Downloading and processing images...');
      try {
        const imageUrls = recipeData.images.map(img => img.url);
        processedImages = await imageService.downloadAndStoreImages(imageUrls);
        console.log(`📸 Procesadas exitosamente ${processedImages.length} imágenes`);
      } catch (imageError) {
        console.error('❌ Error al procesar imágenes:', imageError);
        // Continuar sin imágenes si fallan al descargar
      }
    }
    if (processedImages.length === 0) {
      const fallbackImage = await imageService.findAndStoreRecipeImage(recipeData.title);
      if (fallbackImage) processedImages = [fallbackImage];
    }

    // Step 3: Save recipe to database
    console.log('💾 Saving recipe to database...');
    const importedSourceUrl = getImportedSourceUrl(html, url);
    const glutenFree = recipeData.glutenFree === true || mentionsGlutenFree(recipeData);
    const recipeTags = getRecipeTags(
      recipeData.tags,
      recipeData.ingredients,
      recipeData.title,
      {
        glutenFree,
        lowCarb: recipeData.lowCarb,
        keto: recipeData.keto,
        vegetarian: recipeData.vegetarian,
      }
    );
    const savedRecipe = await prisma.recipe.create({
      data: {
        title: normalizeRecipeTitle(recipeData.title),
        description: recipeData.description || `Recipe imported from ${url}`,
        suggestions: sanitizeSuggestionText(recipeData.suggestions),
        prepTime: recipeData.prepTime,
        cookTime: recipeData.cookTime,
        servings: recipeData.servings,
        difficulty: recipeData.difficulty,
        recipeType: recipeData.recipeType,
        country: recipeData.country,
        language: recipeData.language || 'Español',
        sourceUrl: importedSourceUrl,
        author: getAuthorFromSourceUrl(importedSourceUrl),
        importedFrom: detectImportSource(importedSourceUrl),
        userId: req.user!.id,
        thermomix: recipeData.thermomix ?? false,
        airFryer: recipeData.airFryer ?? false,
        glutenFree,
        keto: recipeData.keto ?? false,
        lowCarb: recipeData.lowCarb ?? false,
        vegetarian: recipeData.vegetarian ?? false,
        // Nutrición exacta de Cookidoo (si vino en el HTML)
        calories: recipeData.nutrition?.calories,
        protein: recipeData.nutrition?.protein,
        carbohydrates: recipeData.nutrition?.carbohydrates,
        fat: recipeData.nutrition?.fat,
        saturatedFat: recipeData.nutrition?.saturatedFat,
        fiber: recipeData.nutrition?.fiber,
        sugar: recipeData.nutrition?.sugar,
        sodium: recipeData.nutrition?.sodium,
        images: {
          create: processedImages.map(img => ({
            url: img.url,
            localPath: img.localPath,
            order: img.order,
            altText: img.altText
          }))
        },
        ingredients: {
          create: recipeData.ingredients.map((ing, index) => ({
            name: ing.name,
            amount: ing.amount,
            unit: ing.unit,
            order: index + 1,
            section: ing.section || undefined
          }))
        },
        instructions: {
          create: recipeData.instructions.map(inst => ({
            step: inst.step,
            description: normalizeInstructionDescription(inst.description),
            function: inst.function || undefined,
            time: inst.time || undefined,
            temperature: inst.temperature || undefined,
            speed: inst.speed || undefined,
            section: inst.section || undefined
          }))
        },
        tags: {
          create: recipeTags.map((tagName, index) => ({
            order: index + 1,
            tag: {
              connectOrCreate: {
                where: { name: tagName },
                create: { name: tagName }
              }
            }
          }))
        }
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
          include: {
            tag: true
          }
        }
      }
    });

    console.log(`✅ Recipe "${savedRecipe.title}" saved to database with ID: ${savedRecipe.id}`);
    console.log('🎉 Bookmarklet import completed successfully!');

    // Transform the data to match frontend interface
    const transformedRecipe = {
      ...savedRecipe,
      tags: savedRecipe.tags.map(rt => rt.tag.name),
      instructions: savedRecipe.instructions.map(instruction => ({
        ...instruction,
        thermomixSettings: {
          function: instruction.function,
          time: instruction.time,
          temperature: instruction.temperature,
          speed: instruction.speed
        }
      }))
    };

    res.status(201).json({
      success: true,
      recipe: transformedRecipe,
      saved: true,
      message: `Recipe "${savedRecipe.title}" imported and saved successfully from bookmarklet`
    });

  } catch (error) {
    console.error('💥 Error en importación HTML:', error);

    let errorMessage = 'Error al importar receta desde HTML';
    let statusCode = 500;

    if (error instanceof z.ZodError) {
      errorMessage = 'Datos HTML inválidos proporcionados';
      statusCode = 400;
      console.error('📋 Errores de validación:', error.errors);
    } else if (error instanceof Error) {
      errorMessage = error.message;
      if (error.message.includes('No valid recipe found')) {
        statusCode = 404;
      }
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// Health check for bookmarklet
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'HTML Recipe Import API',
    timestamp: new Date().toISOString()
  });
});

export default router;
