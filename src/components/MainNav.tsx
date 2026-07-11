import { Link, useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Beef,
  ChevronDown,
  Download,
  Flame,
  Heart,
  Leaf,
  PlusCircle,
  Search,
  Sparkles,
  WheatOff,
} from "lucide-react";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const menuItems = [
  { label: "COLECCIONES", to: "/app?view=colecciones" },
  { label: "CATEGORIAS", to: "/app?view=categorias" },
  { label: "FUENTE", to: "/app?view=fuentes" },
  { label: "TIPO DE COMIDA", to: "/app?view=tipo-comida" },
];

const recipeTypeItems = [
  { label: "Todas las recetas", to: "/app", icon: <Search className="h-4 w-4" /> },
  { label: "Favoritas", to: "/app?filtro=favoritas", icon: <Heart className="h-4 w-4" /> },
  { label: "Cocinadas", to: "/app?filtro=cocinadas", icon: <CheckCircle2 className="h-4 w-4" /> },
  {
    label: "Thermomix",
    to: "/app?filtro=thermomix",
    icon: <img src="/thermomix-logo.transparent.png" alt="" aria-hidden="true" className="h-4 w-4 object-contain" />,
  },
  {
    label: "Air Fryer",
    to: "/app?filtro=air-fryer",
    icon: <img src="/air-fryer.transparent.png" alt="" aria-hidden="true" className="h-4 w-4 object-contain" />,
  },
  { label: "Sin gluten", to: "/app?filtro=sin-gluten", icon: <WheatOff className="h-4 w-4" /> },
  { label: "Keto", to: "/app?filtro=keto", icon: <Flame className="h-4 w-4" /> },
  {
    label: "Low Carb",
    to: "/app?filtro=low-carb",
    icon: <img src="/logo-saludable.png" alt="" aria-hidden="true" className="h-4 w-4 object-contain" />,
  },
  { label: "Proteicas", to: "/app?filtro=proteicas", icon: <Beef className="h-4 w-4" /> },
  { label: "Vegetarianas", to: "/app?filtro=vegetarianas", icon: <Leaf className="h-4 w-4" /> },
];

const actionItems = [
  { label: "Nueva Receta", action: "nueva", icon: <PlusCircle className="h-4 w-4" /> },
  { label: "Importar receta", action: "importar", icon: <Download className="h-4 w-4" /> },
  { label: "Buscador inteligente", action: "busqueda-inteligente", icon: <Sparkles className="h-4 w-4" /> },
];

export const MainNav = () => {
  const navigate = useNavigate();

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
                {item.icon}
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
