import {
  Apple,
  Bean,
  Beef,
  Candy,
  Carrot,
  Citrus,
  CookingPot,
  Drumstick,
  Droplets,
  Egg,
  Fish,
  Leaf,
  Milk,
  Wheat,
  type LucideIcon,
} from "lucide-react";

type IngredientIconProps = {
  name: string;
  compact?: boolean;
};

type IngredientVisual = {
  icon: LucideIcon;
  className: string;
  backgroundClassName: string;
};

const normalizeIngredientName = (name: string) => name
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("es");

const includesAny = (name: string, terms: string[]) => terms.some((term) => name.includes(term));

const getIngredientVisual = (ingredientName: string): IngredientVisual => {
  const name = normalizeIngredientName(ingredientName);

  if (includesAny(name, ["limon", "lima", "naranja", "mandarina", "pomelo", "citrus"])) {
    return { icon: Citrus, className: "text-yellow-600", backgroundClassName: "bg-yellow-100" };
  }
  if (includesAny(name, ["manzana", "pera", "frutilla", "fresa", "banana", "platano", "uva", "durazno", "melocoton", "fruta"])) {
    return { icon: Apple, className: "text-red-500", backgroundClassName: "bg-red-100" };
  }
  if (includesAny(name, ["pollo", "pavo", "gallina", "pato"])) {
    return { icon: Drumstick, className: "text-amber-700", backgroundClassName: "bg-amber-100" };
  }
  if (includesAny(name, ["carne", "ternera", "vacuno", "cerdo", "cordero", "bife", "jamon", "panceta", "salchicha"])) {
    return { icon: Beef, className: "text-red-700", backgroundClassName: "bg-red-100" };
  }
  if (includesAny(name, ["pescado", "salmon", "atun", "merluza", "bacalao", "sardina", "anchoa", "marisco", "camaron", "langostino"])) {
    return { icon: Fish, className: "text-sky-700", backgroundClassName: "bg-sky-100" };
  }
  if (includesAny(name, ["huevo", "yema", "clara"])) {
    return { icon: Egg, className: "text-yellow-700", backgroundClassName: "bg-yellow-100" };
  }
  if (includesAny(name, ["leche", "queso", "crema", "nata", "yogur", "manteca", "mantequilla", "ricota", "mozzarella"])) {
    return { icon: Milk, className: "text-blue-600", backgroundClassName: "bg-blue-100" };
  }
  if (includesAny(name, ["harina", "trigo", "avena", "arroz", "pasta", "fideo", "pan", "masa", "maizena", "almidon", "cereal"])) {
    return { icon: Wheat, className: "text-amber-700", backgroundClassName: "bg-amber-100" };
  }
  if (includesAny(name, ["lenteja", "garbanzo", "poroto", "frijol", "alubia", "arveja", "guisante", "soja"])) {
    return { icon: Bean, className: "text-orange-800", backgroundClassName: "bg-orange-100" };
  }
  if (includesAny(name, ["perejil", "albahaca", "cilantro", "romero", "tomillo", "oregano", "menta", "espinaca", "lechuga", "rucula", "hierba"])) {
    return { icon: Leaf, className: "text-green-700", backgroundClassName: "bg-green-100" };
  }
  if (includesAny(name, ["tomate", "zanahoria", "cebolla", "ajo", "papa", "patata", "batata", "calabaza", "zapallo", "pimiento", "morron", "brocoli", "coliflor", "berenjena", "zucchini", "calabacin", "palta", "aguacate", "verdura", "vegetal"])) {
    return { icon: Carrot, className: "text-orange-600", backgroundClassName: "bg-orange-100" };
  }
  if (includesAny(name, ["azucar", "chocolate", "cacao", "dulce", "miel", "caramelo"])) {
    return { icon: Candy, className: "text-pink-600", backgroundClassName: "bg-pink-100" };
  }
  if (includesAny(name, ["agua", "aceite", "caldo", "jugo", "zumo", "vinagre", "vino", "licor"])) {
    return { icon: Droplets, className: "text-cyan-700", backgroundClassName: "bg-cyan-100" };
  }

  return { icon: CookingPot, className: "text-primary", backgroundClassName: "bg-primary/10" };
};

export const IngredientIcon = ({ name, compact = false }: IngredientIconProps) => {
  const visual = getIngredientVisual(name);
  const Icon = visual.icon;

  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${visual.backgroundClassName} ${compact ? "h-5 w-5" : "h-6 w-6"}`}
    >
      <Icon className={`${visual.className} ${compact ? "h-3 w-3" : "h-3.5 w-3.5"}`} strokeWidth={2.25} />
    </span>
  );
};
