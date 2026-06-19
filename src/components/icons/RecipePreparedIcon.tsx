import { CSSProperties } from "react";

interface RecipePreparedIconProps {
  className?: string;
  style?: CSSProperties;
}

// Ícono de "receta preparada": una olla con tapa y un tilde dentro.
// Usa currentColor, así que toma el color que se le pase (gris / verde según estado).
export const RecipePreparedIcon = ({ className, style }: RecipePreparedIconProps) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    style={style}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    strokeLinecap="round"
    strokeLinejoin="round"
    role="img"
    aria-label="Receta preparada"
  >
    {/* Tapa */}
    <path d="M3.5 9.5c2-2.2 5-3.3 8.5-3.3s6.5 1.1 8.5 3.3" />
    {/* Agarre de la tapa */}
    <path d="M10 5.7h4" />
    {/* Asas laterales */}
    <path d="M4.8 12.3H3" />
    <path d="M19.2 12.3H21" />
    {/* Cuerpo de la olla */}
    <path d="M4.8 9.5h14.4v7.7a2 2 0 0 1-2 2H6.8a2 2 0 0 1-2-2z" />
    {/* Tilde */}
    <path d="M9.2 14.4l2.1 2.1 3.5-3.9" strokeWidth="1.6" />
  </svg>
);
