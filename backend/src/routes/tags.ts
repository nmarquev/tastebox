import express from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Devuelve las etiquetas con metadatos guardados (portada). Las etiquetas en sí
// (y su cantidad) se calculan en el frontend a partir de las recetas.
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const saved = await prisma.recipeTagMeta.findMany({
      where: { userId: req.user!.id },
      orderBy: { name: 'asc' }
    });

    const byKey = new Map<string, { name: string; coverImage: string | null }>();
    saved.forEach(tag => {
      const name = tag.name.trim();
      if (name) byKey.set(name.toLocaleLowerCase(), { name, coverImage: tag.coverImage });
    });

    res.json(Array.from(byKey.values()).sort((a, b) => a.name.localeCompare(b.name, 'es')));
  } catch (error) {
    console.error('Error loading recipe tags:', error);
    res.status(500).json({ error: 'No se pudieron cargar las etiquetas' });
  }
});

router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { name } = z.object({ name: z.string().trim().min(1).max(120) }).parse(req.body);
    const existing = (await prisma.recipeTagMeta.findMany({ where: { userId: req.user!.id } }))
      .find(t => t.name.toLocaleLowerCase() === name.toLocaleLowerCase());

    const tag = existing || await prisma.recipeTagMeta.create({
      data: { userId: req.user!.id, name }
    });

    res.status(existing ? 200 : 201).json(tag);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Nombre de etiqueta inválido' });
    }
    console.error('Error creating recipe tag:', error);
    res.status(500).json({ error: 'No se pudo crear la etiqueta' });
  }
});

// Cambiar la portada de una etiqueta (crea el registro si no existía).
router.patch('/:name', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const name = decodeURIComponent(req.params.name).trim();
    if (!name) return res.status(400).json({ error: 'Nombre de etiqueta inválido' });
    const { coverImage } = z.object({ coverImage: z.string().trim().min(1).nullable() }).parse(req.body);

    const existing = (await prisma.recipeTagMeta.findMany({ where: { userId: req.user!.id } }))
      .find(t => t.name.toLocaleLowerCase() === name.toLocaleLowerCase());

    const tag = existing
      ? await prisma.recipeTagMeta.update({ where: { id: existing.id }, data: { coverImage } })
      : await prisma.recipeTagMeta.create({ data: { userId: req.user!.id, name, coverImage } });

    res.json(tag);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Datos de la etiqueta no válidos' });
    }
    console.error('Error updating recipe tag:', error);
    res.status(500).json({ error: 'No se pudo actualizar la etiqueta' });
  }
});

// Eliminar una etiqueta: borra su metadato y la quita de las recetas del usuario
// (elimina las relaciones RecipeTag de las recetas propias; las recetas se mantienen).
router.delete('/:name', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const name = decodeURIComponent(req.params.name).trim();
    if (!name) return res.status(400).json({ error: 'Nombre de etiqueta inválido' });
    const lower = name.toLocaleLowerCase();

    const savedMeta = (await prisma.recipeTagMeta.findMany({ where: { userId: req.user!.id } }))
      .filter(t => t.name.toLocaleLowerCase() === lower);

    // Buscar el/los Tag globales que coincidan por nombre (case-insensitive).
    const tags = (await prisma.tag.findMany()).filter(t => t.name.toLocaleLowerCase() === lower);
    const userRecipeIds = (await prisma.recipe.findMany({
      where: { userId: req.user!.id },
      select: { id: true }
    })).map(r => r.id);

    await prisma.$transaction([
      ...savedMeta.map(m => prisma.recipeTagMeta.delete({ where: { id: m.id } })),
      ...tags.map(t => prisma.recipeTag.deleteMany({
        where: { tagId: t.id, recipeId: { in: userRecipeIds } }
      })),
    ]);

    res.json({ success: true, name });
  } catch (error) {
    console.error('Error deleting recipe tag:', error);
    res.status(500).json({ error: 'No se pudo eliminar la etiqueta' });
  }
});

export default router;
