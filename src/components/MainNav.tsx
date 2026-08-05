import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Check,
  CheckCircle2,
  Beef,
  CakeSlice,
  CandyOff,
  ChefHat,
  ChevronDown,
  ClipboardPaste,
  Copy,
  Download,
  Edit,
  Filter,
  Heart,
  Leaf,
  PlusCircle,
  Printer,
  Search,
  Sparkles,
  Trash2,
  Utensils,
  WheatOff,
} from "lucide-react";
import { AvocadoIcon } from "@/components/icons/AvocadoIcon";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { UncheckedIcon } from "@/components/icons/UncheckedIcon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const menuItems = [
  { label: "COLECCIONES", to: "/app?view=colecciones" },
  { label: "FUENTE", to: "/app?view=fuentes" },
  { label: "TIPO DE COMIDA", to: "/app?view=tipo-comida" },
];

const recipeTypeItems = [
  { label: "Todas las Recetas", to: "/app", icon: <ChefHat className="h-4 w-4" /> },
  { label: "Favoritas", to: "/app?filtro=favoritas", icon: <Heart className="h-4 w-4" /> },
  { label: "Checked", to: "/app?filtro=checked", icon: <Check className="h-4 w-4" strokeWidth={3} /> },
  { label: "Unchecked", to: "/app?filtro=unchecked", icon: <UncheckedIcon className="h-4 w-4" /> },
  { label: "Cocinadas", to: "/app?filtro=cocinadas", icon: <CheckCircle2 className="h-4 w-4" /> },
  {
    label: "Thermomix",
    to: "/app?filtro=thermomix",
    icon: <img src="/thermomix-logo.transparent.png" alt="" aria-hidden="true" className="h-5 w-5 object-contain" />,
  },
  {
    label: "Air Fryer",
    to: "/app?filtro=air-fryer",
    icon: <img src="/air-fryer.transparent.png" alt="" aria-hidden="true" className="h-4 w-4 object-contain" />,
  },
  { label: "Sin Gluten", to: "/app?filtro=sin-gluten", icon: <WheatOff className="h-4 w-4" /> },
  { label: "Sin Azucar", to: "/app?filtro=sin-azucar", icon: <CandyOff className="h-4 w-4" /> },
  { label: "Keto", to: "/app?filtro=keto", icon: <AvocadoIcon className="h-[18px] w-[18px]" /> },
  {
    label: "Low Carb",
    to: "/app?filtro=low-carb",
    icon: <img src="/logo-saludable.png" alt="" aria-hidden="true" className="h-4 w-4 object-contain" />,
  },
  { label: "Proteicas", to: "/app?filtro=proteicas", icon: <Beef className="h-4 w-4" /> },
  { label: "Vegetarianas", to: "/app?filtro=vegetarianas", icon: <Leaf className="h-4 w-4" /> },
  { label: "Recetas Dulces", to: "/app?filtro=dulces", icon: <CakeSlice className="h-4 w-4" /> },
  { label: "Recetas Saladas", to: "/app?filtro=saladas", icon: <Utensils className="h-4 w-4" /> },
];

const actionItems = [
  { label: "Nueva Receta", action: "nueva", icon: <PlusCircle className="h-4 w-4" /> },
  { label: "Importar receta de URL", action: "importar", icon: <Download className="h-4 w-4" /> },
  { label: "Importar receta de texto", action: "importar-texto", icon: <ClipboardPaste className="h-4 w-4" /> },
  { label: "Buscador inteligente", action: "busqueda-inteligente", icon: <Sparkles className="h-4 w-4" /> },
];

export const MainNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const showingDuplicateRecipes = new URLSearchParams(location.search).get('view') === 'duplicadas';
  const panelPath = (panel: 'search' | 'filter' | 'edit' | 'print' | 'delete') => {
    const params = new URLSearchParams(location.search);
    params.delete('accion');
    params.delete('_');
    params.set('panel', panel);
    return `${location.pathname}?${params.toString()}`;
  };
  const optionItems = [
    showingDuplicateRecipes
      ? { label: "Mostrar todas las recetas", to: "/app", icon: <ChefHat className="h-4 w-4" /> }
      : { label: "Mostrar recetas repetidas", to: "/app?view=duplicadas", icon: <Copy className="h-4 w-4" /> },
    { label: "Buscar", to: panelPath('search'), icon: <Search className="h-4 w-4" /> },
    { label: "Filtrar", to: panelPath('filter'), icon: <Filter className="h-4 w-4" /> },
    { label: "Editar", to: panelPath('edit'), icon: <Edit className="h-4 w-4" /> },
    { label: "Imprimir", to: panelPath('print'), icon: <Printer className="h-4 w-4" /> },
    { label: "Eliminar", to: panelPath('delete'), icon: <Trash2 className="h-4 w-4" /> },
  ];

  const openAction = (action: string) => {
    navigate(`/app?accion=${action}&_=${Date.now()}`);
  };

  return (
    <nav
      aria-label="Menu principal"
      className="flex flex-wrap items-center justify-center gap-1 lg:gap-2 xl:flex-nowrap sm:justify-end"
    >
      <div className="flex h-10 items-center justify-center rounded-md text-[#6f6965] transition-colors hover:bg-pink-50 hover:text-primary">
        <ThemeSwitcher />
      </div>

      <Link
        to="/buscar"
        className="inline-flex h-10 items-center justify-center gap-1 rounded-md px-2 text-[11px] font-semibold tracking-wide text-[#6f6965] transition-colors hover:bg-pink-50 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 lg:gap-2 lg:px-3 lg:text-xs xl:px-4 xl:text-sm"
      >
        <Search className="h-4 w-4" />
        BUSCAR
      </Link>

      {menuItems.map((item) => (
        <Link
          key={item.label}
          to={item.to}
          className="inline-flex h-10 items-center justify-center gap-1 rounded-md px-2 text-[11px] font-semibold tracking-wide text-[#6f6965] transition-colors hover:bg-pink-50 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 lg:gap-2 lg:px-3 lg:text-xs xl:px-4 xl:text-sm"
        >
          {item.label}
        </Link>
      ))}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center gap-1 rounded-md px-2 text-[11px] font-semibold tracking-wide text-[#6f6965] transition-colors hover:bg-pink-50 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 lg:px-3 lg:text-xs xl:px-4 xl:text-sm"
          >
            RECETAS
            <ChevronDown className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {recipeTypeItems.map((item) => (
            <DropdownMenuItem key={item.label} asChild>
              <Link to={item.to} className="flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center gap-1 rounded-md px-2 text-[11px] font-semibold tracking-wide text-[#6f6965] transition-colors hover:bg-pink-50 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 lg:px-3 lg:text-xs xl:px-4 xl:text-sm"
          >
            ACCIONES
            <ChevronDown className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {optionItems.map((item) => (
            <DropdownMenuItem key={item.label} asChild>
              <Link to={item.to} className="flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center gap-1 rounded-md px-2 text-[11px] font-semibold tracking-wide text-[#6f6965] transition-colors hover:bg-pink-50 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 lg:px-3 lg:text-xs xl:text-sm"
            aria-label="Agregar"
            title="Agregar"
          >
            <PlusCircle className="h-5 w-5" />
            <ChevronDown className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {actionItems.map((item) => (
            <DropdownMenuItem key={item.action} onClick={() => openAction(item.action)}>
              <span className="mr-2">{item.icon}</span>
              {item.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

    </nav>
  );
};
