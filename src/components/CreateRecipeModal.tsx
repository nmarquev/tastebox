import { EditRecipeModal } from '@/components/EditRecipeModal';
import { Recipe } from '@/types/recipe';
import { RecipeCollection } from '@/services/api';

interface CreateRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecipeCreated: (recipe: Recipe) => void;
  onCollectionsUpdated?: (collections: RecipeCollection[]) => void;
}

const emptyRecipe: Recipe = {
  id: '',
  userId: '',
  title: '',
  description: '',
  suggestions: '',
  images: [],
  prepTime: null,
  cookTime: null,
  servings: null,
  difficulty: null,
  tags: [],
  ingredients: [],
  instructions: [],
  sourceUrl: '',
  source: '',
  author: '',
  recipeType: '',
  dishType: '',
  country: '',
  language: 'Español',
  thermomix: false,
  airFryer: false,
  glutenFree: false,
  keto: false,
  lowCarb: false,
  vegetarian: false,
  locution: '',
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const CreateRecipeModal = ({
  isOpen,
  onClose,
  onRecipeCreated,
  onCollectionsUpdated,
}: CreateRecipeModalProps) => (
  <EditRecipeModal
    isOpen={isOpen}
    onClose={onClose}
    recipe={emptyRecipe}
    onRecipeUpdated={onRecipeCreated}
    onCollectionsUpdated={onCollectionsUpdated}
    mode="create"
  />
);
