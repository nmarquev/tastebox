import { useState } from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

interface FilterAutocompleteInputProps {
  options?: string[]; // se mantiene por compatibilidad, ya no se usa
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  emptyOption?: string;
}

export const FilterAutocompleteInput = ({
  selected,
  onChange,
  placeholder = 'Escribir...',
  emptyOption,
}: FilterAutocompleteInputProps) => {
  const [value, setValue] = useState('');

  const addValue = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const exists = selected.some(item => item.toLocaleLowerCase('es') === trimmed.toLocaleLowerCase('es'));
    if (!exists) onChange([...selected, trimmed]);
    setValue('');
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className="pr-9"
          onKeyDown={(event) => {
            // Enter o coma agregan el ingrediente escrito y permiten seguir agregando.
            if ((event.key === 'Enter' || event.key === ',') && value.trim()) {
              event.preventDefault();
              addValue(value);
            }
          }}
        />
        {value && (
          <button
            type="button"
            onClick={() => setValue('')}
            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Borrar"
            title="Borrar"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {emptyOption && (
        <button
          type="button"
          onClick={() => {
            const isSelected = selected.includes(emptyOption);
            onChange(isSelected ? selected.filter(item => item !== emptyOption) : [...selected, emptyOption]);
          }}
          className={`w-full rounded-md border px-3 py-2 text-left text-xs transition-colors ${
            selected.includes(emptyOption)
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border bg-background text-muted-foreground hover:bg-muted'
          }`}
        >
          {emptyOption}
        </button>
      )}

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map(item => (
            <Badge key={item} variant="secondary" className="text-xs">
              {item}
              <button
                type="button"
                className="ml-1 rounded-sm hover:text-destructive"
                aria-label={`Quitar ${item}`}
                onClick={() => onChange(selected.filter(value => value !== item))}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};
