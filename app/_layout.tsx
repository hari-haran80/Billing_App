import { ThemeProvider } from "@/constants/ThemeContext";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { initDatabase } from "../lib/database";

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
      <StatusBar style="dark" backgroundColor="transparent" />
      <ErrorBoundary>
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="bill-details" options={{ headerShown: false }} />
          <Stack.Screen name="edit-bill" options={{ headerShown: false }} />
          <Stack.Screen name="index" options={{ headerShown: false }} />
        </Stack>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
