import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme, Theme } from '@/contexts/ThemeContext';
import { Palette } from 'lucide-react';

const themes: { value: Theme; label: string }[] = [
  { value: 'carrot', label: 'Carrot' },
  { value: 'violetas', label: 'Violetas' },
  { value: 'tierra', label: 'Tierra' },
  { value: 'frutilla', label: 'Frutilla' },
  { value: 'aguamarina', label: 'Aguamarina' },
  { value: 'pasteles', label: 'Pasteles' }
];

export const ThemeSwitcher = () => {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <Palette className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {themes.map((themeOption) => (
          <DropdownMenuItem
            key={themeOption.value}
            onClick={() => setTheme(themeOption.value)}
            className={theme === themeOption.value ? 'bg-accent' : ''}
          >
            <Palette className="mr-2 h-4 w-4" />
            {themeOption.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};