import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/services/api';

export interface CustomTag {
  name: string;
  coverImage: string | null;
}

export const useRecipeTags = (enabled = true) => {
  const [customTags, setCustomTags] = useState<CustomTag[]>([]);

  const loadTags = useCallback(async () => {
    try {
      setCustomTags(await api.tags.getAll());
    } catch (error) {
      console.error('No se pudieron cargar las etiquetas:', error);
    }
  }, []);

  useEffect(() => {
    if (enabled) loadTags();
  }, [enabled, loadTags]);

  const tags = useMemo(() => {
    const byName = new Map<string, CustomTag>();
    customTags.forEach(tag => {
      const name = tag.name.trim();
      if (name) byName.set(name.toLocaleLowerCase(), { name, coverImage: tag.coverImage });
    });
    return Array.from(byName.values());
  }, [customTags]);

  const createTag = useCallback(async (name: string) => {
    const normalized = name.trim();
    if (!normalized) return;

    setCustomTags(current =>
      current.some(tag => tag.name.toLocaleLowerCase() === normalized.toLocaleLowerCase())
        ? current
        : [...current, { name: normalized, coverImage: null }]
    );

    try {
      const tag = await api.tags.create(normalized);
      setCustomTags(current =>
        current.some(value => value.name.toLocaleLowerCase() === tag.name.toLocaleLowerCase())
          ? current
          : [...current, { name: tag.name, coverImage: null }]
      );
    } catch (error) {
      console.error('No se pudo guardar la etiqueta:', error);
    }
  }, []);

  return { tags, createTag, reloadTags: loadTags };
};
