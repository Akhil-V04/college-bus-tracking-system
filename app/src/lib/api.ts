import { Platform } from 'react-native';

let fallbackUrl = 'http://192.168.29.215:4000';
if (Platform.OS === 'web') {
  fallbackUrl = 'http://localhost:4000';
} else if (Platform.OS === 'android') {
  fallbackUrl = 'http://192.168.29.215:4000'; // Change to 10.0.2.2 if using Android Emulator
}

// Use env var if present, otherwise smartly fallback based on platform
let configuredUrl = (process.env.EXPO_PUBLIC_API_URL || fallbackUrl).replace(/\/$/, '');

// Overwrite env var on web to force localhost if they are testing on PC
if (Platform.OS === 'web') {
  configuredUrl = 'http://localhost:4000';
}
export const API_URL = configuredUrl.endsWith('/api/v1') ? configuredUrl : configuredUrl + '/api/v1';
export const API_ORIGIN = API_URL.replace(/\/api\/v1$/, '');

console.log('--- API CONFIGURATION DEBUG ---');
console.log('Platform:', Platform.OS);
console.log('EXPO_PUBLIC_API_URL from env:', process.env.EXPO_PUBLIC_API_URL);
console.log('Final API_URL:', API_URL);
console.log('-------------------------------');

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type RequestOptions = RequestInit & { token?: string | null };

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, headers, ...requestOptions } = options;
  const response = await fetch(API_URL + path, {
    ...requestOptions,
    headers: {
      Accept: 'application/json',
      ...(requestOptions.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...headers,
    },
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(body?.error || 'Request failed. Please try again.', response.status);
  }
  return body as T;
}
