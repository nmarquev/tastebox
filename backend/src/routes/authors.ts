import express from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const [savedAuthors, recipes] = await Promise.all([
      prisma.recipeAuthor.findMany({
        where: { userId: req.user!.id },
        orderBy: { name: 'asc' }
      }),
      prisma.recipe.findMany({
        where: {
          userId: req.user!.id,
          author: { not: null }
        },
        select: { author: true }
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

    savedAuthors.forEach(author => addName(author.name, author.coverImage));
    recipes.forEach(recipe => addName(recipe.author || ''));

    res.json(
      Array.from(byKey.values()).sort((a, b) => a.name.localeCompare(b.name, 'es'))
    );
  } catch (error) {
    console.error('Error loading recipe authors:', error);
    res.status(500).json({ error: 'No se pudieron cargar los autores' });
  }
});

router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { name } = z.object({ name: z.string().trim().min(1).max(120) }).parse(req.body);
    const userAuthors = await prisma.recipeAuthor.findMany({
      where: { userId: req.user!.id }
    });
    const existing = userAuthors.find(
      author => author.name.toLocaleLowerCase() === name.toLocaleLowerCase()
    );

    const author = existing || await prisma.recipeAuthor.create({
      data: { userId: req.user!.id, name }
    });

    res.status(existing ? 200 : 201).json(author);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Nombre de autor inválido' });
    }
    console.error('Error creating recipe author:', error);
    res.status(500).json({ error: 'No se pudo crear el autor' });
  }
});

// Cambiar la portada de un autor (crea el registro si no existía).
router.patch('/:name', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const name = decodeURIComponent(req.params.name).trim();
    if (!name) return res.status(400).json({ error: 'Nombre de autor inválido' });
    const { coverImage } = z.object({
      coverImage: z.string().trim().min(1).nullable()
    }).parse(req.body);

    const existing = (await prisma.recipeAuthor.findMany({
      where: { userId: req.user!.id }
    })).find(a => a.name.toLocaleLowerCase() === name.toLocaleLowerCase());

    const author = existing
      ? await prisma.recipeAuthor.update({ where: { id: existing.id }, data: { coverImage } })
      : await prisma.recipeAuthor.create({ data: { userId: req.user!.id, name, coverImage } });

    res.json(author);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Datos del autor no válidos' });
    }
    console.error('Error updating recipe author:', error);
    res.status(500).json({ error: 'No se pudo actualizar el autor' });
  }
});

// Eliminar un autor: borra el registro guardado y quita la etiqueta de las
// recetas que lo tenían (las recetas se mantienen).
router.delete('/:name', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const name = decodeURIComponent(req.params.name).trim();
    if (!name) return res.status(400).json({ error: 'Nombre de autor inválido' });

    const saved = (await prisma.recipeAuthor.findMany({
      where: { userId: req.user!.id }
    })).filter(a => a.name.toLocaleLowerCase() === name.toLocaleLowerCase());

    await prisma.$transaction([
      ...saved.map(a => prisma.recipeAuthor.delete({ where: { id: a.id } })),
      prisma.recipe.updateMany({
        where: { userId: req.user!.id, author: name },
        data: { author: null }
      })
    ]);

    res.json({ success: true, name });
  } catch (error) {
    console.error('Error deleting recipe author:', error);
    res.status(500).json({ error: 'No se pudo eliminar el autor' });
  }
});

export default router;
