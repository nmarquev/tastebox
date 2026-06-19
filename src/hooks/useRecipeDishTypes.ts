import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/services/api';

export interface CustomDishType {
  name: string;
  coverImage: string | null;
}

export const useRecipeDishTypes = (enabled = true) => {
  const [customDishTypes, setCustomDishTypes] = useState<CustomDishType[]>([]);

  const loadDishTypes = useCallback(async () => {
    try {
      setCustomDishTypes(await api.dishTypes.getAll());
    } catch (error) {
      console.error('No se pudieron cargar los tipos de receta:', error);
    }
  }, []);

  useEffect(() => {
    if (enabled) loadDishTypes();
  }, [enabled, loadDishTypes]);

  const dishTypes = useMemo(() => {
    const byName = new Map<string, CustomDishType>();
    customDishTypes.forEach(dishType => {
      const name = dishType.name.trim();
      if (name) byName.set(name.toLocaleLowerCase(), { name, coverImage: dishType.coverImage });
    });
    return Array.from(byName.values());
  }, [customDishTypes]);

  const createDishType = useCallback(async (name: string) => {
    const normalized = name.trim();
    if (!normalized) return;

    setCustomDishTypes(current =>
      current.some(dishType => dishType.name.toLocaleLowerCase() === normalized.toLocaleLowerCase())
        ? current
        : [...current, { name: normalized, coverImage: null }]
    );

    try {
      const dishType = await api.dishTypes.create(normalized);
      setCustomDishTypes(current =>
        current.some(value => value.name.toLocaleLowerCase() === dishType.name.toLocaleLowerCase())
          ? current
          : [...current, { name: dishType.name, coverImage: null }]
      );
    } catch (error) {
      console.error('No se pudo guardar el tipo de receta:', error);
    }
  }, []);

  return { dishTypes, createDishType, reloadDishTypes: loadDishTypes };
};
