import { normaliseServerUrl } from './link';

/**
 * The server address the app was built for (§15). It reaches the app through `expoConfig.extra`,
 * which is plain JSON of unknown shape at runtime, and it is validated the way the address field
 * used to be: a typo in `SALDO_SERVER_URL` must fail loudly, not point the app somewhere odd.
 */
export function readServerUrl(extra: unknown): string | null {
  if (typeof extra !== 'object' || extra === null) return null;
  const value = (extra as { serverUrl?: unknown }).serverUrl;
  if (typeof value !== 'string') return null;
  return normaliseServerUrl(value);
}
