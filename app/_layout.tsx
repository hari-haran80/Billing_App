import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { initDatabase } from '../lib/database';
import { ThemeProvider } from '@/constants/ThemeContext';

export default function RootLayout() {
  useEffect(() => {
    initDatabase();
  }, []);

  return (
    <ThemeProvider>
      <StatusBar style="auto" />
      <Slot />
    </ThemeProvider>
  );
}