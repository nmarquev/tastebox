import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FontTheme, useFontTheme } from '@/contexts/FontThemeContext';
import { Check } from 'lucide-react';

const fontThemes: { value: FontTheme; label: string; previewClass: string }[] = [
  { value: 'tastebox', label: 'Original', previewClass: 'font-preview-tastebox' },
  { value: 'moderna', label: 'Moderna', previewClass: 'font-preview-moderna' },
  { value: 'elegante', label: 'Elegante', previewClass: 'font-preview-elegante' },
  { value: 'amable', label: 'Amable', previewClass: 'font-preview-amable' },
];

export const FontThemeSwitcher = () => {
  const { fontTheme, setFontTheme } = useFontTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          aria-label="Elegir tema de fuentes"
          title="Elegir tema de fuentes"
        >
          <span className="font-theme-icon" aria-hidden="true">Aa</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        {fontThemes.map((option) => {
          const selected = fontTheme === option.value;

          return (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => setFontTheme(option.value)}
              className="gap-2"
            >
              <span className={`font-theme-preview ${option.previewClass}`} aria-hidden="true">Aa</span>
              <span className="flex-1">{option.label}</span>
              {selected && <Check className="h-4 w-4 text-primary" aria-hidden="true" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
