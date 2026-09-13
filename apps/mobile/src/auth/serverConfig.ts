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

/** What `app.config.ts` uses when `SALDO_SCHEME` is unset. Kept in step with it by hand. */
const DEFAULT_SCHEME = 'saldo';

/**
 * The URL scheme this build registered (§15 `SALDO_SCHEME`), read off the Expo manifest, which is
 * plain JSON of unknown shape at runtime. Expo permits a single scheme or a list; the first entry
 * of a list is the primary one. Anything missing or unusable falls back to the same default
 * `app.config.ts` applies, which is the scheme the build then registers.
 */
export function readScheme(config: unknown): string {
  if (typeof config !== 'object' || config === null) return DEFAULT_SCHEME;
  const value = (config as { scheme?: unknown }).scheme;
  const first = Array.isArray(value) ? value[0] : value;
  if (typeof first !== 'string') return DEFAULT_SCHEME;
  const trimmed = first.trim();
  return trimmed.length === 0 ? DEFAULT_SCHEME : trimmed;
}
