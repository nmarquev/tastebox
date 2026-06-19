import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, GripVertical, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface MultiSelectComboboxProps {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  sortable?: boolean;
  allowCreate?: boolean;
  createLabel?: string;
  onCreate?: (value: string) => void | Promise<void>;
  singleSelect?: boolean;
  closeOnSelect?: boolean;
}

// Selector múltiple con buscador (reutilizable: categorías, etiquetas, etc.).
export const MultiSelectCombobox = ({
  options,
  selected,
  onChange,
  placeholder = "Filtrar",
  searchPlaceholder = "Buscar...",
  sortable = false,
  allowCreate = false,
  createLabel = "Agregar",
  onCreate,
  singleSelect = false,
  closeOnSelect = false,
}: MultiSelectComboboxProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const previousSelectedRef = useRef(selected);
  const normalizedSearch = search.trim();
  const filteredOptions = options.filter((option) =>
    option.toLocaleLowerCase().includes(normalizedSearch.toLocaleLowerCase())
  );
  const hasExactMatch = [...options, ...selected].some(
    (option) => option.toLocaleLowerCase() === normalizedSearch.toLocaleLowerCase()
  );
  const canCreate = allowCreate && normalizedSearch.length > 0 && !hasExactMatch;

  useEffect(() => {
    const previousSelected = previousSelectedRef.current;
    const selectionChanged =
      previousSelected.length !== selected.length
      || previousSelected.some((value, index) => value !== selected[index]);

    if (closeOnSelect && open && selectionChanged) {
      setSearch("");
      setOpen(false);
    }

    previousSelectedRef.current = selected;
  }, [closeOnSelect, open, selected]);

  const toggle = (value: string) => {
    const next = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : singleSelect ? [value] : [...selected, value];
    onChange(next);
    // Limpiar el buscador tras seleccionar para permitir agregar otro valor.
    setSearch("");
    if (closeOnSelect) {
      window.setTimeout(() => setOpen(false), 0);
    }
  };

  const moveSelected = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const next = [...selected];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal hover:!bg-transparent data-[state=open]:!bg-transparent focus-visible:!ring-0 focus-visible:!ring-offset-0 hover:border-primary/60 focus-visible:border-primary data-[state=open]:border-primary"
          >
            <span className={cn("truncate", !selected.length && "text-muted-foreground")}>
              {selected.length
                ? (singleSelect ? selected[0] : `${selected.length} seleccionada${selected.length > 1 ? "s" : ""}`)
                : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <div className="relative">
              <CommandInput
                placeholder={searchPlaceholder}
                value={search}
                onValueChange={setSearch}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Borrar búsqueda"
                  title="Borrar"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <CommandList>
              {!filteredOptions.length && !canCreate && (
                <CommandEmpty>Sin resultados.</CommandEmpty>
              )}
              <CommandGroup>
                {canCreate && (
                  <CommandItem
                    value={`create-${normalizedSearch}`}
                    onSelect={() => {
                      onChange(singleSelect ? [normalizedSearch] : [...selected, normalizedSearch]);
                      void onCreate?.(normalizedSearch);
                      setSearch("");
                      if (closeOnSelect) {
                        window.setTimeout(() => setOpen(false), 0);
                      }
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {createLabel} “{normalizedSearch}”
                  </CommandItem>
                )}
                {filteredOptions.map((opt) => (
                  <CommandItem key={opt} value={opt} onSelect={() => toggle(opt)}>
                    <Check className={cn("mr-2 h-4 w-4", selected.includes(opt) ? "opacity-100" : "opacity-0")} />
                    {opt}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Elementos seleccionados, removibles (en modo single el valor se muestra en el botón) */}
      {!singleSelect && selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((value, index) => (
            <Badge
              key={value}
              variant="secondary"
              draggable={sortable}
              onDragStart={(event) => {
                if (!sortable) return;
                setDraggedIndex(index);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", value);
              }}
              onDragOver={(event) => {
                if (!sortable || draggedIndex === null) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => {
                if (!sortable || draggedIndex === null) return;
                event.preventDefault();
                moveSelected(draggedIndex, index);
                setDraggedIndex(null);
              }}
              onDragEnd={() => setDraggedIndex(null)}
              className={cn(
                "text-xs",
                sortable ? "cursor-grab select-none active:cursor-grabbing" : "cursor-pointer",
                draggedIndex === index && "opacity-50"
              )}
              onClick={() => {
                if (!sortable) toggle(value);
              }}
              title={sortable ? "Arrastrar para cambiar el orden" : undefined}
            >
              {sortable && <GripVertical className="mr-1 h-3 w-3" />}
              {value}
              <button
                type="button"
                className="ml-1 rounded-sm hover:text-destructive"
                aria-label={`Quitar ${value}`}
                onClick={(event) => {
                  event.stopPropagation();
                  toggle(value);
                }}
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
