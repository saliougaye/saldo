export const REDIRECT_URI = 'saldo://auth/callback';

/**
 * What the user typed, turned into an origin. A bare hostname gets `https://`, because that is the
 * only scheme a real deployment can use (§9.2) — `http` survives only when spelled out, for
 * `http://localhost` during development.
 */
export function normaliseServerUrl(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  const withScheme = /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
  if (!URL.canParse(withScheme)) return null;
  const url = new URL(withScheme);
  if (url.hostname.length === 0 || url.hostname.includes(' ')) return null;
  if (url.pathname !== '/' && url.pathname !== '') return null;
  return `${url.protocol}//${url.host}`;
}

/** The server page the app opens in a browser session (§9.3 step 3). */
export function authorizeUrl(
  serverUrl: string,
  params: { redirectUri: string; state: string; mode: 'login' | 'register' },
): string {
  const url = new URL('/auth/mobile', serverUrl);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('state', params.state);
  url.searchParams.set('mode', params.mode);
  return url.toString();
}

/**
 * The handoff, read back out of the redirect: a one-time token and the `state` this app sent, so a
 * callback from somebody else's request can be told apart from its own.
 */
export function callbackParams(redirect: string): { ott: string; state: string } | null {
  if (!URL.canParse(redirect)) return null;
  const params = new URL(redirect).searchParams;
  const ott = params.get('ott');
  const state = params.get('state');
  if (ott === null || state === null) return null;
  return { ott, state };
}
