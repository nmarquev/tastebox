import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Recipe } from "@/types/recipe";
import { Beef, CakeSlice, CandyOff, Clock, User, ChefHat, Send, Printer, Download, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ExternalLink, Play, Pause, Edit, Timer, WheatOff, Leaf, Heart, Bookmark, Trash2, Check, X, ArrowUpRightFromSquare, Languages, Loader2, Utensils, MoreVertical } from "lucide-react";
import { useState, useEffect, useMemo, useRef } from "react";
import { resolveImageUrl } from "@/utils/api";
import { getSourceFromUrl, isValidUrl, getRecipeSource } from "@/utils/siteUtils";
import { isThermomixRecipe, hasThermomixSettings, getThermomixSettingsDisplay } from "@/utils/recipeUtils";
import { api, RecipeCollection } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { useVoiceSettings } from "@/hooks/useVoiceSettings";
import { NutritionLabel } from "@/components/NutritionLabel";
import { ThermomixSetting } from "@/components/ThermomixSetting";
import { StepDescription, hasInlineThermomix } from "@/components/StepDescription";
import { AvocadoIcon } from "@/components/icons/AvocadoIcon";
import { RecipePreparedIcon } from "@/components/icons/RecipePreparedIcon";
import { PreparationTimeIcon } from "@/components/icons/PreparationTimeIcon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { parseCategories } from "@/constants/categories";
import { useNutritionCalculator } from "@/hooks/useNutritionCalculator";
import { downloadRecipePdf, printRecipePdf, shareRecipePdf } from "@/utils/pdfUtils";
import { EditRecipeModal } from "@/components/EditRecipeModal";
import { useDraggableDialog } from "@/hooks/useDraggableDialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface RecipeModalProps {
  recipe: Recipe | null;
  isOpen: boolean;
  onClose: () => void;
  onRecipeUpdate?: (recipe: Recipe) => void;
  onCollectionsUpdated?: (collections: RecipeCollection[]) => void;
  collections?: RecipeCollection[];
  onDelete?: (recipe: Recipe) => void;
  onSaveToCollection?: (recipe: Recipe) => void;
  isInCollection?: boolean;
  onToggleFavorite?: (recipe: Recipe) => void;
  onToggleCooked?: (recipe: Recipe) => void;
  onToggleFeature?: (recipe: Recipe, field: string, value: boolean) => void;
  onPreviousRecipe?: () => void;
  onNextRecipe?: () => void;
  hasPreviousRecipe?: boolean;
  hasNextRecipe?: boolean;
  // "modal" (default) muestra la receta en un diálogo centrado.
  // "page" la muestra a página completa, sin la tarjeta/diálogo (ej. /receta/:id).
  variant?: "modal" | "page";
}

const DETAIL_FEATURE_TOGGLES: { field: keyof Recipe; label: string; icon: JSX.Element }[] = [
  { field: 'featured', label: 'Favorita', icon: <Heart className="h-4 w-4" /> },
  { field: 'cooked', label: 'Cocinada', icon: <RecipePreparedIcon className="h-5 w-5" /> },
  { field: 'thermomix', label: 'Thermomix', icon: <img src="/thermomix-logo.png" alt="" className="h-5 w-5 object-contain" /> },
  { field: 'airFryer', label: 'Air Fryer', icon: <img src="/air-fryer.png" alt="" className="h-4 w-4 object-contain" /> },
  { field: 'glutenFree', label: 'Sin Gluten', icon: <WheatOff className="h-4 w-4" /> },
  { field: 'sugarFree', label: 'Sin Azucar', icon: <CandyOff className="h-4 w-4" /> },
  { field: 'keto', label: 'Keto', icon: <AvocadoIcon className="h-[18px] w-[18px]" /> },
  { field: 'lowCarb', label: 'Low Carb', icon: <img src="/logo-saludable.png" alt="" className="h-4 w-4 object-contain" /> },
  { field: 'proteica', label: 'Proteica', icon: <Beef className="h-4 w-4" /> },
  { field: 'vegetarian', label: 'Vegetariana', icon: <Leaf className="h-4 w-4" /> },
  { field: 'sweet', label: 'Receta dulce', icon: <CakeSlice className="h-4 w-4" /> },
  { field: 'savory', label: 'Receta salada', icon: <Utensils className="h-4 w-4" /> },
];

// Envoltorio que muestra el contenido como diálogo (modal) o a página completa (page).
// Está a nivel de módulo para que no se re-monte el contenido en cada render.
const ModalShell = ({
  isPage,
  isOpen,
  onOpenChange,
  header,
  children,
  scrollRef,
  contentStyle,
  headerDragProps,
}: {
  isPage: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  header: React.ReactNode;
  children: React.ReactNode;
  scrollRef?: React.Ref<HTMLDivElement>;
  contentStyle?: React.CSSProperties;
  headerDragProps?: React.HTMLAttributes<HTMLDivElement>;
}) => {
  if (isPage) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">{header}{children}</div>
      </div>
    );
  }
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        style={contentStyle}
        className="flex max-h-[90vh] max-w-4xl flex-col gap-0 overflow-hidden p-0"
      >
        {/* Header fijo (no scrollea); se puede arrastrar para mover el modal */}
        <div className="flex-shrink-0 border-b bg-background px-6 pb-3 pt-6" {...headerDragProps}>{header}</div>
        {/* Cuerpo scrolleable */}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>
      </DialogContent>
    </Dialog>
  );
};

const normalizeSourceIdentity = (value: string) => {
  const trimmed = value.trim().toLowerCase();
  let normalized = trimmed;

  try {
    const parsed = new URL(trimmed);
    normalized = parsed.pathname.split('/').filter(Boolean)[0]
      || parsed.hostname.replace(/^www\./, '');
  } catch {
    normalized = trimmed;
  }

  return normalized
    .replace(/^@/, '')
    .replace(/^www\./, '')
    .replace(/\.(?:com|net|org|com\.ar)$/i, '')
    .replace(/[^a-z0-9]+/g, '');
};

const OUNCE_TO_GRAMS = 28.349523125;
const OUNCE_UNITS = new Set(['oz', 'oz.', 'ounce', 'ounces', 'onza', 'onzas']);
const UNIT_TRANSLATIONS: Record<string, string> = {
  tsp: 'cucharadita',
  'tsp.': 'cucharadita',
  teaspoon: 'cucharadita',
  teaspoons: 'cucharadita',
  tbsp: 'cucharada',
  'tbsp.': 'cucharada',
  tablespoon: 'cucharada',
  tablespoons: 'cucharada',
};

const unicodeFractions: Record<string, number> = {
  '¼': 1 / 4,
  '½': 1 / 2,
  '¾': 3 / 4,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '⅛': 1 / 8,
  '⅜': 3 / 8,
  '⅝': 5 / 8,
  '⅞': 7 / 8,
};

const isOunceUnit = (unit?: string) => {
  return OUNCE_UNITS.has((unit || '').trim().toLowerCase());
};

const translateIngredientUnit = (unit?: string) => {
  const normalized = (unit || '').trim().toLowerCase();
  return UNIT_TRANSLATIONS[normalized] || unit;
};

const isSpanishLanguage = (language?: string) => {
  const normalized = (language || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

  return /^(?:es|espanol|spanish|castellano)(?:$|[\s(_-])/.test(normalized);
};

const parseAmountNumber = (value: string): number | null => {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;
  if (unicodeFractions[normalized] !== undefined) return unicodeFractions[normalized];

  const mixedFractionMatch = normalized.match(/^(\d+(?:\.\d+)?)\s+(\d+)\/(\d+)$/);
  if (mixedFractionMatch) {
    const whole = Number(mixedFractionMatch[1]);
    const numerator = Number(mixedFractionMatch[2]);
    const denominator = Number(mixedFractionMatch[3]);
    return denominator ? whole + numerator / denominator : null;
  }

  const simpleFractionMatch = normalized.match(/^(\d+)\/(\d+)$/);
  if (simpleFractionMatch) {
    const numerator = Number(simpleFractionMatch[1]);
    const denominator = Number(simpleFractionMatch[2]);
    return denominator ? numerator / denominator : null;
  }

  const compactUnicodeFractionMatch = normalized.match(/^(\d+(?:\.\d+)?)([¼½¾⅓⅔⅛⅜⅝⅞])$/);
  if (compactUnicodeFractionMatch) {
    return Number(compactUnicodeFractionMatch[1]) + unicodeFractions[compactUnicodeFractionMatch[2]];
  }

  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
};

const formatGramAmount = (ounces: number) => {
  const grams = ounces * OUNCE_TO_GRAMS;
  if (grams < 1) return grams.toFixed(1).replace(/\.0$/, '');
  return String(Math.round(grams));
};

const convertOunceAmountToGrams = (amount?: string) => {
  const rawAmount = (amount || '').trim();
  if (!rawAmount) return null;

  const rangeParts = rawAmount.split(/\s*(?:-|–|—|a|to)\s*/i);
  if (rangeParts.length === 2 && rangeParts.every(Boolean)) {
    const converted = rangeParts.map(part => {
      const parsed = parseAmountNumber(part);
      return parsed === null ? null : formatGramAmount(parsed);
    });
    return converted.every(Boolean) ? converted.join('-') : null;
  }

  const parsed = parseAmountNumber(rawAmount);
  return parsed === null ? null : formatGramAmount(parsed);
};

export const RecipeModal = ({
  recipe,
  isOpen,
  onClose,
  onRecipeUpdate,
  onCollectionsUpdated,
  collections = [],
  onDelete,
  onSaveToCollection,
  isInCollection = false,
  onToggleFavorite,
  onToggleCooked,
  onToggleFeature,
  onPreviousRecipe,
  onNextRecipe,
  hasPreviousRecipe = false,
  hasNextRecipe = false,
  variant = "modal",
}: RecipeModalProps) => {
  const isPage = variant === "page";
  const { dragHandleProps, contentStyle: dragContentStyle } = useDraggableDialog(isOpen);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollToTop = () => isPage
    ? window.scrollTo({ top: 0, behavior: 'smooth' })
    : scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  const scrollToBottom = () => isPage
    ? window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
    : scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [loadingStates, setLoadingStates] = useState({
    print: false,
    download: false,
    share: false
  });
  const [localRecipe, setLocalRecipe] = useState<Recipe | null>(recipe);
  const [isTranslating, setIsTranslating] = useState(false);
  const { toast } = useToast();
  const { applySettingsToUtterance } = useVoiceSettings();
  const { isCalculating, calculateNutrition, setNutrition } = useNutritionCalculator();

  // Update local recipe when prop changes
  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setIsPaused(false);
    setIsGeneratingScript(false);
    setLocalRecipe(recipe);
    setCurrentImageIndex(0); // Reset image index when recipe changes

    // Set existing nutrition data if available
    if (recipe && recipe.calories !== undefined) {
      setNutrition({
        calories: recipe.calories || 0,
        protein: recipe.protein || 0,
        carbohydrates: recipe.carbohydrates || 0,
        fat: recipe.fat || 0,
        fiber: recipe.fiber || 0,
        sugar: recipe.sugar || 0,
        sodium: recipe.sodium || 0
      });
    }
  }, [recipe, setNutrition]);

  // Cleanup speech synthesis when component unmounts or modal closes
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Stop speech when modal closes
  useEffect(() => {
    if (!isOpen) {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsPlaying(false);
      setIsPaused(false);
      setIsGeneratingScript(false);
    }
  }, [isOpen]);

  // Group ingredients by section for multi-part recipes (memoized)
  const ingredientsBySection = useMemo(() => {
    if (!localRecipe || !localRecipe.ingredients) {
      return new Map();
    }

    const grouped = new Map<string | null, typeof localRecipe.ingredients>();
    localRecipe.ingredients.forEach(ing => {
      const section = ing.section || null;
      if (!grouped.has(section)) {
        grouped.set(section, []);
      }
      grouped.get(section)!.push(ing);
    });

    // Debug logging
    console.log('🥕 Ingredientes agrupados:', {
      totalIngredients: localRecipe.ingredients.length,
      sections: Array.from(grouped.keys()),
      groupedData: Array.from(grouped.entries()).map(([section, ings]) => ({
        section: section || '(sin sección)',
        count: ings.length
      }))
    });

    return grouped;
  }, [localRecipe]);

  // Group instructions by section for multi-part recipes (memoized)
  const instructionsBySection = useMemo(() => {
    if (!localRecipe || !localRecipe.instructions) {
      return new Map();
    }

    const grouped = new Map<string | null, typeof localRecipe.instructions>();

    // Debug logging - check raw data first
    console.log('📝 RecipeModal - Raw instructions data:', {
      totalInstructions: localRecipe.instructions.length,
      firstInstruction: localRecipe.instructions[0],
      allInstructions: localRecipe.instructions.map(inst => ({
        step: inst.step,
        section: inst.section,
        hasSection: !!inst.section
      }))
    });

    localRecipe.instructions.forEach(inst => {
      const section = inst.section || null;
      if (!grouped.has(section)) {
        grouped.set(section, []);
      }
      grouped.get(section)!.push(inst);
    });

    // Debug logging
    console.log('📝 Instrucciones agrupadas:', {
      totalInstructions: localRecipe.instructions.length,
      sections: Array.from(grouped.keys()),
      groupedData: Array.from(grouped.entries()).map(([section, insts]) => ({
        section: section || '(sin sección)',
        count: insts.length
      }))
    });

    return grouped;
  }, [localRecipe]);

  // Early return AFTER all hooks
  if (!localRecipe || !localRecipe.ingredients || !localRecipe.instructions) return null;

  // Si la receta ya trae las configuraciones Thermomix incrustadas en el texto de los pasos
  // (recetas nuevas), no mostramos los badges debajo. Solo se usan en recetas viejas (texto sin config).
  const settingsInline = localRecipe.instructions.some(i => hasInlineThermomix(i.description));
  const suggestionItems = (localRecipe.suggestions || '')
    .split(/\r?\n/)
    .map(suggestion => suggestion.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, '').trim())
    .filter(Boolean)
    .filter(suggestion => !/^tm\d*$/i.test(suggestion.replace(/[^a-z0-9]/gi, '')));
  const sourceLabel = getRecipeSource(localRecipe) || undefined;
  const recipeCollections = collections.filter(collection =>
    collection.recipeIds.includes(localRecipe.id)
  );
  const authorLabel = (localRecipe.author
    || (localRecipe.sourceUrl && isValidUrl(localRecipe.sourceUrl)
      ? getSourceFromUrl(localRecipe.sourceUrl)
      : 'Receta propia')).trim().replace(/^@+/, '');
  const showAuthor = !sourceLabel
    || normalizeSourceIdentity(sourceLabel) !== normalizeSourceIdentity(authorLabel);
  const hasNutritionData = (recipe: Recipe) => {
    return recipe.calories !== null && recipe.calories !== undefined && recipe.calories > 0;
  };

  const nextImage = () => {
    const imagesLength = localRecipe.images?.length ?? 0;
    if (imagesLength > 1) {
      setCurrentImageIndex((prev) => (prev + 1) % imagesLength);
    }
  };

  const prevImage = () => {
    const imagesLength = localRecipe.images?.length ?? 0;
    if (imagesLength > 1) {
      setCurrentImageIndex((prev) => (prev - 1 + imagesLength) % imagesLength);
    }
  };

  const generateTTSScript = async (recipe: Recipe): Promise<string> => {
    try {
      setIsGeneratingScript(true);

      // Format ingredients with sections
      let ingredientsText = '';
      Array.from(ingredientsBySection.entries()).forEach(([section, ingredients]) => {
        if (section) {
          ingredientsText += `\n${section}:\n`;
        }
        ingredients.forEach(ing => {
          ingredientsText += `- ${ing.amount} ${ing.unit || ''} ${ing.name}\n`;
        });
      });

      // Format instructions with sections
      let instructionsText = '';
      let stepCounter = 1;
      Array.from(instructionsBySection.entries()).forEach(([section, instructions]) => {
        if (section) {
          instructionsText += `\n${section}:\n`;
        }
        instructions.forEach(inst => {
          instructionsText += `${stepCounter}. ${inst.description}\n`;
          stepCounter++;
        });
      });

      const prompt = `Genera un script para explicar esta receta de cocina en un video. El script debe ser natural, entusiasta y fácil de seguir. NO te presentes ni menciones tu nombre, simplemente explica la receta directamente. Los datos de la receta son:

Título: ${recipe.title}
Descripción: ${recipe.description || 'Sin descripción'}
Tiempo de preparación: ${recipe.prepTime || 'No especificado'} minutos
Tiempo de cocción: ${recipe.cookTime || 'No especificado'} minutos
Porciones: ${recipe.servings || 'No especificado'}
Dificultad: ${recipe.difficulty || 'No especificada'}

Ingredientes:
${ingredientsText}

Instrucciones:
${instructionsText}

IMPORTANTE: Si hay secciones en los ingredientes o instrucciones (por ejemplo "Para la masa", "Para el relleno"), menciónalas claramente en el script para que el oyente entienda que esta receta tiene múltiples partes. Por ejemplo: "Para la masa necesitaremos..." o "Ahora vamos con el relleno...".

Genera un script natural y conversacional explicando la receta paso a paso. Comienza directamente con la receta sin presentarte. Que sea fluido y agradable de escuchar.`;

      const response = await api.llm.generateScript(prompt);

      if (response && response.success && response.script) {
        return response.script;
      } else {
        throw new Error('Failed to generate script');
      }
    } catch (error) {
      console.error('Error generating TTS script:', error);
      toast({
        title: "Error",
        description: "No se pudo generar el script automáticamente",
        variant: "destructive",
      });
      return '';
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const speakText = async (text: string) => {
    if (!text.trim()) {
      toast({
        title: "Sin contenido",
        description: "No hay texto para reproducir",
        variant: "destructive",
      });
      return;
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      applySettingsToUtterance(utterance);

      utterance.onstart = () => setIsPlaying(true);
      utterance.onend = () => {
        setIsPlaying(false);
        setIsPaused(false);
      };
      utterance.onerror = (event) => {
        setIsPlaying(false);
        setIsPaused(false);
        if (event.error === 'canceled' || event.error === 'interrupted') return;
        console.error('Speech synthesis error:', event.error);
        toast({
          title: "Error de reproducción",
          description: "No se pudo reproducir el audio",
          variant: "destructive",
        });
      };

      window.speechSynthesis.speak(utterance);
    } else {
      toast({
        title: "No compatible",
        description: "TTS no es soportado en este navegador",
        variant: "destructive",
      });
    }
  };

  const handleCalculateNutrition = async () => {
    if (!localRecipe || !localRecipe.ingredients || localRecipe.ingredients.length === 0) {
      toast({
        title: "Sin ingredientes",
        description: "Esta receta no tiene ingredientes para calcular nutrición",
        variant: "destructive",
      });
      return;
    }

    try {
      const ingredients = localRecipe.ingredients.map(ing => ({
        name: ing.name,
        amount: ing.amount,
        unit: ing.unit || undefined
      }));

      const nutritionResult = await calculateNutrition(ingredients, localRecipe.servings);

      if (nutritionResult) {
        // Update the recipe with nutrition data
        const updatedRecipe = {
          ...localRecipe,
          calories: nutritionResult.calories,
          protein: nutritionResult.protein,
          carbohydrates: nutritionResult.carbohydrates,
          fat: nutritionResult.fat,
          fiber: nutritionResult.fiber,
          sugar: nutritionResult.sugar,
          sodium: nutritionResult.sodium
        };

        try {
          // Clean the recipe data to match API expectations
          const cleanedRecipe = {
            title: updatedRecipe.title,
            description: updatedRecipe.description || undefined,
            suggestions: updatedRecipe.suggestions || undefined,
            prepTime: updatedRecipe.prepTime,
            cookTime: updatedRecipe.cookTime,
            servings: updatedRecipe.servings,
            difficulty: updatedRecipe.difficulty,
            recipeType: updatedRecipe.recipeType,
            dishType: updatedRecipe.dishType,
            vegetarian: updatedRecipe.vegetarian,
            proteica: updatedRecipe.proteica,
            sugarFree: updatedRecipe.sugarFree,
            sweet: updatedRecipe.sweet,
            savory: updatedRecipe.savory,
            locution: updatedRecipe.locution || "",
            calories: updatedRecipe.calories,
            protein: updatedRecipe.protein,
            carbohydrates: updatedRecipe.carbohydrates,
            fat: updatedRecipe.fat,
            fiber: updatedRecipe.fiber,
            sugar: updatedRecipe.sugar,
            sodium: updatedRecipe.sodium,
            images: (updatedRecipe.images || []).map((image, index) => ({
              url: image.url,
              localPath: image.localPath ?? undefined,
              order: image.order || index + 1,
              altText: image.altText ?? undefined,
            })),
            ingredients: updatedRecipe.ingredients.map((ing, index) => ({
              name: ing.name,
              amount: ing.amount || "",  // Ensure amount is never null/undefined
              unit: ing.unit || "",
              section: ing.section || undefined,
              order: ing.order || index + 1
            })),
            instructions: updatedRecipe.instructions.map((inst, index) => ({
              step: inst.step || index + 1,
              description: inst.description,
              time: inst.thermomixSettings?.time || "",
              temperature: inst.thermomixSettings?.temperature || "",
              speed: inst.thermomixSettings?.speed || "",
              section: inst.section || undefined
            })),
            tags: (updatedRecipe.tags || []).map(tag =>
              typeof tag === 'string' ? tag : tag.tag || tag.name || String(tag)
            ).filter(tag => tag && tag.length > 0)
          };

          const savedRecipe = await api.recipes.update(localRecipe.id, cleanedRecipe);

          // Update local state
          setLocalRecipe(savedRecipe);

          // Notify parent if callback provided
          if (onRecipeUpdate) {
            onRecipeUpdate(savedRecipe);
          }

          toast({
            title: "¡Nutrición calculada!",
            description: "La información nutricional se ha guardado en la receta",
          });
        } catch (error) {
          console.error('Error saving nutrition data:', error);
          toast({
            title: "Error al guardar",
            description: error instanceof Error
              ? error.message
              : "No se pudo guardar la información nutricional",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error('Error calculating nutrition:', error);
    }
  };

  // Traduce la receta al español y la guarda.
  const handleTranslateRecipe = async () => {
    if (!localRecipe) return;
    setIsTranslating(true);
    try {
      const result = await api.llm.translateRecipe({
        title: localRecipe.title || '',
        description: localRecipe.description || '',
        suggestions: localRecipe.suggestions || '',
        ingredients: (localRecipe.ingredients || []).map(ing => ing.name),
        instructions: (localRecipe.instructions || []).map(inst => inst.description),
      });

      const updatedRecipe: Recipe = {
        ...localRecipe,
        title: result.title || localRecipe.title,
        description: result.description || localRecipe.description,
        suggestions: result.suggestions || localRecipe.suggestions,
        language: 'Español',
        ingredients: (localRecipe.ingredients || []).map((ing, index) => {
          const convertedGrams = isOunceUnit(ing.unit) ? convertOunceAmountToGrams(ing.amount) : null;
          const translatedUnit = translateIngredientUnit(ing.unit);
          return {
            ...ing,
            name: result.ingredients[index] ?? ing.name,
            amount: convertedGrams ?? ing.amount,
            unit: convertedGrams ? 'g' : translatedUnit,
          };
        }),
        instructions: (localRecipe.instructions || []).map((inst, index) => ({
          ...inst,
          description: result.instructions[index] ?? inst.description,
        })),
      };

      const cleanedRecipe = {
        title: updatedRecipe.title,
        description: updatedRecipe.description || undefined,
        suggestions: updatedRecipe.suggestions || undefined,
        language: 'Español',
        images: (updatedRecipe.images || []).map((image, index) => ({
          url: image.url,
          localPath: image.localPath ?? undefined,
          order: image.order || index + 1,
          altText: image.altText ?? undefined,
        })),
        ingredients: updatedRecipe.ingredients.map((ing, index) => ({
          name: ing.name,
          amount: ing.amount || "",
          unit: ing.unit || "",
          section: ing.section || undefined,
          order: ing.order || index + 1,
        })),
        instructions: updatedRecipe.instructions.map((inst, index) => ({
          step: inst.step || index + 1,
          description: inst.description,
          time: inst.thermomixSettings?.time || "",
          temperature: inst.thermomixSettings?.temperature || "",
          speed: inst.thermomixSettings?.speed || "",
          section: inst.section || undefined,
        })),
        tags: (updatedRecipe.tags || []).map(tag =>
          typeof tag === 'string' ? tag : tag.tag || tag.name || String(tag)
        ).filter(tag => tag && tag.length > 0),
      };

      const savedRecipe = await api.recipes.update(localRecipe.id, cleanedRecipe as any);
      setLocalRecipe(savedRecipe);
      if (onRecipeUpdate) onRecipeUpdate(savedRecipe);

      toast({ title: "Receta traducida", description: "La receta se tradujo al español." });
    } catch (error) {
      toast({
        title: "No se pudo traducir",
        description: error instanceof Error ? error.message : "Intentá nuevamente",
        variant: "destructive",
      });
    } finally {
      setIsTranslating(false);
    }
  };

  const handlePlayTTS = async () => {
    if (isPlaying) {
      window.speechSynthesis.pause();
      setIsPlaying(false);
      setIsPaused(true);
      return;
    }

    if (isPaused && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setIsPlaying(true);
      setIsPaused(false);
      return;
    }

    setIsPaused(false);

    let scriptText = localRecipe.locution;

    if (!scriptText?.trim()) {
      scriptText = await generateTTSScript(localRecipe);

      if (scriptText) {
        try {
          const updatedRecipe = { ...localRecipe, locution: scriptText };

          // Clean the recipe data to match backend schema
          const cleanedRecipe = {
            title: updatedRecipe.title,
            description: updatedRecipe.description,
            suggestions: updatedRecipe.suggestions || undefined,
            prepTime: updatedRecipe.prepTime,
            cookTime: updatedRecipe.cookTime,
            servings: updatedRecipe.servings,
            difficulty: updatedRecipe.difficulty,
            recipeType: updatedRecipe.recipeType,
            dishType: updatedRecipe.dishType,
            vegetarian: updatedRecipe.vegetarian,
            proteica: updatedRecipe.proteica,
            sugarFree: updatedRecipe.sugarFree,
            sweet: updatedRecipe.sweet,
            savory: updatedRecipe.savory,
            locution: updatedRecipe.locution,
            images: updatedRecipe.images,
            ingredients: updatedRecipe.ingredients.map(ing => ({
              name: ing.name,
              amount: ing.amount || "",
              unit: ing.unit || "",
              order: ing.order
            })),
            instructions: updatedRecipe.instructions.map(inst => ({
              step: inst.step,
              description: inst.description,
              time: inst.thermomixSettings?.time || "",
              temperature: inst.thermomixSettings?.temperature || "",
              speed: inst.thermomixSettings?.speed || ""
            })),
            tags: updatedRecipe.tags.map(tag =>
              typeof tag === 'string' ? tag : tag.tag || tag.name || String(tag)
            ).filter(tag => tag && tag.length > 0)
          };

          await api.recipes.update(localRecipe.id, cleanedRecipe);

          // Update local state to prevent regeneration
          setLocalRecipe(updatedRecipe);

          // Notify parent if callback provided
          if (onRecipeUpdate) {
            onRecipeUpdate(updatedRecipe);
          }
        } catch (error) {
          console.error('Error saving generated script:', error);
        }
      }
    }

    if (scriptText) {
      await speakText(scriptText);
    }
  };

  const currentImage = localRecipe.images?.[currentImageIndex];

  const handleModalClose = () => {
    // Cleanup and reset states before closing
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setIsPaused(false);
    setIsGeneratingScript(false);
    setCurrentImageIndex(0);
    onClose();
  };

  const handlePdfAction = async (action: 'share' | 'print' | 'download') => {
    if (!localRecipe) return;

    setLoadingStates(prev => ({ ...prev, [action]: true }));
    try {
      switch (action) {
        case 'share':
          await shareRecipePdf(localRecipe);
          toast({
            title: "PDF compartido",
            description: "La receta se compartió exitosamente",
          });
          break;
        case 'print':
          await printRecipePdf(localRecipe);
          toast({
            title: "Enviando a imprimir",
            description: "Enviando PDF a la impresora...",
          });
          break;
        case 'download':
          await downloadRecipePdf(localRecipe);
          toast({
            title: "PDF descargado",
            description: "PDF descargado exitosamente",
          });
          break;
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || 'Error al procesar el PDF',
        variant: "destructive",
      });
    } finally {
      setLoadingStates(prev => ({ ...prev, [action]: false }));
    }
  };

  const imageActionButtons = (
    <div
      className="absolute right-3 top-3 z-10 flex items-center justify-end gap-1.5"
      onClick={(event) => event.stopPropagation()}
    >
      {onToggleFavorite && (
        <Button
          variant="secondary"
          size="sm"
          className={`order-1 h-9 w-9 p-0 ${localRecipe.featured ? 'bg-red-100/80 hover:bg-red-200/90' : 'bg-white/80 hover:bg-white/90'}`}
          onClick={() => onToggleFavorite(localRecipe)}
          title={localRecipe.featured ? 'Quitar de Favoritos' : 'Agregar a Favoritos'}
          aria-label={localRecipe.featured ? 'Quitar de Favoritos' : 'Agregar a Favoritos'}
        >
          <Heart
            className={localRecipe.featured ? 'fill-red-500 text-red-500' : 'text-gray-600'}
            style={{ width: 20, height: 20 }}
          />
        </Button>
      )}

      {(onToggleFeature || onToggleCooked || onToggleFavorite) && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="order-3 h-9 w-9 bg-white/80 p-0 hover:bg-white/90"
              title="Caracteristicas"
              aria-label="Caracteristicas"
            >
              <ChefHat className="!h-5 !w-5 text-gray-500" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="max-h-[calc(100vh-2rem)] w-56 overflow-y-auto p-1.5">
            <p className="px-1 pb-1 text-sm font-semibold text-muted-foreground">Caracteristicas</p>
            <div className="space-y-0.5">
              {DETAIL_FEATURE_TOGGLES.map(({ field, label, icon }) => {
                const active = Boolean(localRecipe[field]);
                return (
                  <button
                    key={field}
                    type="button"
                    onClick={() => {
                      if (field === 'featured' && onToggleFavorite) {
                        onToggleFavorite(localRecipe);
                      } else if (field === 'cooked' && onToggleCooked) {
                        onToggleCooked(localRecipe);
                      } else {
                        onToggleFeature?.(localRecipe, field, !active);
                      }
                    }}
                    className={`flex w-full items-center justify-between gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors ${active ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-muted'}`}
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">{icon}</span>
                      <span className="truncate text-left">{label}</span>
                    </span>
                    <span className={`w-6 shrink-0 text-right text-[10px] font-bold ${active ? 'text-primary' : 'text-muted-foreground/50'}`}>
                      {active ? 'ON' : 'OFF'}
                    </span>
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {onSaveToCollection && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="order-2 h-9 w-9 bg-white/80 p-0 hover:bg-white/90"
          onClick={() => onSaveToCollection(localRecipe)}
          title="Agregar a una coleccion"
          aria-label="Agregar a una coleccion"
        >
          <Bookmark
            aria-hidden="true"
            className={isInCollection ? 'fill-primary text-primary' : 'text-gray-600'}
            style={{ width: 20, height: 20 }}
          />
        </Button>
      )}

      {localRecipe.sourceUrl && isValidUrl(localRecipe.sourceUrl) && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="order-4 h-9 w-9 bg-white/80 p-0 hover:bg-white/90"
          onClick={() => window.open(localRecipe.sourceUrl, '_blank', 'noopener,noreferrer')}
          title={`Ver receta original en ${getSourceFromUrl(localRecipe.sourceUrl)}`}
          aria-label="Ver receta original"
        >
          <ExternalLink className="h-4 w-4 text-gray-600" />
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="order-5 h-9 w-9 bg-white/80 p-0 hover:bg-white/90"
            title="Mas opciones"
            aria-label="Mas opciones"
          >
            <MoreVertical className="h-4 w-4 text-gray-600" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => window.open(`/receta/${localRecipe.id}`, '_blank', 'noopener,noreferrer')}>
            <ArrowUpRightFromSquare className="mr-2 h-4 w-4" />
            Abrir en una nueva pestaña
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsEditModalOpen(true)}>
            <Edit className="mr-2 h-4 w-4" />
            Editar receta
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handlePdfAction('print')}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir
          </DropdownMenuItem>
          {onDelete && (
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(localRecipe)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar receta
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <>
    <ModalShell
      isPage={isPage}
      isOpen={isOpen}
      onOpenChange={handleModalClose}
      scrollRef={scrollRef}
      contentStyle={dragContentStyle}
      headerDragProps={dragHandleProps}
      header={
        <DialogHeader className={isPage ? "mb-6" : ""}>
          <div className="flex items-center justify-between gap-4">
            {isPage ? (
              <h1 className="text-3xl font-semibold leading-tight tracking-tight">{localRecipe.title}</h1>
            ) : (
              <DialogTitle className="text-3xl">{localRecipe.title}</DialogTitle>
            )}
            <div className="flex flex-shrink-0 items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={onPreviousRecipe}
                disabled={!hasPreviousRecipe}
                title="Receta anterior"
                aria-label="Receta anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={onNextRecipe}
                disabled={!hasNextRecipe}
                title="Receta siguiente"
                aria-label="Receta siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditModalOpen(true)}
              >
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
              {!isPage && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleModalClose}
                  title="Cerrar"
                  aria-label="Cerrar"
                  className="h-8 w-8 rounded-md border-0 bg-primary/65 p-0 text-foreground shadow-sm backdrop-blur-sm hover:bg-primary/80"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
              {isPage && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.close()}
                  title="Cerrar la pestaña"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cerrar
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>
      }
    >

        <div className="space-y-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="space-y-3 sm:w-96 sm:flex-shrink-0">
          {currentImage ? (
            <div className="relative">
              <img
                src={resolveImageUrl(currentImage.url)}
                alt={currentImage.altText || localRecipe.title}
                className={`aspect-square w-full object-cover rounded-lg ${localRecipe.sourceUrl && isValidUrl(localRecipe.sourceUrl) ? 'cursor-pointer' : ''}`}
                crossOrigin="anonymous"
                loading="lazy"
                onClick={() => {
                  if (localRecipe.sourceUrl && isValidUrl(localRecipe.sourceUrl)) {
                    window.open(localRecipe.sourceUrl, '_blank', 'noopener,noreferrer');
                  }
                }}
                title={localRecipe.sourceUrl && isValidUrl(localRecipe.sourceUrl) ? 'Ver receta original' : undefined}
              />

              {imageActionButtons}
              <div className="hidden">
                {onToggleFavorite && (
                  <Button
                    variant="outline"
                    size="sm"
                    className={localRecipe.featured ? 'bg-red-100/80 h-9 w-9 p-0 hover:bg-red-200/90' : 'bg-white/80 h-9 w-9 p-0 hover:bg-white/90'}
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleFavorite(localRecipe);
                    }}
                    title={localRecipe.featured ? "Quitar de Favoritos" : "Agregar a Favoritos"}
                    aria-label={localRecipe.featured ? "Quitar de Favoritos" : "Agregar a Favoritos"}
                  >
                    <Heart
                      className={
                        localRecipe.featured
                          ? "fill-red-500 text-red-500"
                          : "text-gray-600"
                      }
                      style={{ width: 20, height: 20 }}
                    />
                  </Button>
                )}
                {onToggleCooked && (
                  <Button
                    variant="outline"
                    size="sm"
                    className={localRecipe.cooked ? 'bg-green-100/80 h-9 w-9 p-0 hover:bg-green-200/90' : 'bg-white/80 h-9 w-9 p-0 hover:bg-white/90'}
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleCooked(localRecipe);
                    }}
                    title={localRecipe.cooked ? "Marcar como no cocinada" : "Marcar como cocinada"}
                    aria-label={localRecipe.cooked ? "Marcar como no cocinada" : "Marcar como cocinada"}
                  >
                    <RecipePreparedIcon
                      className={localRecipe.cooked ? "" : "text-gray-600"}
                      style={{ width: 30, height: 30, color: localRecipe.cooked ? '#8ebf4c' : undefined }}
                    />
                  </Button>
                )}
                {onSaveToCollection && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white/80 h-9 w-9 p-0 hover:bg-white/90"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSaveToCollection(localRecipe);
                    }}
                    title="Agregar a una colección"
                    aria-label="Agregar a una colección"
                  >
                    <Bookmark
                      aria-hidden="true"
                      className={isInCollection ? "fill-primary text-primary" : "text-gray-600"}
                      style={{ width: 20, height: 20 }}
                    />
                  </Button>
                )}
              </div>

              {(localRecipe.images?.length ?? 0) > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/50 text-white rounded-full p-2 hover:bg-black/70 transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/50 text-white rounded-full p-2 hover:bg-black/70 transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/50 text-white px-2 py-1 rounded text-sm">
                    {currentImageIndex + 1} / {localRecipe.images?.length ?? 0}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="relative aspect-square w-full bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
              {imageActionButtons}
              <div className="hidden">
                {onToggleFavorite && (
                  <Button
                    variant="outline"
                    size="sm"
                    className={localRecipe.featured ? 'bg-red-100/80 h-9 w-9 p-0 hover:bg-red-200/90' : 'bg-white/80 h-9 w-9 p-0 hover:bg-white/90'}
                    onClick={() => onToggleFavorite(localRecipe)}
                    title={localRecipe.featured ? "Quitar de Favoritos" : "Agregar a Favoritos"}
                    aria-label={localRecipe.featured ? "Quitar de Favoritos" : "Agregar a Favoritos"}
                  >
                    <Heart
                      className={localRecipe.featured ? "fill-red-500 text-red-500" : "text-gray-600"}
                      style={{ width: 20, height: 20 }}
                    />
                  </Button>
                )}
                {onToggleCooked && (
                  <Button
                    variant="outline"
                    size="sm"
                    className={localRecipe.cooked ? 'bg-green-100/80 h-9 w-9 p-0 hover:bg-green-200/90' : 'bg-white/80 h-9 w-9 p-0 hover:bg-white/90'}
                    onClick={() => onToggleCooked(localRecipe)}
                    title={localRecipe.cooked ? "Marcar como no cocinada" : "Marcar como cocinada"}
                    aria-label={localRecipe.cooked ? "Marcar como no cocinada" : "Marcar como cocinada"}
                  >
                    <RecipePreparedIcon
                      className={localRecipe.cooked ? "" : "text-gray-600"}
                      style={{ width: 30, height: 30, color: localRecipe.cooked ? '#8ebf4c' : undefined }}
                    />
                  </Button>
                )}
                {onSaveToCollection && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white/80 h-9 w-9 p-0 hover:bg-white/90"
                    onClick={() => onSaveToCollection(localRecipe)}
                    title="Agregar a una colección"
                    aria-label="Agregar a una colección"
                  >
                    <Bookmark
                      aria-hidden="true"
                      className={isInCollection ? "fill-primary text-primary" : "text-gray-600"}
                      style={{ width: 20, height: 20 }}
                    />
                  </Button>
                )}
              </div>
              <div className="text-center">
                <ChefHat className="h-16 w-16 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">Sin imagen</p>
              </div>
            </div>
          )}

          <div className="space-y-2 text-sm text-muted-foreground">
              {/* Línea 1: tiempos y porciones */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {!!localRecipe.prepTime && localRecipe.prepTime > 0 && (
                  <div className="flex items-center gap-2" title="Tiempo de preparación">
                    <PreparationTimeIcon className="h-5 w-5" />
                    <span>Prep. {localRecipe.prepTime} min</span>
                  </div>
                )}
                {!!localRecipe.cookTime && localRecipe.cookTime > 0 && (
                  <div className="flex items-center gap-2" title="Tiempo total">
                    <Clock className="h-4 w-4" />
                    <span>Total {localRecipe.cookTime} min</span>
                  </div>
                )}
                {!!localRecipe.servings && localRecipe.servings > 0 && (
                  <div className="flex items-center gap-2" title="Porciones">
                    <User className="h-4 w-4" />
                    <span>Porciones {localRecipe.servings}</span>
                  </div>
                )}
              </div>
              {/* Caracteristicas activas en el orden definido para el detalle de receta. */}
              <div className="grid grid-cols-3 gap-x-6 gap-y-2 whitespace-nowrap [&_.feat-ico]:flex [&_.feat-ico]:h-6 [&_.feat-ico]:w-6 [&_.feat-ico]:shrink-0 [&_.feat-ico]:items-center [&_.feat-ico]:justify-center">
                {isThermomixRecipe(localRecipe) && (
                  <div className="flex items-center gap-2">
                    <span className="feat-ico"><img src="/thermomix-logo.png" alt="" aria-hidden="true" className="h-5 w-5 object-contain mix-blend-multiply" /></span>
                    <span>Thermomix</span>
                  </div>
                )}
                {localRecipe.airFryer && (
                  <div className="flex items-center gap-2" title="Receta para freidora de aire">
                    <span className="feat-ico"><img src="/air-fryer.png" alt="" aria-hidden="true" className="h-5 w-5 object-contain mix-blend-multiply" /></span>
                    <span>Air Fryer</span>
                  </div>
                )}
                {localRecipe.glutenFree && (
                  <div className="flex items-center gap-2" title="Sin gluten">
                    <span className="feat-ico"><WheatOff className="h-5 w-5" /></span>
                    <span>Sin Gluten</span>
                  </div>
                )}
                {localRecipe.sugarFree && (
                  <div className="flex items-center gap-2" title="Sin Azucar">
                    <span className="feat-ico"><CandyOff className="h-5 w-5" /></span>
                    <span>Sin Azucar</span>
                  </div>
                )}
                {localRecipe.keto && (
                  <div className="flex items-center gap-2" title="Receta keto">
                    <span className="feat-ico"><AvocadoIcon className="h-5 w-5" /></span>
                    <span>Keto</span>
                  </div>
                )}
                {localRecipe.lowCarb && (
                  <div className="flex items-center gap-2" title="Low Carb">
                    <span className="feat-ico"><img src="/logo-saludable.png" alt="" aria-hidden="true" className="h-5 w-5 object-contain grayscale opacity-70" /></span>
                    <span>Low Carb</span>
                  </div>
                )}
                {localRecipe.proteica && (
                  <div className="flex items-center gap-2" title="Proteica">
                    <span className="feat-ico"><Beef className="h-5 w-5" /></span>
                    <span>Proteica</span>
                  </div>
                )}
                {localRecipe.vegetarian && (
                  <div className="flex items-center gap-2" title="Vegetariana">
                    <span className="feat-ico"><Leaf className="h-5 w-5" /></span>
                    <span>Vegetariana</span>
                  </div>
                )}
                {localRecipe.sweet && (
                  <div className="flex items-center gap-2" title="Receta dulce">
                    <span className="feat-ico"><CakeSlice className="h-5 w-5" /></span>
                    <span>Receta dulce</span>
                  </div>
                )}
                {localRecipe.savory && (
                  <div className="flex items-center gap-2" title="Receta salada">
                    <span className="feat-ico"><Utensils className="h-5 w-5" /></span>
                    <span>Receta salada</span>
                  </div>
                )}
                {localRecipe.cooked && (
                  <div className="flex items-center gap-2" title="Receta cocinada">
                    <span className="feat-ico"><RecipePreparedIcon className="h-5 w-5" /></span>
                    <span>Cocinada</span>
                  </div>
                )}
                {localRecipe.featured && (
                  <div className="flex items-center gap-2" title="Receta favorita">
                    <span className="feat-ico"><Heart className="h-5 w-5 fill-current" /></span>
                    <span>Favorita</span>
                  </div>
                )}
              </div>
            </div>
            
          </div>

          {/* Columna derecha: botones de acción + metadata */}
          <div className="flex-1 space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  window.open(`/receta/${localRecipe.id}`, '_blank', 'noopener,noreferrer');
                  onClose();
                }}
                title="Abrir receta en pestaña nueva"
                aria-label="Abrir receta en pestaña nueva"
              >
                <ArrowUpRightFromSquare className="h-4 w-4" />
              </Button>
              {localRecipe.sourceUrl && isValidUrl(localRecipe.sourceUrl) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(localRecipe.sourceUrl, '_blank')}
                  title={`Ver en ${getSourceFromUrl(localRecipe.sourceUrl)}`}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                title="Imprimir"
                onClick={() => handlePdfAction('print')}
                disabled={loadingStates.print}
              >
                {loadingStates.print ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                ) : (
                  <Printer className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                title="Descargar"
                onClick={() => handlePdfAction('download')}
                disabled={loadingStates.download}
              >
                {loadingStates.download ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                title="Compartir"
                aria-label="Compartir receta"
                onClick={() => handlePdfAction('share')}
                disabled={loadingStates.share}
              >
                {loadingStates.share ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePlayTTS}
                disabled={isGeneratingScript}
                title={isPlaying ? "Pausar audio" : "Escuchar receta"}
              >
                {isGeneratingScript ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                ) : isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
              {onDelete && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onDelete(localRecipe)}
                  title="Eliminar receta"
                  aria-label="Eliminar receta"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start justify-items-start gap-x-4 gap-y-2 text-sm">
              {sourceLabel && (
                <div className="contents">
                  <h3 className="font-semibold text-base">Fuente</h3>
                  {localRecipe.sourceUrl && isValidUrl(localRecipe.sourceUrl) ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a
                          href={localRecipe.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="recipe-source-link text-primary hover:underline inline-flex items-center gap-1"
                        >
                          {sourceLabel}
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[min(32rem,calc(100vw-2rem))] break-all">
                        {localRecipe.sourceUrl}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className="recipe-source-link">{sourceLabel}</span>
                  )}
                </div>
              )}

              {/* Campo Autor oculto por ahora */}

              <div className="contents">
                <h3 className="font-semibold text-base">Origen</h3>
                <Badge>
                  {localRecipe.importedFrom
                    ? ({
                        www: 'Pagina web',
                        instagram: 'Instagram',
                        youtube: 'YouTube',
                        doc: 'DOC'
                      }[localRecipe.importedFrom] || localRecipe.importedFrom)
                    : 'Receta propia'}
                </Badge>
              </div>

              {localRecipe.difficulty && (
                <div className="contents">
                  <h3 className="font-semibold text-base">Dificultad</h3>
                  <Badge>{localRecipe.difficulty}</Badge>
                </div>
              )}

              {localRecipe.dishType && (
                <div className="contents">
                  <h3 className="font-semibold text-base">Tipo de comida</h3>
                  <Badge>{localRecipe.dishType}</Badge>
                </div>
              )}

              {parseCategories(localRecipe.recipeType).length > 0 && (
                <div className="contents">
                  <h3 className="font-semibold text-base">Categoría</h3>
                  <div className="flex flex-wrap gap-2 justify-self-stretch min-w-0">
                    {parseCategories(localRecipe.recipeType).map((cat) => (
                      <Badge key={cat}>{cat}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {recipeCollections.length > 0 && (
                <div className="contents">
                  <h3 className="font-semibold text-base">Colección</h3>
                  <div className="flex flex-wrap gap-2 justify-self-stretch min-w-0">
                    {recipeCollections.map((collection) => (
                      <Badge key={collection.id}>{collection.name}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {localRecipe.language && (
                <div className="contents">
                  <h3 className="font-semibold text-base">Idioma</h3>
                  <Badge>{localRecipe.language}</Badge>
                </div>
              )}
              {localRecipe.country && (
                <div className="contents">
                  <h3 className="font-semibold text-base">País</h3>
                  <Badge>{localRecipe.country}</Badge>
                </div>
              )}

              {localRecipe.createdAt && (
                <div className="contents">
                  <h3 className="font-semibold text-base">Fecha</h3>
                  <Badge>
                    {new Date(localRecipe.createdAt).toLocaleDateString('es-AR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}
                  </Badge>
                </div>
              )}

              <div className="contents">
                <h3 className="font-semibold text-base">Etiquetas</h3>
                <div className="flex min-w-0 flex-wrap gap-2 justify-self-stretch">
                  {(localRecipe.tags || []).map((tag, index) => {
                    const tagValue = typeof tag === 'string' ? tag : tag.tag || tag.name || String(tag);
                    const tagKey = typeof tag === 'string' ? tag : `${tag.tagId || tag.id || index}-${tagValue}`;
                    return (
                      <Badge key={tagKey}>{tagValue}</Badge>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          </div>

          {localRecipe.description && (
            <div>
              <p className="text-muted-foreground leading-relaxed">
                {localRecipe.description}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column: metadatos + ingredientes - 2/3 width */}
            <div className="lg:col-span-2 space-y-4">
              <h3 className="font-semibold text-xl">Ingredientes ({localRecipe.ingredients?.length || 0})</h3>
              {localRecipe.ingredients && localRecipe.ingredients.length > 0 ? (
                <div className="space-y-4">
                  {Array.from(ingredientsBySection.entries()).map(([section, ingredients], sectionIndex) => (
                    <div
                      key={sectionIndex}
                      className="space-y-2"
                    >
                      {section && (
                        <h4 className="recipe-section-title font-medium text-primary mt-3 first:mt-0">
                          {section}
                        </h4>
                      )}
                      <ul className="space-y-2 text-muted-foreground text-sm">
                        {ingredients.map((ingredient, index) => (
                          <li key={index} className="flex gap-2 break-inside-avoid">
                            <span className="flex h-6 items-center shrink-0">
                              <span className="w-1 h-1 bg-primary rounded-full" />
                            </span>
                            <span className={!ingredient.amount && !ingredient.unit && ingredient.name.includes('\n') ? 'whitespace-pre-wrap' : undefined}>
                              {(ingredient.amount || ingredient.unit) && (
                                <span className="font-medium">{ingredient.amount} {ingredient.unit}</span>
                              )}{' '}{ingredient.name}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No hay ingredientes especificados</p>
              )}
            </div>

            {/* Right column: Nutrition Label - 1/3 width */}
            <div className={`flex justify-center lg:col-span-1 lg:justify-start lg:pl-6 ${!hasNutritionData(localRecipe) ? 'pr-12' : ''}`}>
              <div className="sticky top-4">
                <NutritionLabel
                  nutrition={{
                    calories: localRecipe.calories,
                    protein: localRecipe.protein,
                    carbohydrates: localRecipe.carbohydrates,
                    fat: localRecipe.fat,
                    saturatedFat: localRecipe.saturatedFat,
                    fiber: localRecipe.fiber,
                    sugar: localRecipe.sugar,
                    sodium: localRecipe.sodium
                  }}
                  servings={localRecipe.servings}
                  showCalculateButton={!hasNutritionData(localRecipe)}
                  onCalculate={handleCalculateNutrition}
                  isCalculating={isCalculating}
                />
                {(localRecipe.language || '').trim() && !isSpanishLanguage(localRecipe.language) && (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3 w-full"
                    onClick={handleTranslateRecipe}
                    disabled={isTranslating}
                  >
                    {isTranslating
                      ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      : <Languages className="mr-2 h-4 w-4" />}
                    Traducir receta
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Preparación - solo si la receta tiene instrucciones */}
          {localRecipe.instructions && localRecipe.instructions.length > 0 && (
          <div className="space-y-4 pr-12">
            <h3 className="font-semibold text-xl">Preparación ({localRecipe.instructions.length} pasos)</h3>
              <div className="space-y-4">
                {Array.from(instructionsBySection.entries()).map(([section, instructions], sectionIndex) => (
                  <div key={sectionIndex} className="space-y-3">
                    {section && (
                      <h4 className="recipe-section-title font-medium text-primary mt-3 first:mt-0">
                        {section}
                      </h4>
                    )}
                    <ol className="space-y-3 text-muted-foreground text-sm">
                      {instructions.map((instruction, index) => (
                        <li key={index} className="flex gap-3">
                          <span className="flex-shrink-0 w-5 h-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium">
                            {instruction.step || index + 1}
                          </span>
                          <div className="flex-1">
                            <p><StepDescription text={instruction.description} /></p>
                            {/* Badges debajo solo para recetas viejas (sin las configuraciones
                                ya incrustadas en el texto). Las nuevas las muestran inline. */}
                            {hasThermomixSettings(instruction) && !settingsInline && (
                              <div className="flex gap-4 mt-1 text-sm text-primary">
                                {getThermomixSettingsDisplay(instruction).map((setting, index) => (
                                  <ThermomixSetting key={index} text={setting} />
                                ))}
                              </div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
          </div>
          )}

          {suggestionItems.length > 0 && (
            <div className="rounded-lg border border-primary/25 bg-primary/10 p-4">
              <h3 className="mb-3 font-semibold text-base text-foreground">Sugerencias</h3>
              <ul className="space-y-2 text-sm leading-relaxed text-muted-foreground">
                {suggestionItems.map((suggestion, index) => (
                  <li key={`${index}-${suggestion}`} className="flex gap-3">
                    <span className="flex h-5 shrink-0 items-center">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    </span>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Flechitas para ir al principio / al final del contenido */}
        <div className="pointer-events-none sticky bottom-3 z-30 ml-auto mr-3 flex w-fit translate-x-7 flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={scrollToTop}
            className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full bg-primary/65 text-foreground shadow-md backdrop-blur-sm transition-all hover:scale-105 hover:bg-primary/80"
            title="Ir al principio"
            aria-label="Ir al principio"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={scrollToBottom}
            className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full bg-primary/65 text-foreground shadow-md backdrop-blur-sm transition-all hover:scale-105 hover:bg-primary/80"
            title="Ir al final"
            aria-label="Ir al final"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
    </ModalShell>

      {/* Edit Recipe Modal */}
      {localRecipe && (
        <EditRecipeModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          recipe={localRecipe}
          onCollectionsUpdated={onCollectionsUpdated}
          onRecipeUpdated={(updatedRecipe) => {
            // No cerramos el editor al actualizar; queda abierto hasta "Finalizar".
            setLocalRecipe(updatedRecipe);

            // Notify parent component
            if (onRecipeUpdate) {
              onRecipeUpdate(updatedRecipe);
            }
          }}
        />
      )}
    </>
  );
};
