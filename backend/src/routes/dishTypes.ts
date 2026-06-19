import express from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Devuelve los tipos de receta (guardados + derivados de las recetas) con su portada.
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const [savedDishTypes, recipes] = await Promise.all([
      prisma.recipeDishType.findMany({
        where: { userId: req.user!.id },
        orderBy: { name: 'asc' }
      }),
      prisma.recipe.findMany({
        where: {
          userId: req.user!.id,
          dishType: { not: null }
        },
        select: { dishType: true }
      })
    ]);

    const byKey = new Map<string, { name: string; coverImage: string | null }>();
    const addName = (value: string, coverImage: string | null = null) => {
      const name = value.trim();
      if (!name) return;
      const key = name.toLocaleLowerCase();
      const existing = byKey.get(key);
      if (existing) {
        if (coverImage && !existing.coverImage) existing.coverImage = coverImage;
      } else {
        byKey.set(key, { name, coverImage });
      }
    };

    savedDishTypes.forEach(dishType => addName(dishType.name, dishType.coverImage));
    recipes.forEach(recipe => addName(recipe.dishType || ''));

    res.json(
      Array.from(byKey.values()).sort((a, b) => a.name.localeCompare(b.name, 'es'))
    );
  } catch (error) {
    console.error('Error loading recipe dish types:', error);
    res.status(500).json({ error: 'No se pudieron cargar los tipos de receta' });
  }
});

router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { name } = z.object({ name: z.string().trim().min(1).max(80) }).parse(req.body);
    const userDishTypes = await prisma.recipeDishType.findMany({
      where: { userId: req.user!.id }
    });
    const existing = userDishTypes.find(
      dishType => dishType.name.toLocaleLowerCase() === name.toLocaleLowerCase()
    );

    const dishType = existing || await prisma.recipeDishType.create({
      data: { userId: req.user!.id, name }
    });

    res.status(existing ? 200 : 201).json(dishType);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Nombre de tipo de receta inválido' });
    }
    console.error('Error creating recipe dish type:', error);
    res.status(500).json({ error: 'No se pudo crear el tipo de receta' });
  }
});

// Cambiar la portada de un tipo de receta (crea el registro si no existía).
router.patch('/:name', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const name = decodeURIComponent(req.params.name).trim();
    if (!name) return res.status(400).json({ error: 'Nombre de tipo de receta inválido' });
    const { coverImage } = z.object({
      coverImage: z.string().trim().min(1).nullable()
    }).parse(req.body);

    const existing = (await prisma.recipeDishType.findMany({
      where: { userId: req.user!.id }
    })).find(dt => dt.name.toLocaleLowerCase() === name.toLocaleLowerCase());

    const dishType = existing
      ? await prisma.recipeDishType.update({
          where: { id: existing.id },
          data: { coverImage }
        })
      : await prisma.recipeDishType.create({
          data: { userId: req.user!.id, name, coverImage }
        });

    res.json(dishType);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Datos del tipo de receta no válidos' });
    }
    console.error('Error updating recipe dish type:', error);
    res.status(500).json({ error: 'No se pudo actualizar el tipo de receta' });
  }
});

// Eliminar un tipo de receta: borra el registro guardado y quita la etiqueta
// de las recetas que lo tenían (las recetas se mantienen).
router.delete('/:name', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const name = decodeURIComponent(req.params.name).trim();
    if (!name) return res.status(400).json({ error: 'Nombre de tipo de receta inválido' });

    const saved = (await prisma.recipeDishType.findMany({
      where: { userId: req.user!.id }
    })).filter(dt => dt.name.toLocaleLowerCase() === name.toLocaleLowerCase());

    await prisma.$transaction([
      ...saved.map(dt => prisma.recipeDishType.delete({ where: { id: dt.id } })),
      prisma.recipe.updateMany({
        where: { userId: req.user!.id, dishType: name },
        data: { dishType: null }
      })
    ]);

    res.json({ success: true, name });
  } catch (error) {
    console.error('Error deleting recipe dish type:', error);
    res.status(500).json({ error: 'No se pudo eliminar el tipo de receta' });
  }
});

export default router;
