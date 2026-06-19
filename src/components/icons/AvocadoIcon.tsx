interface AvocadoIconProps {
  className?: string;
}

// Ícono de palta/aguacate (cuerpo + carozo).
export const AvocadoIcon = ({ className }: AvocadoIconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    role="img"
    aria-label="Keto"
  >
    {/* Cuerpo de la palta */}
    <path d="M12 3c-1.7 0-2.9 1.5-2.9 3.1 0 1-0.6 1.7-1.3 2.6C6.3 10.5 5 12.5 5 15a7 7 0 0 0 14 0c0-2.5-1.3-4.5-2.8-6.3-0.7-0.9-1.3-1.6-1.3-2.6C14.9 4.5 13.7 3 12 3Z" />
    {/* Carozo */}
    <circle cx="12" cy="14.5" r="2.6" />
  </svg>
);
