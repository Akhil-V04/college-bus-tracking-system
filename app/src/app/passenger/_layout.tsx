import { Stack } from 'expo-router';
import { useTheme } from "@/contexts/ThemeContext";

export default function PassengerLayout() {
    const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surfaceElevated },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontWeight: '800' },
        contentStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="search" options={{ headerShown: false }} />
      <Stack.Screen name="[routeNo]" options={{ headerShown: false }} />
      <Stack.Screen name="emergency" options={{ headerShown: false }} />
      <Stack.Screen name="report-issue" options={{ headerShown: false }} />
      <Stack.Screen name="assistant" options={{ headerShown: false }} />
    </Stack>
  );
}
