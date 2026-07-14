import { ChefHat, Clock } from 'lucide-react';

interface PreparationTimeIconProps {
  className?: string;
}

export const PreparationTimeIcon = ({ className = 'h-4 w-4' }: PreparationTimeIconProps) => (
  <span
    aria-hidden="true"
    className={`relative inline-block shrink-0 ${className}`}
    style={{ width: 'auto', aspectRatio: '1.25' }}
  >
    <ChefHat className="absolute left-0 top-0 h-full w-auto" />
    <Clock className="absolute bottom-[-5%] right-0 h-[68%] w-auto fill-background stroke-[2.25]" />
  </span>
);
