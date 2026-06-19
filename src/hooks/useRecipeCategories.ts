import { useCallback, useEffect, useMemo, useState } from 'react';
import { RECIPE_CATEGORIES } from '@/constants/categories';
import { api } from '@/services/api';

export interface CustomCategory {
  name: string;
  coverImage: string | null;
}

export const useRecipeCategories = (enabled = true) => {
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);

  const loadCategories = useCallback(async () => {
    try {
      setCustomCategories(await api.categories.getAll());
    } catch (error) {
      console.error('No se pudieron cargar las categorías personalizadas:', error);
    }
  }, []);

  useEffect(() => {
    if (enabled) loadCategories();
  }, [enabled, loadCategories]);

  // Lista de nombres (estáticas + personalizadas) para los selectores de categoría.
  const categories = useMemo(() => {
    const byName = new Map<string, string>();
    [...RECIPE_CATEGORIES, ...customCategories.map(c => c.name)].forEach(category => {
      const name = category.trim();
      if (name) byName.set(name.toLocaleLowerCase(), name);
    });
    return Array.from(byName.values());
  }, [customCategories]);

  const createCategory = useCallback(async (name: string) => {
    const normalized = name.trim();
    if (!normalized) return;

    setCustomCategories(current =>
      current.some(category => category.name.toLocaleLowerCase() === normalized.toLocaleLowerCase())
        ? current
        : [...current, { name: normalized, coverImage: null }]
    );

    try {
      const category = await api.categories.create(normalized);
      setCustomCategories(current =>
        current.some(value => value.name.toLocaleLowerCase() === category.name.toLocaleLowerCase())
          ? current
          : [...current, { name: category.name, coverImage: null }]
      );
    } catch (error) {
      console.error('No se pudo guardar la categoría:', error);
    }
  }, []);

  return { categories, customCategories, createCategory, reloadCategories: loadCategories };
};
