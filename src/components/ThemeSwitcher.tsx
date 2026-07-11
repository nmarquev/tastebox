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
  { value: 'aguamarina', label: 'Aguamarina', color: '#A5D8E8' },
  { value: 'carrot', label: 'Carrot', color: '#FC7813' },
  { value: 'frutilla', label: 'Frutilla', color: '#F90344' },
  { value: 'grises', label: 'Grises', color: '#B4B7BC' },
  { value: 'pasteles', label: 'Pasteles', color: '#F7B9C3' },
  { value: 'salmon', label: 'Salmon', color: '#E26666' },
  { value: 'tierra', label: 'Tierra', color: '#E1C097' },
  { value: 'violetas', label: 'Violetas', color: '#A089BF' }
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
        {themes.map((themeOption) => {
          const selected = theme === themeOption.value;

          return (
            <DropdownMenuItem
              key={themeOption.value}
              onClick={() => setTheme(themeOption.value)}
              className={selected ? 'text-white focus:text-white' : ''}
              style={selected ? { backgroundColor: themeOption.color } : undefined}
            >
              <Palette className="mr-2 h-4 w-4" style={{ color: selected ? '#ffffff' : themeOption.color }} />
              {themeOption.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
