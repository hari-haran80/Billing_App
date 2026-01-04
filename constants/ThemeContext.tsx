import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme as useDeviceColorScheme } from 'react-native';
import { Colors, ColorScheme } from '../constants/Colors';

interface ThemeContextType {
  colorScheme: ColorScheme;
  colors: typeof Colors.light;
  toggleColorScheme: () => void;
  setColorScheme: (scheme: ColorScheme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const deviceColorScheme = useDeviceColorScheme() as ColorScheme;
  const [colorScheme, setColorScheme] = useState<ColorScheme>(deviceColorScheme);

  // Update color scheme when device scheme changes
  useEffect(() => {
    setColorScheme(deviceColorScheme);
  }, [deviceColorScheme]);

  const toggleColorScheme = () => {
    setColorScheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const colors = Colors[colorScheme];

  return (
    <ThemeContext.Provider value={{ colorScheme, colors, toggleColorScheme, setColorScheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};