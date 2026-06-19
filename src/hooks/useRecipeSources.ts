import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/services/api';

export interface CustomSource {
  name: string;
  coverImage: string | null;
}

export const useRecipeSources = (enabled = true) => {
  const [customSources, setCustomSources] = useState<CustomSource[]>([]);

  const loadSources = useCallback(async () => {
    try {
      setCustomSources(await api.sources.getAll());
    } catch (error) {
      console.error('No se pudieron cargar las fuentes:', error);
    }
  }, []);

  useEffect(() => {
    if (enabled) loadSources();
  }, [enabled, loadSources]);

  const sources = useMemo(() => {
    const byName = new Map<string, CustomSource>();
    customSources.forEach(source => {
      const name = source.name.trim();
      if (name) byName.set(name.toLocaleLowerCase(), { name, coverImage: source.coverImage });
    });
    return Array.from(byName.values());
  }, [customSources]);

  const createSource = useCallback(async (name: string) => {
    const normalized = name.trim();
    if (!normalized) return;

    setCustomSources(current =>
      current.some(source => source.name.toLocaleLowerCase() === normalized.toLocaleLowerCase())
        ? current
        : [...current, { name: normalized, coverImage: null }]
    );

    try {
      const source = await api.sources.create(normalized);
      setCustomSources(current =>
        current.some(value => value.name.toLocaleLowerCase() === source.name.toLocaleLowerCase())
          ? current
          : [...current, { name: source.name, coverImage: null }]
      );
    } catch (error) {
      console.error('No se pudo guardar la fuente:', error);
    }
  }, []);

  return { sources, createSource, reloadSources: loadSources };
};
