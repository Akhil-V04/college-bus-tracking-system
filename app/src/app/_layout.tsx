import { ThemeProvider } from '@/contexts/ThemeContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import '@/lib/backgroundLocation';
import { useTheme } from "@/contexts/ThemeContext";

function RootApp() {
    const { colors } = useTheme();
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 15_000,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="passenger" />
        <Stack.Screen name="driver" />
      </Stack>
    </QueryClientProvider>
  );
}

export default function RootLayout() { return <ThemeProvider><RootApp /></ThemeProvider>; }
