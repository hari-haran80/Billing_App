import { ThemeProvider } from "@/constants/ThemeContext";
import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { initDatabase } from "../lib/database";
import { ErrorBoundary } from "../components/ErrorBoundary";

export default function RootLayout() {
  useEffect(() => {
    const initialize = async () => {
      try {
        await initDatabase();
      } catch (error) {
        console.error("Failed to initialize database:", error);
      }
    };
    initialize();
  }, []);

  return (
    <ThemeProvider>
      <StatusBar style="auto" />
      <ErrorBoundary>
        <Slot />
      </ErrorBoundary>
    </ThemeProvider>
  );
}
