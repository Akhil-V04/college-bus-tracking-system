import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Auto-detect host IP from Expo's Metro bundler URI (e.g. "10.96.63.205:8081")
const metroHostUri =
  Constants.expoConfig?.hostUri ||
  (Constants as any).manifest2?.extra?.expoClient?.hostUri ||
  (Constants as any).manifest?.debuggerHost;

const detectedHostIp = metroHostUri ? metroHostUri.split(':')[0] : null;

let fallbackUrl = detectedHostIp
  ? `http://${detectedHostIp}:4000`
  : 'http://10.96.63.205:4000';

if (Platform.OS === 'web') {
  fallbackUrl = 'http://localhost:4000';
}

// If EXPO_PUBLIC_API_URL is set and not pointing to localhost on physical devices, use it
let configuredUrl = (process.env.EXPO_PUBLIC_API_URL || fallbackUrl).replace(/\/$/, '');

// On real device, if env still has an outdated IP but Metro is connected to a different IP, prioritize Metro host
if (Platform.OS !== 'web' && detectedHostIp && !configuredUrl.includes(detectedHostIp)) {
  configuredUrl = `http://${detectedHostIp}:4000/api/v1`;
}

if (Platform.OS === 'web') {
  configuredUrl = 'http://localhost:4000';
}

export const API_URL = configuredUrl.endsWith('/api/v1') ? configuredUrl : configuredUrl + '/api/v1';
export const API_ORIGIN = API_URL.replace(/\/api\/v1$/, '');

console.log('--- API CONFIGURATION DEBUG ---');
console.log('Platform:', Platform.OS);
console.log('Detected Metro Host IP:', detectedHostIp);
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
