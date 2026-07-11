import express from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { getSourceFromUrl } from '../utils/sourceUtils';

const router = express.Router();
const prisma = new PrismaClient();

// Devuelve las fuentes guardadas manualmente (con su portada). Las fuentes
// derivadas de las recetas se calculan en el frontend a partir de sourceUrl.
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const savedSources = await prisma.recipeSource.findMany({
      where: { userId: req.user!.id },
      orderBy: { name: 'asc' }
    });

    const byKey = new Map<string, { name: string; coverImage: string | null }>();
    savedSources.forEach(source => {
      const name = source.name.trim();
      if (name) byKey.set(name.toLocaleLowerCase(), { name, coverImage: source.coverImage });
    });

    res.json(
      Array.from(byKey.values()).sort((a, b) => a.name.localeCompare(b.name, 'es'))
    );
  } catch (error) {
    console.error('Error loading recipe sources:', error);
    res.status(500).json({ error: 'No se pudieron cargar las fuentes' });
  }
});

router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { name } = z.object({ name: z.string().trim().min(1).max(120) }).parse(req.body);
    const userSources = await prisma.recipeSource.findMany({
      where: { userId: req.user!.id }
    });
    const existing = userSources.find(
      source => source.name.toLocaleLowerCase() === name.toLocaleLowerCase()
    );

    const source = existing || await prisma.recipeSource.create({
      data: { userId: req.user!.id, name }
    });

    res.status(existing ? 200 : 201).json(source);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Nombre de fuente inválido' });
    }
    console.error('Error creating recipe source:', error);
    res.status(500).json({ error: 'No se pudo crear la fuente' });
  }
});

// Cambiar la portada de una fuente (crea el registro si no existía).
router.patch('/:name', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const name = decodeURIComponent(req.params.name).trim();
    if (!name) return res.status(400).json({ error: 'Nombre de fuente inválido' });
    const { name: nextNameInput, coverImage } = z.object({
      name: z.string().trim().min(1).max(120).optional(),
      coverImage: z.string().trim().min(1).nullable().optional()
    }).parse(req.body);
    const nextName = nextNameInput || name;
    const lower = name.toLocaleLowerCase();
    const nextLower = nextName.toLocaleLowerCase();

    const savedSources = await prisma.recipeSource.findMany({
      where: { userId: req.user!.id }
    });
    const existing = savedSources.find(s => s.name.toLocaleLowerCase() === lower);
    const existingNext = savedSources.find(s => s.name.toLocaleLowerCase() === nextLower);

    const recipeUpdates = (await prisma.recipe.findMany({
      where: {
        userId: req.user!.id,
        OR: [{ source: { not: null } }, { sourceUrl: { not: null } }]
      },
      select: { id: true, source: true, sourceUrl: true }
    }))
      .filter(recipe => {
        const explicit = (recipe.source || '').trim();
        if (explicit) return explicit.toLocaleLowerCase() === lower;
        return getSourceFromUrl(recipe.sourceUrl || '').toLocaleLowerCase() === lower;
      })
      .map(recipe => prisma.recipe.update({
        where: { id: recipe.id },
        data: { source: nextName }
      }));

    let source;
    if (existing && existingNext && existing.id !== existingNext.id) {
      source = coverImage !== undefined
        ? await prisma.recipeSource.update({
          where: { id: existingNext.id },
          data: { coverImage }
        })
        : existingNext;
      await prisma.$transaction([
        prisma.recipeSource.delete({ where: { id: existing.id } }),
        ...recipeUpdates
      ]);
    } else if (existing) {
      source = await prisma.recipeSource.update({
        where: { id: existing.id },
        data: {
          name: nextName,
          ...(coverImage !== undefined ? { coverImage } : {})
        }
      });
      if (recipeUpdates.length) await prisma.$transaction(recipeUpdates);
    } else {
      source = await prisma.recipeSource.create({
        data: {
          userId: req.user!.id,
          name: nextName,
          ...(coverImage !== undefined ? { coverImage } : {})
        }
      });
      if (recipeUpdates.length) await prisma.$transaction(recipeUpdates);
    }

    res.json(source);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Datos de la fuente no válidos' });
    }
    console.error('Error updating recipe source:', error);
    res.status(500).json({ error: 'No se pudo actualizar la fuente' });
  }
});

// Eliminar una fuente: borra el registro guardado y quita la fuente (sourceUrl)
// de las recetas cuya fuente derivada coincide (las recetas se mantienen).
router.delete('/:name', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const name = decodeURIComponent(req.params.name).trim();
    if (!name) return res.status(400).json({ error: 'Nombre de fuente inválido' });
    const lower = name.toLocaleLowerCase();

    const saved = (await prisma.recipeSource.findMany({
      where: { userId: req.user!.id }
    })).filter(s => s.name.toLocaleLowerCase() === lower);

    const recipes = await prisma.recipe.findMany({
      where: { userId: req.user!.id, sourceUrl: { not: null } },
      select: { id: true, sourceUrl: true }
    });

    const recipeUpdates = recipes
      .filter(recipe => getSourceFromUrl(recipe.sourceUrl || '').toLocaleLowerCase() === lower)
      .map(recipe => prisma.recipe.update({
        where: { id: recipe.id },
        data: { sourceUrl: null }
      }));

    await prisma.$transaction([
      ...saved.map(s => prisma.recipeSource.delete({ where: { id: s.id } })),
      ...recipeUpdates
    ]);

    res.json({ success: true, name });
  } catch (error) {
    console.error('Error deleting recipe source:', error);
    res.status(500).json({ error: 'No se pudo eliminar la fuente' });
  }
});

export default router;
