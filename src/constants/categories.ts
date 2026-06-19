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

// Una receta puede tener varias categorías; se guardan en el campo recipeType
// separadas por "|" (no coma, porque varias categorías contienen comas).
export const CATEGORY_SEPARATOR = '|';
export const parseCategories = (recipeType?: string | null): string[] =>
  (recipeType || '').split(CATEGORY_SEPARATOR).map(s => s.trim()).filter(Boolean);
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
