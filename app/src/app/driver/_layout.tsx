import { Stack } from 'expo-router';
import { useTheme } from "@/contexts/ThemeContext";

export default function DriverLayout() {
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
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
