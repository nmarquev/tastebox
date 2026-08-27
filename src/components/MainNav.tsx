import { useRef, useState } from "react";
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
  ListFilter,
  Menu,
  PlusCircle,
  Printer,
  Search,
  Sparkles,
  Trash2,
  Utensils,
  WheatOff,
  X,
} from "lucide-react";
import { AvocadoIcon } from "@/components/icons/AvocadoIcon";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { FontThemeSwitcher } from "@/components/FontThemeSwitcher";
import { UncheckedIcon } from "@/components/icons/UncheckedIcon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { EMPTY_RECIPE_FIELD_OPTIONS, EmptyRecipeField, isEmptyRecipeField } from "@/constants/emptyRecipeFields";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const menuItems = [
  { label: "COLECCIONES", to: "/app?view=colecciones" },
  { label: "FUENTES", to: "/app?view=fuentes" },
  { label: "TIPOS DE COMIDA", to: "/app?view=tipo-comida" },
];

const recipeTypeItems = [
  { label: "Todas las Recetas", filter: null, icon: <ChefHat className="h-4 w-4" /> },
  { label: "Favoritas", filter: 'favoritas', icon: <Heart className="h-4 w-4" /> },
  { label: "Checked", filter: 'checked', icon: <Check className="h-4 w-4" strokeWidth={3} /> },
  { label: "Unchecked", filter: 'unchecked', icon: <UncheckedIcon className="h-4 w-4" /> },
  { label: "Cocinadas", filter: 'cocinadas', icon: <CheckCircle2 className="h-4 w-4" /> },
  {
    label: "Thermomix",
    filter: 'thermomix',
    icon: <img src="/thermomix-logo.transparent.png" alt="" aria-hidden="true" className="h-5 w-5 object-contain" />,
  },
  {
    label: "Air Fryer",
    filter: 'air-fryer',
    icon: <img src="/air-fryer.transparent.png" alt="" aria-hidden="true" className="h-4 w-4 object-contain" />,
  },
  { label: "Sin Gluten", filter: 'sin-gluten', icon: <WheatOff className="h-4 w-4" /> },
  { label: "Sin Azucar", filter: 'sin-azucar', icon: <CandyOff className="h-4 w-4" /> },
  { label: "Keto", filter: 'keto', icon: <AvocadoIcon className="h-[18px] w-[18px]" /> },
  {
    label: "Low Carb",
    filter: 'low-carb',
    icon: <img src="/logo-saludable.png" alt="" aria-hidden="true" className="h-4 w-4 object-contain" />,
  },
  { label: "Proteicas", filter: 'proteicas', icon: <Beef className="h-4 w-4" /> },
  { label: "Vegetarianas", filter: 'vegetarianas', icon: <Leaf className="h-4 w-4" /> },
  { label: "Recetas Dulces", filter: 'dulces', icon: <CakeSlice className="h-4 w-4" /> },
  { label: "Recetas Saladas", filter: 'saladas', icon: <Utensils className="h-4 w-4" /> },
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
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [emptyFieldsDialogOpen, setEmptyFieldsDialogOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [recipeSearch, setRecipeSearch] = useState('');
  const [recipeSearchMode, setRecipeSearchMode] = useState<'all' | 'any' | 'exact'>('all');
  const [selectedEmptyFields, setSelectedEmptyFields] = useState<EmptyRecipeField[]>([]);
  const [emptyFieldsMatchMode, setEmptyFieldsMatchMode] = useState<'any' | 'all'>('any');
  const recipeSearchInputRef = useRef<HTMLInputElement>(null);
  const showingDuplicateRecipes = new URLSearchParams(location.search).get('view') === 'duplicadas';
  const panelPath = (panel: 'filter' | 'edit' | 'print' | 'delete') => {
    const params = new URLSearchParams(location.search);
    params.delete('accion');
    params.delete('_');
    params.set('panel', panel);
    return `${location.pathname}?${params.toString()}`;
  };
  const duplicateOption = showingDuplicateRecipes
    ? { label: "Mostrar todas las recetas", to: "/app", icon: <ChefHat className="h-4 w-4" /> }
    : { label: "Mostrar recetas duplicadas", to: "/app?view=duplicadas", icon: <Copy className="h-4 w-4" /> };
  const optionItems = [
    { label: "Filtrar", to: panelPath('filter'), icon: <Filter className="h-4 w-4" /> },
    { label: "Editar", to: panelPath('edit'), icon: <Edit className="h-4 w-4" /> },
    { label: "Imprimir", to: panelPath('print'), icon: <Printer className="h-4 w-4" /> },
    { label: "Eliminar", to: panelPath('delete'), icon: <Trash2 className="h-4 w-4" /> },
  ];

  const openAction = (action: string) => {
    navigate(`/app?accion=${action}&_=${Date.now()}`);
  };

  const selectRecipeType = (filter: string | null) => {
    if (!filter) {
      navigate('/app');
      return;
    }

    const isRecipesPage = location.pathname === '/app' || location.pathname === '/buscar';
    if (isRecipesPage) {
      window.dispatchEvent(new CustomEvent('tastebox:recipe-filter', { detail: { filter } }));
      const params = new URLSearchParams(location.search);
      params.set('filtro', filter);
      params.set('conservarFiltros', '1');
      navigate({ pathname: location.pathname, search: `?${params.toString()}` });
      return;
    }

    navigate(`/app?filtro=${encodeURIComponent(filter)}&conservarFiltros=1`);
  };

  const submitRecipeSearch = () => {
    const term = recipeSearch.trim();
    if (!term) return;
    const params = new URLSearchParams();
    if (recipeSearchMode === 'exact') {
      params.append('buscar', term);
      params.set('coincidencia', 'exacta');
    } else {
      term.split(/\s+/).filter(Boolean).forEach(keyword => params.append('buscar', keyword));
      params.set('coincidencia', recipeSearchMode === 'any' ? 'alguna' : 'todas');
    }
    setSearchDialogOpen(false);
    navigate(`/app?${params.toString()}`);
  };

  const openRecipeSearch = () => {
    // Radix devuelve el foco al cerrar el desplegable. Abrir el dialogo en el
    // siguiente ciclo evita que ese cierre lo descarte inmediatamente.
    setRecipeSearch('');
    setRecipeSearchMode('all');
    window.setTimeout(() => setSearchDialogOpen(true), 0);
  };

  const openEmptyFieldsSearch = () => {
    const params = new URLSearchParams(location.search);
    const currentFields = params
      .getAll('vacio')
      .filter(isEmptyRecipeField);
    setSelectedEmptyFields(currentFields);
    setEmptyFieldsMatchMode(params.get('vacioCoincidencia') === 'todas' ? 'all' : 'any');
    window.setTimeout(() => setEmptyFieldsDialogOpen(true), 0);
  };

  const toggleEmptyField = (field: EmptyRecipeField, checked: boolean) => {
    setSelectedEmptyFields(previous => checked
      ? previous.includes(field) ? previous : [...previous, field]
      : previous.filter(value => value !== field));
  };

  const submitEmptyFieldsSearch = () => {
    if (selectedEmptyFields.length === 0) return;
    const params = new URLSearchParams();
    selectedEmptyFields.forEach(field => params.append('vacio', field));
    params.set('vacioCoincidencia', emptyFieldsMatchMode === 'all' ? 'todas' : 'alguna');
    setEmptyFieldsDialogOpen(false);
    navigate(`/app?${params.toString()}`);
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const mobileMenuItemClass =
    "flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-semibold tracking-wide text-[#6f6965] transition-colors hover:bg-pink-50 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2";
  const mobileSubmenuItemClass =
    "flex min-h-10 w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium text-[#6f6965] transition-colors hover:bg-pink-50 hover:text-primary";

  return (
    <>
      <nav
        aria-label="Menú principal"
        className="hidden items-center justify-end gap-1 lg:gap-2 xl:flex xl:flex-nowrap"
      >
      <div className="flex h-10 items-center justify-center rounded-md text-[#6f6965] transition-colors hover:bg-pink-50 hover:text-primary">
        <ThemeSwitcher />
      </div>
      <div className="flex h-10 items-center justify-center rounded-md text-[#6f6965] transition-colors hover:bg-pink-50 hover:text-primary">
        <FontThemeSwitcher />
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
            <DropdownMenuItem
              key={item.label}
              onSelect={() => selectRecipeType(item.filter)}
              className="flex items-center gap-2"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                {item.icon}
              </span>
              {item.label}
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
          <DropdownMenuItem onSelect={openRecipeSearch}>
            <Search className="mr-2 h-4 w-4" />
            Buscar
          </DropdownMenuItem>
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
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                <PlusCircle className="h-4 w-4" />
              </span>
              Nueva receta
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {actionItems.map((item) => (
                <DropdownMenuItem key={item.action} onClick={() => openAction(item.action)}>
                  <span className="mr-2 flex h-5 w-5 shrink-0 items-center justify-center">{item.icon}</span>
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem onSelect={openEmptyFieldsSearch}>
            <ListFilter className="mr-2 h-4 w-4" />
            Buscar campos vacíos
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to={duplicateOption.to} className="flex items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                {duplicateOption.icon}
              </span>
              {duplicateOption.label}
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={searchDialogOpen} onOpenChange={setSearchDialogOpen}>
        <DialogContent
          className="sm:max-w-md"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            window.requestAnimationFrame(() => recipeSearchInputRef.current?.focus());
          }}
        >
          <DialogHeader>
            <DialogTitle>Buscar por una o más palabras clave</DialogTitle>
          </DialogHeader>
          <div className="relative min-w-0">
              <Input
                ref={recipeSearchInputRef}
                autoFocus
                value={recipeSearch}
                onChange={(event) => setRecipeSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    submitRecipeSearch();
                  }
                }}
                placeholder="Escribir nombre o ingredientes..."
                aria-label="Nombre de la receta o ingredientes"
                className="pr-10"
              />
              {recipeSearch && (
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setRecipeSearch('')}
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Borrar texto de búsqueda"
                  title="Borrar texto"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
          </div>
          <RadioGroup
            value={recipeSearchMode}
            onValueChange={(value) => setRecipeSearchMode(value as 'all' | 'any' | 'exact')}
            className="gap-3"
            aria-label="Coincidencia de palabras clave"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="all" id="search-all-words" />
              <label htmlFor="search-all-words" className="cursor-pointer text-sm text-foreground">
                Incluir todas las palabras
              </label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="any" id="search-any-word" />
              <label htmlFor="search-any-word" className="cursor-pointer text-sm text-foreground">
                Incluir alguna de las palabras
              </label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="exact" id="search-exact-phrase" />
              <label htmlFor="search-exact-phrase" className="cursor-pointer text-sm text-foreground">
                Palabra completa
              </label>
            </div>
          </RadioGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSearchDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={submitRecipeSearch} disabled={!recipeSearch.trim()}>
              <Search className="mr-2 h-4 w-4" />
              Buscar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={emptyFieldsDialogOpen} onOpenChange={setEmptyFieldsDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Buscar recetas con campos vacíos</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Seleccioná uno o más campos vacíos que quieras encontrar.
          </p>
          <RadioGroup
            value={emptyFieldsMatchMode}
            onValueChange={value => setEmptyFieldsMatchMode(value as 'any' | 'all')}
            className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-2"
          >
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <RadioGroupItem value="any" id="empty-fields-any" />
              <span>Cumple alguna condición</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <RadioGroupItem value="all" id="empty-fields-all" />
              <span>Cumple todas las condiciones</span>
            </label>
          </RadioGroup>
          <div className="grid max-h-[60vh] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {EMPTY_RECIPE_FIELD_OPTIONS.map(option => {
              const checked = selectedEmptyFields.includes(option.value);
              const id = `empty-field-${option.value}`;
              return (
                <label
                  key={option.value}
                  htmlFor={id}
                  className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors ${checked ? 'border-primary bg-primary/10 text-foreground' : 'border-border hover:bg-muted/60'}`}
                >
                  <Checkbox
                    id={id}
                    checked={checked}
                    onCheckedChange={value => toggleEmptyField(option.value, value === true)}
                  />
                  <span>{option.label}</span>
                </label>
              );
            })}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEmptyFieldsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={submitEmptyFieldsSearch} disabled={selectedEmptyFields.length === 0}>
              <Search className="mr-2 h-4 w-4" />
              Mostrar recetas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-[#6f6965] transition-colors hover:bg-pink-50 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 xl:hidden"
            aria-label="Abrir menú"
            title="Menú"
          >
            <Menu className="h-7 w-7" />
          </button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[min(88vw,360px)] overflow-y-auto p-0">
          <SheetHeader className="border-b border-border/60 px-5 py-5 text-left">
            <SheetTitle className="text-xl text-[#6f6965]">Menú</SheetTitle>
          </SheetHeader>

          <nav aria-label="Menú principal móvil" className="space-y-1 p-4">
            <div className="flex min-h-11 items-center gap-3 rounded-md px-3">
              <div className="-mx-1.5">
                <ThemeSwitcher />
              </div>
              <span className="text-sm font-semibold tracking-wide text-[#6f6965]">TEMA</span>
            </div>

            <div className="flex min-h-11 items-center gap-3 rounded-md px-3">
              <div className="-mx-1.5">
                <FontThemeSwitcher />
              </div>
              <span className="text-sm font-semibold tracking-wide text-[#6f6965]">FUENTE</span>
            </div>

            <button
              type="button"
              onClick={() => {
                closeMobileMenu();
                openRecipeSearch();
              }}
              className={mobileMenuItemClass}
            >
              <Search className="h-5 w-5" />
              BUSCAR
            </button>

            <Link to="/app" onClick={closeMobileMenu} className={mobileMenuItemClass}>
              <ChefHat className="h-5 w-5" />
              TODAS LAS RECETAS
            </Link>

            {menuItems.map((item) => (
              <Link key={item.label} to={item.to} onClick={closeMobileMenu} className={mobileMenuItemClass}>
                {item.label}
              </Link>
            ))}

            <details className="group border-t border-border/60 pt-1">
              <summary className={`${mobileMenuItemClass} cursor-pointer list-none justify-between`}>
                <span>RECETAS</span>
                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-0.5 pb-2 pl-2">
                {recipeTypeItems.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      selectRecipeType(item.filter);
                      closeMobileMenu();
                    }}
                    className={mobileSubmenuItemClass}
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center">{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            </details>

            <details className="group border-t border-border/60 pt-1">
              <summary className={`${mobileMenuItemClass} cursor-pointer list-none justify-between`}>
                <span>ACCIONES</span>
                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-0.5 pb-2 pl-2">
                <button
                  type="button"
                  onClick={() => {
                    closeMobileMenu();
                    openRecipeSearch();
                  }}
                  className={mobileSubmenuItemClass}
                >
                  <Search className="h-4 w-4" />
                  Buscar
                </button>
                {optionItems.map((item) => (
                  <Link key={item.label} to={item.to} onClick={closeMobileMenu} className={mobileSubmenuItemClass}>
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center">{item.icon}</span>
                    {item.label}
                  </Link>
                ))}
                <details className="group/new">
                  <summary className={`${mobileSubmenuItemClass} cursor-pointer list-none justify-between`}>
                    <span className="flex items-center gap-3">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                        <PlusCircle className="h-4 w-4" />
                      </span>
                      Nueva receta
                    </span>
                    <ChevronDown className="h-4 w-4 transition-transform group-open/new:rotate-180" />
                  </summary>
                  <div className="space-y-0.5 pl-5">
                    {actionItems.map((item) => (
                      <button
                        key={item.action}
                        type="button"
                        onClick={() => {
                          openAction(item.action);
                          closeMobileMenu();
                        }}
                        className={mobileSubmenuItemClass}
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center">{item.icon}</span>
                        {item.label}
                      </button>
                    ))}
                  </div>
                </details>
                <button
                  type="button"
                  onClick={() => {
                    closeMobileMenu();
                    openEmptyFieldsSearch();
                  }}
                  className={mobileSubmenuItemClass}
                >
                  <ListFilter className="h-4 w-4" />
                  Buscar campos vacíos
                </button>
                <Link to={duplicateOption.to} onClick={closeMobileMenu} className={mobileSubmenuItemClass}>
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center">{duplicateOption.icon}</span>
                  {duplicateOption.label}
                </Link>
              </div>
            </details>

            <details className="group border-t border-border/60 pt-1">
              <summary className={`${mobileMenuItemClass} cursor-pointer list-none justify-between`}>
                <span>AGREGAR</span>
                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-0.5 pb-2 pl-2">
                {actionItems.map((item) => (
                  <button
                    key={item.action}
                    type="button"
                    onClick={() => {
                      openAction(item.action);
                      closeMobileMenu();
                    }}
                    className={mobileSubmenuItemClass}
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center">{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            </details>
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
};
