// Países disponibles para las recetas (campo country).
export const RECIPE_COUNTRIES = [
  "Argentina",
  "Australia",
  "Canadá",
  "Chile",
  "Colombia",
  "España",
  "Estados Unidos",
  "Guatemala",
  "Islandia",
  "México",
  "Panamá",
  "Paraguay",
  "Perú",
  "Reino Unido",
];

// Idiomas disponibles para las recetas (campo language).
export const RECIPE_LANGUAGES = ["Español", "Inglés"];

// Tipos de receta / plato disponibles (campo dishType), ordenados alfabéticamente.
export const RECIPE_DISH_TYPES = [
  "Bebida",
  "Desayuno y Merienda",
  "Entrada",
  "Guarnición",
  "Pastelería",
  "Plato principal",
  "Postre",
  "Snack",
];

// Una receta puede tener varias categorías; se guardan separadas por "|".
// También leemos listas viejas con coma sin romper categorías que contienen coma.
export const CATEGORY_SEPARATOR = '|';
export const parseCategories = (recipeType?: string | null): string[] => {
  const value = (recipeType || '').trim();
  if (!value) return [];
  if (value.includes(CATEGORY_SEPARATOR)) {
    return value.split(CATEGORY_SEPARATOR).map(s => s.trim()).filter(Boolean);
  }
  if (RECIPE_CATEGORIES.includes(value)) return [value];

  const parts = value.split(',').map(s => s.trim()).filter(Boolean);
  const categories: string[] = [];
  for (let i = 0; i < parts.length; i += 1) {
    let current = parts[i];
    while (i + 1 < parts.length && !RECIPE_CATEGORIES.includes(current)) {
      const candidate = `${current}, ${parts[i + 1]}`;
      if (!RECIPE_CATEGORIES.some(category => category.startsWith(candidate))) break;
      current = candidate;
      i += 1;
    }
    categories.push(current);
  }
  return categories;
};
export const joinCategories = (cats: string[]): string => cats.join(CATEGORY_SEPARATOR);

// Categorías disponibles para clasificar las recetas (campo recipeType).
export const RECIPE_CATEGORIES = [
  "Arroces y Risottos",
  "Polentas",
  "Bebidas con Alcohol",
  "Carnes",
  "Cerdo",
  "Cereales, Barritas y Frutos Secos",
  "Champiñones y Hongos",
  "Chocolates y Golosinas",
  "Comida Oriental",
  "Conservas y Escabeches",
  "Cremas y Salsas Dulces",
  "Crepes Dulces y Panqueques",
  "Crepes Salados y Wraps",
  "Croquetas, Tortillas y Hamburguesas",
  "Dips y Aderezos",
  "Dulces y Mermeladas",
  "Empanadas y Canastitas",
  "Ensaladas",
  "Entradas y Platos Fríos",
  "Fondues",
  "Fajitas, Tortillas y Tacos",
  "Frutas",
  "Guisos",
  "Harinas",
  "Helados",
  "Huevos y Omelettes",
  "Infusiones",
  "Jugos y Licuados",
  "Smoothies",
  "Keto y Low Carb",
  "Lácteos",
  "Leches y Mantecas Vegetales",
  "Legumbres y Cereales",
  "Masitas Dulces, Cookies y Facturas",
  "Masitas Saladas, Bizcochos y Palitos",
  "Muffins y Minicakes",
  "Panes",
  "Papas, Batatas y Zapallos",
  "Pastas",
  "Pescados",
  "Pizzas y Focaccias",
  "Pollos",
  "Postres",
  "Salsas y Pestos",
  "Sándwiches y Bruschettas",
  "Snacks",
  "Sopas y Caldos",
  "Tartas Dulces",
  "Tartas Saladas",
  "Tortas y Budines",
  "Verduras y Vegetales",
];
