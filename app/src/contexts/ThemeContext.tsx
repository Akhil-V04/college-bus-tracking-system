import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

import { darkColors, lightColors, ThemeColors } from '@/constants/theme';

type ThemeType = 'light' | 'dark';

interface ThemeContextValue {
  theme: ThemeType;
  isDark: boolean;
  colors: any;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeType>('dark');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('app-theme').then((savedTheme) => {
      if (savedTheme === 'light' || savedTheme === 'dark') {
        setTheme(savedTheme);
      }
      setIsLoaded(true);
    });
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const newTheme = prev === 'dark' ? 'light' : 'dark';
      AsyncStorage.setItem('app-theme', newTheme);
      return newTheme;
    });
  };

  if (!isLoaded) return null; // Avoid flicker

  const value: ThemeContextValue = {
    theme,
    isDark: theme === 'dark',
    colors: theme === 'dark' ? darkColors : lightColors,
    toggleTheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
