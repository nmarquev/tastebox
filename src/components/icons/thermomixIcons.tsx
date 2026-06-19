import { Fragment, ReactNode } from "react";
import { SpoonSpeedIcon } from "@/components/icons/SpoonSpeedIcon";
import { ReverseRotationIcon } from "@/components/icons/ReverseRotationIcon";

const ICON_CLASS = "inline-block h-4 w-4 align-text-bottom mx-0.5";

// Reemplaza dentro de un texto las palabras "giro inverso" y "cuchara" por sus íconos
// Thermomix, dejando el resto del texto igual.
// "cuchara" se matchea SOLO como palabra completa (\b) para no romper unidades como
// "cucharada", "cucharadita", "cucharadas" o "cucharaditas".
export function withThermomixIcons(text: string, keyPrefix: string): ReactNode {
  if (!/giro inverso|\bcuchara\b/i.test(text)) return text;
  const parts = text.split(/(giro inverso|\bcuchara\b)/gi);
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (/^giro inverso$/i.test(part)) return <ReverseRotationIcon key={key} className={ICON_CLASS} />;
    if (/^cuchara$/i.test(part)) return <SpoonSpeedIcon key={key} className={ICON_CLASS} />;
    return <Fragment key={key}>{part}</Fragment>;
  });
}
