import { Stack } from 'expo-router';

import { colors } from '@/constants/theme';

export default function PassengerLayout() {
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
    </Stack>
  );
}
