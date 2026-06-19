import { withThermomixIcons } from "@/components/icons/thermomixIcons";

interface ThermomixSettingProps {
  text: string;
  className?: string;
}

// Renderiza un dato Thermomix (ej. "⚡ giro inverso vel cuchara") reemplazando
// "giro inverso" y "cuchara" por sus íconos, manteniendo el resto del texto.
export const ThermomixSetting = ({ text, className }: ThermomixSettingProps) => {
  if (!/giro inverso|\bcuchara\b/i.test(text)) {
    return <span className={className}>{text}</span>;
  }
  return (
    <span className={`inline-flex items-center ${className ?? ""}`}>
      {withThermomixIcons(text, "tm")}
    </span>
  );
};
