interface SpoonSpeedIconProps {
  className?: string;
}

// Ícono de "velocidad cuchara" (Thermomix): una cuchara (cuenco + mango diagonal)
// atravesando un anillo elíptico. Reproduce el símbolo oficial de Cookidoo.
export const SpoonSpeedIcon = ({ className }: SpoonSpeedIconProps) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    role="img"
    aria-label="velocidad cuchara"
  >
    {/* Anillo elíptico */}
    <ellipse
      cx="10.5"
      cy="15.5"
      rx="8"
      ry="2.9"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    />
    {/* Mango de la cuchara (barra diagonal gruesa hacia arriba-derecha) */}
    <line
      x1="10"
      y1="14.5"
      x2="18.8"
      y2="4.2"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
    />
    {/* Cuenco de la cuchara (relleno) */}
    <ellipse
      cx="8.7"
      cy="16"
      rx="2.7"
      ry="3.2"
      fill="currentColor"
      transform="rotate(28 8.7 16)"
    />
  </svg>
);
