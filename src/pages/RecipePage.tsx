import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, RecipeCollection } from "@/services/api";
import { Recipe } from "@/types/recipe";
import { RecipeModal } from "@/components/RecipeModal";
import { SaveToCollectionModal } from "@/components/SaveToCollectionModal";

// Página dedicada que muestra UNA sola receta (ej. al abrir en una nueva pestaña).
// Reutiliza el RecipeModal sobre un fondo limpio: en la pestaña se ve solo la receta.
const RecipePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [collections, setCollections] = useState<RecipeCollection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collectionRecipe, setCollectionRecipe] = useState<Recipe | null>(null);
  const [collectionRecipeIds, setCollectionRecipeIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    Promise.all([api.recipes.getAll(), api.collections.getAll()])
      .then(([recipes, collections]) => {
        setAllRecipes(recipes);
        const found = recipes.find((r) => r.id === id) || null;
        setRecipe(found);
        if (!found) setError("No se pudo cargar la receta. Puede que no exista o que no tengas acceso.");
        setCollections(collections);
        setCollectionRecipeIds(new Set(collections.flatMap((c) => c.recipeIds)));
      })
      .catch(() => setError("No se pudo cargar la receta. Puede que no exista o que no tengas acceso."))
      .finally(() => setIsLoading(false));
  }, [id]);

  // Índice de la receta actual dentro de la lista, para navegar anterior/siguiente.
  const currentIndex = recipe ? allRecipes.findIndex((r) => r.id === recipe.id) : -1;
  const previousRecipe = currentIndex > 0 ? allRecipes[currentIndex - 1] : null;
  const nextRecipe =
    currentIndex >= 0 && currentIndex < allRecipes.length - 1 ? allRecipes[currentIndex + 1] : null;

  // Persiste un cambio de bandera (favorita/cocinada) con actualización optimista.
  const persistToggle = async (patch: Partial<Recipe>) => {
    if (!recipe) return;
    const previous = recipe;
    setRecipe({ ...recipe, ...patch });
    try {
      const cleanedInstructions = recipe.instructions.map((instruction) => ({
        ...instruction,
        time: instruction.time || "",
        temperature: instruction.temperature || "",
        speed: instruction.speed || "",
      }));
      const cleanedTags = recipe.tags.map((tag) =>
        typeof tag === "string" ? { tag, tagId: tag } : tag
      );
      const updated = await api.recipes.update(recipe.id, {
        title: recipe.title,
        description: recipe.description,
        prepTime: recipe.prepTime,
        cookTime: recipe.cookTime,
        servings: recipe.servings,
        difficulty: recipe.difficulty,
        images: recipe.images,
        ingredients: recipe.ingredients,
        instructions: cleanedInstructions,
        tags: cleanedTags,
        sourceUrl: recipe.sourceUrl,
        recipeType: recipe.recipeType,
        ...patch,
      } as any);
      setRecipe(updated);
    } catch {
      setRecipe(previous);
      toast.error("No se pudo guardar el cambio");
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center">
        <p className="text-muted-foreground">{error || "Receta no encontrada"}</p>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="text-primary hover:underline"
        >
          Ir al inicio
        </button>
      </div>
    );
  }

  return (
    <>
      <RecipeModal
        recipe={recipe}
        isOpen
        variant="page"
        onClose={() => navigate("/")}
        onRecipeUpdate={setRecipe}
        collections={collections}
        onToggleFavorite={() => persistToggle({ featured: !recipe.featured })}
        onToggleCooked={() => persistToggle({ cooked: !recipe.cooked })}
        onSaveToCollection={setCollectionRecipe}
        isInCollection={collectionRecipeIds.has(recipe.id)}
        hasPreviousRecipe={previousRecipe !== null}
        hasNextRecipe={nextRecipe !== null}
        onPreviousRecipe={previousRecipe ? () => navigate(`/receta/${previousRecipe.id}`) : undefined}
        onNextRecipe={nextRecipe ? () => navigate(`/receta/${nextRecipe.id}`) : undefined}
      />

      <SaveToCollectionModal
        recipe={collectionRecipe}
        isOpen={collectionRecipe !== null}
        onClose={() => setCollectionRecipe(null)}
        onRecipeSaved={(_recipeId, collections) => {
          setCollections(collections);
          setCollectionRecipeIds(new Set(collections.flatMap((c) => c.recipeIds)));
        }}
      />
    </>
  );
};

export default RecipePage;
