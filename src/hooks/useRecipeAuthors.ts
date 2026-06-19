import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/services/api';

export interface CustomAuthor {
  name: string;
  coverImage: string | null;
}

export const useRecipeAuthors = (enabled = true) => {
  const [customAuthors, setCustomAuthors] = useState<CustomAuthor[]>([]);

  const loadAuthors = useCallback(async () => {
    try {
      setCustomAuthors(await api.authors.getAll());
    } catch (error) {
      console.error('No se pudieron cargar los autores:', error);
    }
  }, []);

  useEffect(() => {
    if (enabled) loadAuthors();
  }, [enabled, loadAuthors]);

  const authors = useMemo(() => {
    const byName = new Map<string, CustomAuthor>();
    customAuthors.forEach(author => {
      const name = author.name.trim();
      if (name) byName.set(name.toLocaleLowerCase(), { name, coverImage: author.coverImage });
    });
    return Array.from(byName.values());
  }, [customAuthors]);

  const createAuthor = useCallback(async (name: string) => {
    const normalized = name.trim();
    if (!normalized) return;

    setCustomAuthors(current =>
      current.some(author => author.name.toLocaleLowerCase() === normalized.toLocaleLowerCase())
        ? current
        : [...current, { name: normalized, coverImage: null }]
    );

    try {
      const author = await api.authors.create(normalized);
      setCustomAuthors(current =>
        current.some(value => value.name.toLocaleLowerCase() === author.name.toLocaleLowerCase())
          ? current
          : [...current, { name: author.name, coverImage: null }]
      );
    } catch (error) {
      console.error('No se pudo guardar el autor:', error);
    }
  }, []);

  return { authors, createAuthor, reloadAuthors: loadAuthors };
};
