import { useState } from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface CreatableComboboxProps {
  value?: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  createLabel?: string;
}

export const CreatableCombobox = ({
  value = '',
  options,
  onChange,
  placeholder = 'Seleccionar',
  searchPlaceholder = 'Buscar o escribir...',
  createLabel = 'Agregar',
}: CreatableComboboxProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const normalizedSearch = search.trim();
  const availableOptions = Array.from(new Set(value ? [...options, value] : options));
  const filteredOptions = availableOptions.filter(option =>
    option.toLocaleLowerCase('es').includes(normalizedSearch.toLocaleLowerCase('es'))
  );
  const hasExactMatch = availableOptions.some(option =>
    option.toLocaleLowerCase('es') === normalizedSearch.toLocaleLowerCase('es')
  );
  const canCreate = normalizedSearch.length > 0 && !hasExactMatch;

  const selectValue = (nextValue: string) => {
    onChange(nextValue);
    setSearch('');
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn(!value && 'text-muted-foreground')}>
            {value || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {!filteredOptions.length && !canCreate && (
              <CommandEmpty>Sin resultados.</CommandEmpty>
            )}
            <CommandGroup>
              {canCreate && (
                <CommandItem
                  value={`create-${normalizedSearch}`}
                  onSelect={() => selectValue(normalizedSearch)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {createLabel} “{normalizedSearch}”
                </CommandItem>
              )}
              {filteredOptions.map(option => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={() => selectValue(option)}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === option ? 'opacity-100' : 'opacity-0')} />
                  {option}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
