import express from 'express';
import multer from 'multer';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { DocxProcessor } from '../services/docxProcessor';
import { LLMServiceImproved } from '../services/llmServiceImproved';
import {
  DocxUploadResponse,
  DocxExtractRequest,
  DocxExtractResponse,
  DocxExtractedRecipe
} from '../types/docx';

const router = express.Router();

// Initialize services
const docxProcessor = new DocxProcessor();
const llmService = new LLMServiceImproved();

// Configure multer for DOCX uploads
const storage = multer.memoryStorage();

const fileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  // Only allow DOCX files
  if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.originalname.toLowerCase().endsWith('.docx')) {
    cb(null, true);
  } else {
    cb(new Error('Only .docx files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit for DOCX files
  }
});

// Validation schemas
const extractSchema = z.object({
  fileId: z.string(),
  startPage: z.number().min(1),
  endPage: z.number().min(1)
}).refine((data) => data.startPage <= data.endPage, {
  message: "Start page must be less than or equal to end page"
});

const saveRecipeSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  ingredients: z.array(z.object({
    name: z.string(),
    amount: z.string(),
    unit: z.string().optional(),
    order: z.number()
  })),
  instructions: z.array(z.object({
    step: z.number(),
    description: z.string(),
    time: z.string().optional(),
    temperature: z.string().optional(),
    speed: z.string().optional()
  })),
  prepTime: z.number().optional(),
  cookTime: z.number().optional(),
  servings: z.number().optional(),
  difficulty: z.string().optional(),
  recipeType: z.string().optional(),
  tags: z.array(z.string()).optional(),
  images: z.array(z.object({
    url: z.string(),
    localPath: z.string().optional(),
    order: z.number(),
    altText: z.string().optional()
  })).optional()
});

/**
 * Upload DOCX file and get basic info
 * POST /import/docx/upload
 */
router.post('/upload', authenticateToken, upload.single('docx'), async (req: AuthRequest, res) => {
  try {
    console.log('📤 DOCX upload request received');

    const file = req.file;
    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No DOCX file provided'
      });
    }

    console.log(`📄 Processing file: ${file.originalname} (${file.size} bytes)`);

    // Store file temporarily and process
    const fileId = await docxProcessor.storeTemporaryFile(file.buffer, file.originalname);
    const processedContent = await docxProcessor.getProcessedContent(fileId);

    // Create preview (first 500 characters)
    const preview = processedContent.fullText.substring(0, 500) +
                   (processedContent.fullText.length > 500 ? '...' : '');

    const response: DocxUploadResponse = {
      success: true,
      fileId,
      totalPages: processedContent.totalPages,
      preview,
      images: processedContent.images || []
    };

    console.log(`✅ DOCX processed successfully: ${processedContent.totalPages} pages, fileId: ${fileId}`);

    res.json(response);

  } catch (error) {
    console.error('❌ DOCX upload error:', error);

    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: 'File too large. Maximum size is 50MB.'
        });
      }
    }

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al process DOCX file'
    });
  }
});

/**
 * Extract recipes from specific page range
 * POST /import/docx/extract
 */
router.post('/extract', authenticateToken, async (req: AuthRequest, res) => {
  try {
    console.log('🔍 DOCX extract request received');

    const { fileId, startPage, endPage } = extractSchema.parse(req.body);

    console.log(`📖 Extracting pages ${startPage}-${endPage} from file ${fileId}`);

    // Extract text from specified pages
    const extractedText = await docxProcessor.extractPageRange(fileId, startPage, endPage);

    console.log(`📄 Extracted ${extractedText.length} characters from pages ${startPage}-${endPage}`);

    // Use LLM to detect and extract all recipes in one go
    const detectionResult = await docxProcessor.detectRecipes(extractedText);

    console.log(`🎯 LLM detected ${detectionResult.totalDetected} recipes`);

    // Convert LLM results to our expected format
    const processedRecipes: DocxExtractedRecipe[] = detectionResult.recipes.map(recipe => ({
      id: recipe.id,
      title: recipe.title,
      content: recipe.content,
      estimatedData: recipe.estimatedData
    }));

    // Asignar a cada receta la imagen del documento que aparece más cerca de su título
    // (sirve tanto si la imagen está a la izquierda como a la derecha de la receta).
    try {
      const content = await docxProcessor.getProcessedContent(fileId);
      const htmlText = (content.htmlText || '').toLowerCase();
      const imagePositions = content.imagePositions || [];

      if (htmlText && imagePositions.length > 0 && processedRecipes.length > 0) {
        // Offset del título de cada receta (buscando en orden de aparición).
        let cursor = 0;
        const offsets = processedRecipes.map(r => {
          const t = (r.title || '').trim().toLowerCase();
          if (!t) return -1;
          const idx = htmlText.indexOf(t, cursor);
          if (idx >= 0) cursor = idx + t.length;
          return idx;
        });
        const validOffsets = offsets.map((o, i) => ({ i, o })).filter(x => x.o >= 0);

        // Cada imagen se asigna a la receta cuyo título está más cerca.
        imagePositions.forEach((pos, imgIdx) => {
          let best = -1;
          let bestDist = Infinity;
          for (const { i, o } of validOffsets) {
            const d = Math.abs(pos - o);
            if (d < bestDist) { bestDist = d; best = i; }
          }
          if (best >= 0 && processedRecipes[best].imageIndex === undefined) {
            processedRecipes[best].imageIndex = imgIdx; // primera (más cercana) imagen de esa receta
          }
        });
      }
    } catch (e) {
      console.warn('⚠️ No se pudieron asociar imágenes a las recetas:', e);
    }
    processedRecipes.forEach(r => { if (r.imageIndex === undefined) r.imageIndex = -1; });

    const response: DocxExtractResponse = {
      success: true,
      recipes: processedRecipes,
      processedPages: endPage - startPage + 1
    };

    console.log(`✅ Successfully processed ${processedRecipes.length} recipes from ${response.processedPages} pages`);

    res.json(response);

  } catch (error) {
    console.error('❌ DOCX extract error:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Solicitud inválida data',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al extract recipes from DOCX'
    });
  }
});

/**
 * Get preview of specific pages
 * POST /import/docx/preview
 */
router.post('/preview', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { fileId, startPage, endPage } = extractSchema.parse(req.body);

    console.log(`👀 Preview request for pages ${startPage}-${endPage} from file ${fileId}`);

    const extractedText = await docxProcessor.extractPageRange(fileId, startPage, endPage);

    // Limit preview to reasonable size
    const preview = extractedText.length > 5000 ?
                   extractedText.substring(0, 5000) + '\n...[truncated]' :
                   extractedText;

    res.json({
      success: true,
      preview,
      pages: endPage - startPage + 1,
      characters: extractedText.length
    });

  } catch (error) {
    console.error('❌ DOCX preview error:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Solicitud inválida data'
      });
    }

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al preview DOCX content'
    });
  }
});

/**
 * Cleanup endpoint (optional - for manual cleanup)
 * POST /import/docx/cleanup
 */
router.post('/cleanup', authenticateToken, async (req: AuthRequest, res) => {
  try {
    docxProcessor.cleanup();
    res.json({ success: true, message: 'Cleanup completed' });
  } catch (error) {
    console.error('❌ Cleanup error:', error);
    res.status(500).json({ success: false, error: 'Cleanup failed' });
  }
});

export default router;
