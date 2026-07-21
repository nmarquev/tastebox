import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/services/api';

let cachedTags: string[] | null = null;
let tagsRequest: Promise<string[]> | null = null;

async function loadExistingTags(): Promise<string[]> {
  if (cachedTags) return cachedTags;
  if (!tagsRequest) {
    tagsRequest = api.recipes.getAll().then(recipes => {
      cachedTags = Array.from(new Set(
        recipes.flatMap(recipe =>
          (recipe.tags || []).map(tag =>
            typeof tag === 'string' ? tag : tag.tag || tag.name || ''
          )
        ).filter(Boolean)
      )).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
      return cachedTags;
    }).catch(() => []);
  }
  return tagsRequest;
}

interface TagAutocompleteInputProps {
  value: string;
  selectedTags: string[];
  options?: string[];
  showAddButton?: boolean;
  onValueChange: (value: string) => void;
  onAdd: (tag?: string) => void;
}

export const TagAutocompleteInput = ({
  value,
  selectedTags,
  options,
  showAddButton = true,
  onValueChange,
  onAdd,
}: TagAutocompleteInputProps) => {
  const [loadedTags, setLoadedTags] = useState<string[]>([]);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (options) return;
    loadExistingTags().then(setLoadedTags);
  }, [options]);

  const existingTags = options || loadedTags;

  const suggestions = useMemo(() => {
    const query = value.trim().toLocaleLowerCase('es');
    if (!query) return [];
    const selected = new Set(selectedTags.map(tag => tag.toLocaleLowerCase('es')));
    return existingTags
      .filter(tag =>
        tag.toLocaleLowerCase('es').includes(query)
        && !selected.has(tag.toLocaleLowerCase('es'))
      )
      .slice(0, 8);
  }, [existingTags, selectedTags, value]);

  return (
    <div className="relative">
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 150)}
          placeholder="Agregar etiqueta"
          autoComplete="off"
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            onAdd(suggestions[0] || value);
          }}
        />
        {showAddButton && (
          <Button type="button" onClick={() => onAdd(value)} size="sm">
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>

      {focused && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          {suggestions.map(tag => (
            <button
              key={tag}
              type="button"
              className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onAdd(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
