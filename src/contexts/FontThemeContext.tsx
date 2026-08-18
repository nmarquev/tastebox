import React, { createContext, useContext, useEffect, useState } from 'react';

export type FontTheme = 'original' | 'moderna' | 'elegante' | 'amable' | 'clasica';

interface FontThemeContextType {
  fontTheme: FontTheme;
  setFontTheme: (fontTheme: FontTheme) => void;
}

const FONT_THEMES = new Set<FontTheme>(['original', 'moderna', 'elegante', 'amable', 'clasica']);
const FontThemeContext = createContext<FontThemeContextType | undefined>(undefined);

const getSavedFontTheme = (): FontTheme => {
  const saved = localStorage.getItem('font-theme') as FontTheme | null;
  return saved && FONT_THEMES.has(saved) ? saved : 'original';
};

// Context and hook live together, matching the existing ThemeContext API.
// eslint-disable-next-line react-refresh/only-export-components
export const useFontTheme = () => {
  const context = useContext(FontThemeContext);
  if (context === undefined) {
    throw new Error('useFontTheme must be used within a FontThemeProvider');
  }
  return context;
};

interface FontThemeProviderProps {
  children: React.ReactNode;
}

export const FontThemeProvider: React.FC<FontThemeProviderProps> = ({ children }) => {
  const [fontTheme, setFontTheme] = useState<FontTheme>(getSavedFontTheme);

  useEffect(() => {
    localStorage.setItem('font-theme', fontTheme);
    document.documentElement.dataset.fontTheme = fontTheme;
  }, [fontTheme]);

  return (
    <FontThemeContext.Provider value={{ fontTheme, setFontTheme }}>
      {children}
    </FontThemeContext.Provider>
  );
};
