import { useState } from 'react';
import { Check, ChevronsUpDown, Plus, X } from 'lucide-react';
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
  emptyOptionLabel?: string;
  triggerClassName?: string;
  onDeleteOption?: (value: string) => void;
}

export const CreatableCombobox = ({
  value = '',
  options,
  onChange,
  placeholder = 'Seleccionar',
  searchPlaceholder = 'Buscar o escribir...',
  createLabel = 'Agregar',
  emptyOptionLabel,
  triggerClassName,
  onDeleteOption,
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
  ) || Boolean(
    emptyOptionLabel
    && emptyOptionLabel.toLocaleLowerCase('es') === normalizedSearch.toLocaleLowerCase('es')
  );
  const canCreate = normalizedSearch.length > 0 && !hasExactMatch;
  const showEmptyOption = Boolean(
    emptyOptionLabel
    && emptyOptionLabel.toLocaleLowerCase('es').includes(normalizedSearch.toLocaleLowerCase('es'))
  );

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
          className={cn(
            'w-full justify-between font-normal text-foreground hover:!bg-transparent hover:!text-foreground data-[state=open]:!bg-transparent data-[state=open]:!text-foreground focus-visible:!text-foreground',
            triggerClassName
          )}
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
            {!filteredOptions.length && !canCreate && !showEmptyOption && (
              <CommandEmpty>Sin resultados.</CommandEmpty>
            )}
            <CommandGroup>
              {showEmptyOption && (
                <CommandItem value="empty-option" onSelect={() => selectValue('')}>
                  <Check className={cn('mr-2 h-4 w-4', !value ? 'opacity-100' : 'opacity-0')} />
                  {emptyOptionLabel}
                </CommandItem>
              )}
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
                  className="gap-2"
                >
                  <Check className={cn('h-4 w-4', value === option ? 'opacity-100' : 'opacity-0')} />
                  <span className="min-w-0 flex-1 truncate">{option}</span>
                  {onDeleteOption && (
                    <button
                      type="button"
                      className="ml-2 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Eliminar ${option}`}
                      title="Eliminar de la lista"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onDeleteOption(option);
                        if (value === option) {
                          onChange('');
                        }
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
