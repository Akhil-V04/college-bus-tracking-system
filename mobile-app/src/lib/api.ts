import { Platform } from 'react-native';

const fallbackUrl = Platform.OS === 'android'
  ? 'http://10.0.2.2:4000'
  : 'http://localhost:4000';

const configuredUrl = (process.env.EXPO_PUBLIC_API_URL || fallbackUrl).replace(/\/$/, '');
export const API_URL = configuredUrl.endsWith('/api/v1') ? configuredUrl : configuredUrl + '/api/v1';
export const API_ORIGIN = API_URL.replace(/\/api\/v1$/, '');

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
