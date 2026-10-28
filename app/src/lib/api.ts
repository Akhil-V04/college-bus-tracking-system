import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Helper to normalize an origin: strips trailing slash and removes /api/v1 if present
function normalizeOrigin(url: string): string {
  let cleaned = url.trim().replace(/\/+$/, '');
  if (cleaned.endsWith('/api/v1')) {
    cleaned = cleaned.slice(0, -'/api/v1'.length);
  }
  return cleaned.replace(/\/+$/, '');
}

// Auto-detect host IP from Expo's Metro bundler URI (e.g. "172.21.7.252:8081" or "10.96.63.205:8081")
const metroHostUri =
  Constants.expoConfig?.hostUri ||
  (Constants as any).manifest2?.extra?.expoClient?.hostUri ||
  (Constants as any).manifest?.debuggerHost;

const detectedHostIp = metroHostUri ? metroHostUri.split(':')[0] : null;

// Primary network IP (current Wi-Fi) and previous network IP (college Wi-Fi)
export const CURRENT_HOST_IP = '172.21.7.252';
export const PREVIOUS_HOST_IP = '10.96.63.205';

// Build candidate origins list with priority:
// 1. Detected Metro host IP (if live debugging with Expo Go)
// 2. EXPO_PUBLIC_API_URL from .env
// 3. EXPO_PUBLIC_ALT_API_URL from .env
// 4. Current Wi-Fi host (172.21.7.252:4000)
// 5. Previous Wi-Fi host (10.96.63.205:4000)
// 6. Android emulator host (10.0.2.2:4000)
// 7. Localhost (web / adb reverse)
const rawCandidates: (string | null | undefined)[] = [
  Platform.OS === 'web' ? 'http://localhost:4000' : null,
  detectedHostIp ? `http://${detectedHostIp}:4000` : null,
  process.env.EXPO_PUBLIC_API_URL ? normalizeOrigin(process.env.EXPO_PUBLIC_API_URL) : null,
  process.env.EXPO_PUBLIC_ALT_API_URL ? normalizeOrigin(process.env.EXPO_PUBLIC_ALT_API_URL) : null,
  `http://${CURRENT_HOST_IP}:4000`,
  `http://${PREVIOUS_HOST_IP}:4000`,
  Platform.OS === 'android' ? 'http://10.0.2.2:4000' : null,
  'http://localhost:4000',
];

// Unique candidate origins preserving priority
export const CANDIDATE_ORIGINS: string[] = Array.from(
  new Set(rawCandidates.filter((c): c is string => Boolean(c && typeof c === 'string')))
);

// Initial active origin
let activeOrigin = CANDIDATE_ORIGINS[0] || `http://${CURRENT_HOST_IP}:4000`;

export let API_ORIGIN = activeOrigin;
export let API_URL = `${activeOrigin}/api/v1`;

export function getApiOrigin(): string {
  return API_ORIGIN;
}

export function getApiUrl(): string {
  return API_URL;
}

function setActiveOrigin(newOrigin: string) {
  activeOrigin = newOrigin;
  API_ORIGIN = newOrigin;
  API_URL = `${newOrigin}/api/v1`;
  console.log(`[API] Switched active API host to: ${API_ORIGIN}`);
}

console.log('--- API CONFIGURATION DEBUG ---');
console.log('Platform:', Platform.OS);
console.log('Detected Metro Host IP:', detectedHostIp);
console.log('Candidate Hosts:', CANDIDATE_ORIGINS);
console.log('Initial API_URL:', API_URL);
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

function isNetworkError(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message || err).toLowerCase();
  return (
    msg.includes('network request failed') ||
    msg.includes('failed to connect') ||
    msg.includes('noroutetohost') ||
    msg.includes('unreachable') ||
    msg.includes('connection refused') ||
    msg.includes('connection reset') ||
    msg.includes('timeout') ||
    msg.includes('aborted')
  );
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, headers, ...requestOptions } = options;
  const fullHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(requestOptions.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: 'Bearer ' + token } : {}),
    ...(headers as Record<string, string> || {}),
  };

  // 1. Try with current activeOrigin
  try {
    const response = await fetch(`${activeOrigin}/api/v1${path}`, {
      ...requestOptions,
      headers: fullHeaders,
    });

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new ApiError(body?.error || 'Request failed. Please try again.', response.status);
    }
    return body as T;
  } catch (err: any) {
    // If it's an API error (HTTP 4xx/5xx from server), don't failover; rethrow
    if (err instanceof ApiError) {
      throw err;
    }

    // If it's not a network connectivity error, rethrow
    if (!isNetworkError(err) && Platform.OS === 'web') {
      throw err;
    }

    console.warn(`[API] Host ${activeOrigin} unreachable (${err?.message || err}). Probing alternative hosts...`);

    // 2. Try remaining candidate hosts (e.g. 172.21.7.252, 10.96.63.205, 10.0.2.2)
    for (const candidate of CANDIDATE_ORIGINS) {
      if (candidate === activeOrigin) continue;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const testRes = await fetch(`${candidate}/api/v1${path}`, {
          ...requestOptions,
          headers: fullHeaders,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        // Candidate responded! Set as active origin
        setActiveOrigin(candidate);

        const body = await testRes.json().catch(() => null);
        if (!testRes.ok) {
          throw new ApiError(body?.error || 'Request failed. Please try again.', testRes.status);
        }
        return body as T;
      } catch (probeErr: any) {
        if (probeErr instanceof ApiError) {
          // The server actually responded with an HTTP status code, so candidate is reachable!
          setActiveOrigin(candidate);
          throw probeErr;
        }
        // Candidate unreachable, continue loop to next candidate
      }
    }

    // All candidate hosts failed
    throw new ApiError(
      'Cannot connect to campus transit server. Please check your Wi-Fi or hotspot connection.',
      0
    );
  }
}
