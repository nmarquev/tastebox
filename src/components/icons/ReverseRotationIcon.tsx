interface ReverseRotationIconProps {
  className?: string;
}

// Ícono de "giro inverso" (Thermomix): una elipse horizontal abierta a la derecha
// con una flecha que apunta hacia la derecha (sentido de giro). Símbolo de Cookidoo.
export const ReverseRotationIcon = ({ className }: ReverseRotationIconProps) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    role="img"
    aria-label="giro inverso"
  >
    {/* Arco elíptico (abierto a la derecha), recorre arriba-izquierda-abajo */}
    <path
      d="M19 9 A8.5 5 0 1 0 15 14.4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    {/* Punta de flecha (más grande) apuntando a la derecha, abajo a la derecha */}
    <path d="M14 11.4 L20.2 14.2 L13.9 17.4 Z" fill="currentColor" />
  </svg>
);
