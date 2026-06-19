import express from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();
const separator = '|';

router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const [savedCategories, recipes] = await Promise.all([
      prisma.recipeCategory.findMany({
        where: { userId: req.user!.id },
        orderBy: { name: 'asc' }
      }),
      prisma.recipe.findMany({
        where: {
          userId: req.user!.id,
          recipeType: { not: null }
        },
        select: { recipeType: true }
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

    savedCategories.forEach(category => addName(category.name, category.coverImage));
    recipes.forEach(recipe => {
      (recipe.recipeType || '').split(separator).forEach(value => addName(value));
    });

    res.json(
      Array.from(byKey.values()).sort((a, b) => a.name.localeCompare(b.name, 'es'))
    );
  } catch (error) {
    console.error('Error loading recipe categories:', error);
    res.status(500).json({ error: 'No se pudieron cargar las categorías' });
  }
});

router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { name } = z.object({ name: z.string().trim().min(1).max(80) }).parse(req.body);
    const userCategories = await prisma.recipeCategory.findMany({
      where: { userId: req.user!.id }
    });
    const existing = userCategories.find(
      category => category.name.toLocaleLowerCase() === name.toLocaleLowerCase()
    );

    const category = existing || await prisma.recipeCategory.create({
      data: { userId: req.user!.id, name }
    });

    res.status(existing ? 200 : 201).json(category);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Nombre de categoría inválido' });
    }
    console.error('Error creating recipe category:', error);
    res.status(500).json({ error: 'No se pudo crear la categoría' });
  }
});

// Cambiar la portada de una categoría (crea el registro si no existía).
router.patch('/:name', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const name = decodeURIComponent(req.params.name).trim();
    if (!name) return res.status(400).json({ error: 'Nombre de categoría inválido' });
    const { coverImage } = z.object({
      coverImage: z.string().trim().min(1).nullable()
    }).parse(req.body);

    const existing = (await prisma.recipeCategory.findMany({
      where: { userId: req.user!.id }
    })).find(cat => cat.name.toLocaleLowerCase() === name.toLocaleLowerCase());

    const category = existing
      ? await prisma.recipeCategory.update({ where: { id: existing.id }, data: { coverImage } })
      : await prisma.recipeCategory.create({ data: { userId: req.user!.id, name, coverImage } });

    res.json(category);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Datos de la categoría no válidos' });
    }
    console.error('Error updating recipe category:', error);
    res.status(500).json({ error: 'No se pudo actualizar la categoría' });
  }
});

// Eliminar una categoría: borra el registro guardado y la quita del campo
// recipeType de las recetas (las recetas se mantienen).
router.delete('/:name', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const name = decodeURIComponent(req.params.name).trim();
    if (!name) return res.status(400).json({ error: 'Nombre de categoría inválido' });
    const lower = name.toLocaleLowerCase();

    const saved = (await prisma.recipeCategory.findMany({
      where: { userId: req.user!.id }
    })).filter(cat => cat.name.toLocaleLowerCase() === lower);

    // Recetas que contienen esta categoría en su recipeType.
    const recipes = await prisma.recipe.findMany({
      where: { userId: req.user!.id, recipeType: { not: null } },
      select: { id: true, recipeType: true }
    });

    const recipeUpdates = recipes
      .map(recipe => {
        const cats = (recipe.recipeType || '').split(separator).map(s => s.trim()).filter(Boolean);
        if (!cats.some(c => c.toLocaleLowerCase() === lower)) return null;
        const remaining = cats.filter(c => c.toLocaleLowerCase() !== lower);
        return prisma.recipe.update({
          where: { id: recipe.id },
          data: { recipeType: remaining.length ? remaining.join(separator) : null }
        });
      })
      .filter((u): u is NonNullable<typeof u> => u !== null);

    await prisma.$transaction([
      ...saved.map(cat => prisma.recipeCategory.delete({ where: { id: cat.id } })),
      ...recipeUpdates
    ]);

    res.json({ success: true, name });
  } catch (error) {
    console.error('Error deleting recipe category:', error);
    res.status(500).json({ error: 'No se pudo eliminar la categoría' });
  }
});

export default router;
