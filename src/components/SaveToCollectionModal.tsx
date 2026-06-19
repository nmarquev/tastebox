import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Loader2, Plus, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api, RecipeCollection } from "@/services/api";
import { Recipe } from "@/types/recipe";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface SaveToCollectionModalProps {
  recipe: Recipe | null;
  isOpen: boolean;
  onClose: () => void;
  onRecipeSaved?: (recipeId: string, collections: RecipeCollection[]) => void;
}

export const SaveToCollectionModal = ({
  recipe,
  isOpen,
  onClose,
  onRecipeSaved,
}: SaveToCollectionModalProps) => {
  const [collections, setCollections] = useState<RecipeCollection[]>([]);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);
  const [removedCollectionIds, setRemovedCollectionIds] = useState<string[]>([]);
  const [isCollectionPickerOpen, setIsCollectionPickerOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!isOpen) return;

    setSelectedCollectionIds([]);
    setRemovedCollectionIds([]);
    setIsCollectionPickerOpen(false);
    setShowCreate(false);
    setNewCollectionName("");
    setIsLoading(true);

    api.collections.getAll()
      .then(setCollections)
      .catch(error => {
        toast({
          title: "Error al cargar colecciones",
          description: error instanceof Error ? error.message : "No se pudieron cargar",
          variant: "destructive",
        });
      })
      .finally(() => setIsLoading(false));
  }, [isOpen, toast]);

  const handleCreateCollection = async () => {
    const name = newCollectionName.trim();
    if (!name) return;

    setIsSaving(true);
    try {
      const collection = await api.collections.create(name);
      setCollections(prev => [...prev, collection].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedCollectionIds(prev => [...prev, collection.id]);
      setNewCollectionName("");
      setShowCreate(false);
      toast({
        title: "Colección creada",
        description: `"${collection.name}" ya está disponible.`,
      });
    } catch (error) {
      toast({
        title: "No se pudo crear la colección",
        description: error instanceof Error ? error.message : "Intentá nuevamente",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!recipe || (selectedCollectionIds.length === 0 && removedCollectionIds.length === 0)) return;

    setIsSaving(true);
    try {
      await Promise.all([
        ...selectedCollectionIds.map(collectionId =>
          api.collections.addRecipe(collectionId, recipe.id)
        ),
        ...removedCollectionIds.map(collectionId =>
          api.collections.removeRecipe(collectionId, recipe.id)
        ),
      ]);
      const updatedCollections = collections.map(collection => {
        if (removedCollectionIds.includes(collection.id) && collection.recipeIds.includes(recipe.id)) {
          return {
            ...collection,
            recipeIds: collection.recipeIds.filter(recipeId => recipeId !== recipe.id),
            recipeCount: Math.max(0, collection.recipeCount - 1),
          };
        }

        if (selectedCollectionIds.includes(collection.id) && !collection.recipeIds.includes(recipe.id)) {
          return {
            ...collection,
            recipeIds: [...collection.recipeIds, recipe.id],
            recipeCount: collection.recipeCount + 1,
          };
        }

        return collection;
      });
      onRecipeSaved?.(recipe.id, updatedCollections);
      const selectedNames = collections
        .filter(item => selectedCollectionIds.includes(item.id))
        .map(item => item.name);
      toast({
        title: "Colecciones actualizadas",
        description: selectedNames.length
          ? `Se agregó a ${selectedNames.map(name => `"${name}"`).join(", ")}.`
          : "La receta se quitó de las colecciones seleccionadas.",
      });
      onClose();
    } catch (error) {
      toast({
        title: "No se pudo guardar la receta",
        description: error instanceof Error ? error.message : "Intentá nuevamente",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const currentCollections = recipe
    ? collections.filter(collection =>
        collection.recipeIds.includes(recipe.id) && !removedCollectionIds.includes(collection.id)
      )
    : [];
  const availableCollections = recipe
    ? collections.filter(collection =>
        !collection.recipeIds.includes(recipe.id) || removedCollectionIds.includes(collection.id)
      )
    : collections;

  const toggleCollection = (collectionId: string) => {
    if (removedCollectionIds.includes(collectionId)) {
      setRemovedCollectionIds(prev => prev.filter(id => id !== collectionId));
      return;
    }

    setSelectedCollectionIds(prev =>
      prev.includes(collectionId)
        ? prev.filter(id => id !== collectionId)
        : [...prev, collectionId]
    );
  };

  const handleRemoveFromCollection = (collectionId: string) => {
    setRemovedCollectionIds(prev =>
      prev.includes(collectionId) ? prev : [...prev, collectionId]
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle className="text-2xl font-semibold">Guardar</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 px-6 py-6">
          <div className="space-y-2">
            <Label htmlFor="collection">Colección</Label>
            <Popover open={isCollectionPickerOpen} onOpenChange={setIsCollectionPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="collection"
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={isCollectionPickerOpen}
                  className="h-12 w-full justify-between font-normal"
                  disabled={isLoading}
                >
                  <span className={cn(!selectedCollectionIds.length && "text-muted-foreground")}>
                    {isLoading
                      ? "Cargando colecciones..."
                      : selectedCollectionIds.length
                        ? `${selectedCollectionIds.length} seleccionada${selectedCollectionIds.length > 1 ? "s" : ""}`
                        : "Seleccionar colecciones"}
                  </span>
                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar colección..." />
                  <CommandList>
                    <CommandEmpty>
                      {availableCollections.length ? "Sin resultados." : "La receta ya está en todas las colecciones."}
                    </CommandEmpty>
                    <CommandGroup>
                      {availableCollections.map(collection => (
                        <CommandItem
                          key={collection.id}
                          value={collection.name}
                          onSelect={() => {
                            toggleCollection(collection.id);
                            window.setTimeout(() => setIsCollectionPickerOpen(false), 0);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedCollectionIds.includes(collection.id) ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {collection.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {(currentCollections.length > 0 || selectedCollectionIds.length > 0) && (
              <div className="space-y-1.5 pt-1">
                <span className="text-xs font-semibold text-primary">Guardada en</span>
                <div className="flex flex-wrap gap-1.5">
                  {currentCollections.map(collection => (
                    <Badge
                      key={collection.id}
                      className="gap-1 rounded-full border-0 bg-primary px-3 py-1 pr-1.5 text-xs font-normal text-foreground hover:bg-primary/90"
                    >
                      <span>{collection.name}</span>
                      <button
                        type="button"
                        className="inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-background/25"
                        onClick={() => handleRemoveFromCollection(collection.id)}
                        aria-label={`Quitar de ${collection.name}`}
                        title={`Quitar de ${collection.name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {collections
                    .filter(collection => selectedCollectionIds.includes(collection.id))
                    .map(collection => (
                      <Badge
                        key={collection.id}
                        className="gap-1 rounded-full border-0 bg-primary px-3 py-1 pr-1.5 text-xs font-normal text-foreground hover:bg-primary/90"
                      >
                        <span>{collection.name}</span>
                        <button
                          type="button"
                          className="inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-background/25"
                          onClick={() => toggleCollection(collection.id)}
                          aria-label={`Quitar ${collection.name}`}
                          title={`Quitar ${collection.name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                </div>
              </div>
            )}
          </div>

          <div className="border-t pt-4">
            {!showCreate ? (
              <Button
                type="button"
                variant="ghost"
                className="w-full justify-start px-1 font-semibold"
                onClick={() => setShowCreate(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Crear nueva colección
              </Button>
            ) : (
              <div className="space-y-3">
                <Label htmlFor="new-collection">Nueva colección</Label>
                <div className="flex gap-2">
                  <Input
                    id="new-collection"
                    value={newCollectionName}
                    onChange={(event) => setNewCollectionName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleCreateCollection();
                      }
                    }}
                    placeholder="Nombre de la colección"
                    autoFocus
                  />
                  <Button
                    type="button"
                    onClick={handleCreateCollection}
                    disabled={!newCollectionName.trim() || isSaving}
                  >
                    Crear
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t bg-muted/20 px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={
              (selectedCollectionIds.length === 0 && removedCollectionIds.length === 0)
              || isSaving
            }
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Aceptar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
