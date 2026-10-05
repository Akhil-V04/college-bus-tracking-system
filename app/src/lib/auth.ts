import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const DRIVER_TOKEN_KEY = 'college-bus-driver-token';

export async function getDriverToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return globalThis.localStorage?.getItem(DRIVER_TOKEN_KEY) || null;
  }
  return SecureStore.getItemAsync(DRIVER_TOKEN_KEY);
}

export async function saveDriverToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(DRIVER_TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(DRIVER_TOKEN_KEY, token);
}

export async function clearDriverToken(): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.removeItem(DRIVER_TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(DRIVER_TOKEN_KEY);
}
