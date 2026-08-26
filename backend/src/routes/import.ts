import express from 'express';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { LLMService } from '../services/llmService';
import { ImageService } from '../services/imageService';

const router = express.Router();

// Validation schema
const importUrlSchema = z.object({
  url: z.string().url()
});

// Initialize services
const llmService = new LLMService();
const imageService = new ImageService();

// Import recipe from URL
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { url } = importUrlSchema.parse(req.body);

    console.log(`Starting recipe import from: ${url}`);

    // Step 1: Extract recipe data with LLM
    console.log('Extracting recipe data with LLM...');
    const recipeData = await llmService.extractRecipeFromUrl(url);

    console.log(`Extracted recipe: ${recipeData.title}`);
    console.log(`Found ${recipeData.images.length} images`);

    // Step 2: Download and process images
    let processedImages: any[] = [];
    if (recipeData.images.length > 0) {
      console.log('Downloading and processing images...');
      try {
        const imageUrls = recipeData.images.map(img => img.url);
        processedImages = await imageService.downloadAndStoreImages(imageUrls);
        console.log(`Successfully processed ${processedImages.length} images`);
      } catch (imageError) {
        console.error('Error al procesar imágenes:', imageError);
        // Continue without images if they fail
      }
    }

    // Step 3: Prepare response data
    const responseData = {
      title: recipeData.title,
      description: recipeData.description,
      prepTime: recipeData.prepTime,
      cookTime: recipeData.cookTime,
      servings: recipeData.servings,
      servingsText: recipeData.servingsText,
      difficulty: recipeData.difficulty,
      recipeType: recipeData.recipeType,
      sourceUrl: url,
      images: processedImages.map(img => ({
        url: img.url,
        localPath: img.localPath,
        order: img.order,
        altText: img.altText
      })),
      ingredients: recipeData.ingredients,
      instructions: recipeData.instructions.map(inst => ({
        step: inst.step,
        description: inst.description,
        time: undefined,
        temperature: undefined,
        speed: undefined
      })),
      tags: recipeData.tags
    };

    res.json({
      success: true,
      recipe: responseData,
      preview: true // Indicates this needs user confirmation before saving
    });

  } catch (error) {
    console.error('Import error:', error);

    let errorMessage = 'Error al import recipe';
    let statusCode = 500;

    if (error instanceof z.ZodError) {
      errorMessage = 'URL inválida provided';
      statusCode = 400;
    } else if (error instanceof Error) {
      errorMessage = error.message;
      if (error.message.includes('No valid recipe found')) {
        statusCode = 404;
      } else if (error.message.includes('Error al fetch')) {
        statusCode = 400;
      }
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage
    });
  }
});

// Validate URL endpoint (for frontend validation)
router.post('/validate-url', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { url } = importUrlSchema.parse(req.body);

    // Basic URL validation
    try {
      const response = await fetch(url, { method: 'HEAD' });
      const isValidUrl = response.ok;

      res.json({
        valid: isValidUrl,
        status: response.status,
        contentType: response.headers.get('content-type')
      });
    } catch (error) {
      res.json({
        valid: false,
        error: 'URL not accessible'
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'URL inválida format' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
