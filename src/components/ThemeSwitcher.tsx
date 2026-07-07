import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme, Theme } from '@/contexts/ThemeContext';
import { Palette } from 'lucide-react';

const themes: { value: Theme; label: string; color: string }[] = [
  { value: 'carrot', label: 'Carrot', color: '#f97316' },
  { value: 'violetas', label: 'Violetas', color: '#8b5cf6' },
  { value: 'tierra', label: 'Tierra', color: '#8b5e34' },
  { value: 'frutilla', label: 'Frutilla', color: '#ec4899' },
  { value: 'aguamarina', label: 'Aguamarina', color: '#22c7b8' },
  { value: 'pasteles', label: 'Pasteles', color: '#f4a6bd' }
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
            <Palette className="mr-2 h-4 w-4" style={{ color: themeOption.color }} />
            {themeOption.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
