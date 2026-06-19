import { Fragment, ReactNode } from "react";
import { withThermomixIcons } from "@/components/icons/thermomixIcons";

// Reemplaza "giro inverso" y "cuchara" por sus íconos dentro de un texto.
const withSpoon = (text: string, keyPrefix: string): ReactNode => withThermomixIcons(text, keyPrefix);

const bold = (content: ReactNode, key: string) => (
  <strong key={key} className="font-semibold text-foreground">{content}</strong>
);

// Token de una configuración Thermomix (tiempo, temperatura, velocidad, función, etc.)
const TOKEN =
  "(?:\\d[\\d.,]*\\s*(?:seg|min)\\b|\\d[\\d.,]*\\s*°C?|vel\\s*cuchara|vel\\s*\\d+|giro inverso|Espesar|Varoma|Turbo|Mariposa)";
// Una "config" es uno o más tokens separados por "/" (ej. "5 min/120°C/giro inverso/vel cuchara").
const SETTINGS_RUN = new RegExp(`${TOKEN}(?:\\s*/\\s*${TOKEN})*`, "gi");

// Detecta las configuraciones Thermomix en el texto y las pone en negrita, dejándolas
// DONDE están (inline), igual que en la página original. La palabra "cuchara" → ícono.
function autoBold(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  SETTINGS_RUN.lastIndex = 0;
  while ((m = SETTINGS_RUN.exec(text))) {
    const seg = m[0];
    // Solo es config real si tiene "/" o una velocidad/giro/cuchara (evita "30 minutos", etc.)
    if (!/[/]|vel|cuchara|giro/i.test(seg)) continue;
    if (m.index > last) out.push(<Fragment key={`t${i}`}>{withSpoon(text.slice(last, m.index), `t${i}`)}</Fragment>);
    out.push(bold(withSpoon(seg, `b${i}`), `b${i}`));
    last = m.index + seg.length;
    i++;
  }
  if (last < text.length) out.push(<Fragment key={`t${i}`}>{withSpoon(text.slice(last), `t${i}`)}</Fragment>);
  return out;
}

// Indica si la descripción YA trae las configuraciones Thermomix incrustadas (inline).
// Sirve para no duplicarlas como badges debajo en recetas nuevas.
export function hasInlineThermomix(text?: string): boolean {
  if (!text) return false;
  if (text.includes("**")) return true;
  SETTINGS_RUN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SETTINGS_RUN.exec(text))) {
    if (/[/]|vel|cuchara|giro/i.test(m[0])) return true;
  }
  return false;
}

// Renderiza la descripción de un paso con las configuraciones Thermomix en negrita e
// inline (como en Cookidoo) y el ícono de velocidad cuchara donde corresponde.
export const StepDescription = ({ text }: { text: string }) => {
  if (!text) return null;

  // Si vienen marcadas con **...** (por si el origen las trae), respetarlas.
  if (text.includes("**")) {
    const segments = text.split(/(\*\*[^*]+\*\*)/g);
    return (
      <>
        {segments.map((seg, i) => {
          const b = seg.match(/^\*\*([^*]+)\*\*$/);
          return b ? bold(withSpoon(b[1], `b${i}`), `b${i}`) : <Fragment key={`t${i}`}>{withSpoon(seg, `t${i}`)}</Fragment>;
        })}
      </>
    );
  }

  return <>{autoBold(text)}</>;
};
