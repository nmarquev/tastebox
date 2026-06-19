import express from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

const createCollectionSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

const updateCollectionSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  coverImage: z.string().trim().min(1).nullable().optional(),
}).refine(
  data => data.name !== undefined || data.coverImage !== undefined,
  'Nada para actualizar'
);

const addRecipeSchema = z.object({
  recipeId: z.string().min(1),
});

const reorderRecipeCollectionsSchema = z.object({
  collectionIds: z.array(z.string().min(1)).refine(
    ids => new Set(ids).size === ids.length,
    'Las colecciones no pueden repetirse'
  ),
});

router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const collections = await prisma.collection.findMany({
      where: { userId: req.user!.id },
      orderBy: { name: 'asc' },
      include: {
        recipes: {
          select: { recipeId: true, order: true },
        },
      },
    });

    res.json(collections.map(collection => ({
      id: collection.id,
      name: collection.name,
      coverImage: collection.coverImage,
      recipeIds: collection.recipes.map(item => item.recipeId),
      recipeOrders: Object.fromEntries(
        collection.recipes.map(item => [item.recipeId, item.order])
      ),
      recipeCount: collection.recipes.length,
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt,
    })));
  } catch (error) {
    console.error('List collections error:', error);
    res.status(500).json({ error: 'No se pudieron cargar las colecciones' });
  }
});

router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { name } = createCollectionSchema.parse(req.body);
    const collection = await prisma.collection.create({
      data: {
        name,
        userId: req.user!.id,
      },
    });

    res.status(201).json({
      ...collection,
      recipeIds: [],
      recipeOrders: {},
      recipeCount: 0,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'El nombre de la colección es requerido' });
    }
    if (error?.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe una colección con ese nombre' });
    }
    console.error('Create collection error:', error);
    res.status(500).json({ error: 'No se pudo crear la colección' });
  }
});

// Actualizar nombre y/o portada de una colección.
router.patch('/:collectionId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const data = updateCollectionSchema.parse(req.body);
    const collection = await prisma.collection.findFirst({
      where: { id: req.params.collectionId, userId: req.user!.id },
    });

    if (!collection) {
      return res.status(404).json({ error: 'Colección no encontrada' });
    }

    const updated = await prisma.collection.update({
      where: { id: collection.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.coverImage !== undefined ? { coverImage: data.coverImage } : {}),
      },
      include: {
        recipes: { select: { recipeId: true, order: true } },
      },
    });

    res.json({
      id: updated.id,
      name: updated.name,
      coverImage: updated.coverImage,
      recipeIds: updated.recipes.map(item => item.recipeId),
      recipeOrders: Object.fromEntries(
        updated.recipes.map(item => [item.recipeId, item.order])
      ),
      recipeCount: updated.recipes.length,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Datos de la colección no válidos' });
    }
    if (error?.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe una colección con ese nombre' });
    }
    console.error('Update collection error:', error);
    res.status(500).json({ error: 'No se pudo actualizar la colección' });
  }
});

// Eliminar una colección (las recetas NO se eliminan, solo la colección y sus vínculos).
router.delete('/:collectionId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const collection = await prisma.collection.findFirst({
      where: { id: req.params.collectionId, userId: req.user!.id },
    });

    if (!collection) {
      return res.status(404).json({ error: 'Colección no encontrada' });
    }

    // Al borrar la colección, CollectionRecipe se elimina en cascada,
    // pero las recetas en sí permanecen intactas.
    await prisma.collection.delete({ where: { id: collection.id } });

    res.json({ success: true, collectionId: collection.id });
  } catch (error) {
    console.error('Delete collection error:', error);
    res.status(500).json({ error: 'No se pudo eliminar la colección' });
  }
});

router.post('/:collectionId/recipes', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { recipeId } = addRecipeSchema.parse(req.body);
    const [collection, recipe] = await Promise.all([
      prisma.collection.findFirst({
        where: { id: req.params.collectionId, userId: req.user!.id },
      }),
      prisma.recipe.findFirst({
        where: { id: recipeId, userId: req.user!.id },
      }),
    ]);

    if (!collection || !recipe) {
      return res.status(404).json({ error: 'Colección o receta no encontrada' });
    }

    await prisma.collectionRecipe.upsert({
      where: {
        collectionId_recipeId: {
          collectionId: collection.id,
          recipeId: recipe.id,
        },
      },
      update: {},
      create: {
        collectionId: collection.id,
        recipeId: recipe.id,
      },
    });

    res.json({
      success: true,
      collectionId: collection.id,
      recipeId: recipe.id,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'La receta es requerida' });
    }
    console.error('Add recipe to collection error:', error);
    res.status(500).json({ error: 'No se pudo guardar la receta en la colección' });
  }
});

router.put('/recipes/:recipeId/order', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { collectionIds } = reorderRecipeCollectionsSchema.parse(req.body);
    const recipe = await prisma.recipe.findFirst({
      where: {
        id: req.params.recipeId,
        userId: req.user!.id,
      },
    });

    if (!recipe) {
      return res.status(404).json({ error: 'Receta no encontrada' });
    }

    const ownedCollections = await prisma.collection.findMany({
      where: {
        id: { in: collectionIds },
        userId: req.user!.id,
      },
      select: { id: true },
    });

    if (ownedCollections.length !== collectionIds.length) {
      return res.status(404).json({ error: 'Una o más colecciones no fueron encontradas' });
    }

    await prisma.$transaction(
      collectionIds.map((collectionId, index) =>
        prisma.collectionRecipe.updateMany({
          where: {
            collectionId,
            recipeId: recipe.id,
          },
          data: { order: index + 1 },
        })
      )
    );

    res.json({
      success: true,
      recipeId: recipe.id,
      collectionIds,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'El orden de colecciones no es válido' });
    }
    console.error('Reorder recipe collections error:', error);
    res.status(500).json({ error: 'No se pudo guardar el orden de las colecciones' });
  }
});

router.delete('/:collectionId/recipes/:recipeId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const collection = await prisma.collection.findFirst({
      where: {
        id: req.params.collectionId,
        userId: req.user!.id,
      },
    });

    if (!collection) {
      return res.status(404).json({ error: 'Colección no encontrada' });
    }

    await prisma.collectionRecipe.deleteMany({
      where: {
        collectionId: collection.id,
        recipeId: req.params.recipeId,
        recipe: {
          userId: req.user!.id,
        },
      },
    });

    res.json({
      success: true,
      collectionId: collection.id,
      recipeId: req.params.recipeId,
    });
  } catch (error) {
    console.error('Remove recipe from collection error:', error);
    res.status(500).json({ error: 'No se pudo quitar la receta de la colección' });
  }
});

export default router;
