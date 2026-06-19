import express from 'express';
import multer from 'multer';
import path from 'path';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { ImageService } from '../services/imageService';

const router = express.Router();
const imageService = new ImageService();

// Configure multer for file uploads
const storage = multer.memoryStorage();

const fileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  // Verificar si el archivo es una imagen
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos de imagen'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024 // Límite de 2MB por imagen
  }
});

// Endpoint de carga de imágenes
router.post('/images', authenticateToken, upload.array('images', 3), async (req: AuthRequest, res) => {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron imágenes' });
    }

    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const processedImages = [];

    for (let i = 0; i < Math.min(files.length, 3); i++) {
      const file = files[i];

      // Generar nombre de archivo único
      const fileExtension = path.extname(file.originalname) || '.jpg';
      const filename = `recipe-${randomUUID()}-${i + 1}${fileExtension}`;
      const filePath = path.join(uploadDir, filename);

      try {
        // Procesar imagen con Sharp
        await sharp(file.buffer)
          .resize(800, 600, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({
            quality: 85,
            progressive: true
          })
          .toFile(filePath);

        processedImages.push({
          url: `/uploads/${filename}`,
          localPath: filename,
          order: i + 1,
          altText: `Imagen de receta ${i + 1}`
        });
      } catch (error) {
        console.error(`Error procesando imagen ${i + 1}:`, error);
        // Continuar con otras imágenes aunque una falle
      }
    }

    res.json({
      success: true,
      images: processedImages
    });
  } catch (error) {
    console.error('Error de carga:', error);

    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'La imagen debe tener un tamaño menor a 2MB' });
      }
    }

    res.status(500).json({ error: 'Error al cargar las imágenes' });
  }
});

// Descargar y guardar una imagen a partir de su URL (ej: arrastrada desde la web).
router.post('/images/from-url', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const url = (req.body?.url ?? '').toString().trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      return res.status(400).json({ error: 'URL de imagen inválida' });
    }

    const images = await imageService.downloadAndStoreImages([url]);
    if (!images.length) {
      return res.status(404).json({ error: 'No se pudo descargar la imagen desde esa URL' });
    }

    const image = images[0];
    res.json({
      success: true,
      image: {
        url: image.url,
        localPath: image.localPath,
        order: image.order,
        altText: image.altText || 'Imagen',
      },
    });
  } catch (error) {
    console.error('Error agregando imagen por URL:', error);
    res.status(500).json({ error: 'Error al agregar la imagen' });
  }
});

// Buscar una imagen en la web a partir del nombre de la receta y guardarla.
router.post('/images/search', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const query = (req.body?.query ?? '').toString().trim();
    if (!query) {
      return res.status(400).json({ error: 'Falta el nombre de la receta' });
    }

    const image = await imageService.findAndStoreRecipeImage(query);
    if (!image) {
      return res.status(404).json({ error: 'No se encontró ninguna imagen para esa receta' });
    }

    res.json({
      success: true,
      image: {
        url: image.url,
        localPath: image.localPath,
        order: image.order,
        altText: image.altText || query,
      },
    });
  } catch (error) {
    console.error('Error buscando imagen en la web:', error);
    res.status(500).json({ error: 'Error al buscar la imagen' });
  }
});

export default router;