import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PaletteLight, PaletteDark, PaletteType } from '@/constants/theme';

type ThemeCtx = {
  isDark: boolean;
  toggleDark: () => void;
  P: PaletteType;
};

const ThemeContext = createContext<ThemeCtx>({ isDark: false, toggleDark: () => {}, P: PaletteLight });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem('darkMode').then((v) => { if (v === '1') setIsDark(true); });
  }, []);
  const toggleDark = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      AsyncStorage.setItem('darkMode', next ? '1' : '0');
      return next;
    });
  }, []);
  const P = isDark ? PaletteDark : PaletteLight;
  return <ThemeContext.Provider value={{ isDark, toggleDark, P }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}