import type { Theme } from "@/contexts/ThemeContext";

import logoAguamarina from "../../imagenes/logos/logo tastebox aguamarina 400x124.png";
import logoCarrot from "../../imagenes/logos/logo tastebox naranja 400x124.png";
import logoFrutilla from "../../imagenes/logos/logo tastebox frutilla 400x124.png";
import logoGrises from "../../imagenes/logos/logo tastenbox gris 400x124.png";
import logoPasteles from "../../imagenes/logos/logo tastebox pastel 400x124.png";
import logoSalmon from "../../imagenes/logos/logo tastebox salmon 400x124.png";
import logoTierra from "../../imagenes/logos/logo tastebox tierra 400x124.png";
import logoVioletas from "../../imagenes/logos/logo tastebox violeta 400x124.png";

export const THEME_LOGOS: Record<Theme, string> = {
  carrot: logoCarrot,
  violetas: logoVioletas,
  tierra: logoTierra,
  frutilla: logoFrutilla,
  aguamarina: logoAguamarina,
  pasteles: logoPasteles,
  salmon: logoSalmon,
  grises: logoGrises,
};
