/**
 * Where the server sends the finished sign-in (§9.3 step 5). The scheme is not fixed: it is the one
 * this build registered with the operating system, which `SALDO_SCHEME` decides (§15). Hard-coding
 * `saldo` here would break every fork that renames it — the browser would hand the callback to a
 * scheme the app no longer owns, and sign-in would stall with nothing to show for it.
 *
 * Whatever the scheme is, the server must also list it in `APP_REDIRECT_SCHEMES` (§18), or it
 * refuses the redirect with `invalid_redirect_uri`.
 */
export function redirectUri(scheme: string): string {
  return `${scheme}://auth/callback`;
}

/**
 * The hosts plain `http` may reach: this machine, and the Android emulator's name for it. Nothing
 * on a network sits between the app and these, so nothing can impersonate the server (§18).
 * WebAuthn itself only runs in a secure context or on localhost, so no other http address could
 * sign anybody in anyway.
 */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '10.0.2.2']);

/** Parses what the user typed into a URL, `https://` added to a bare host; null when unusable. */
function parseAddress(input: string): URL | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  if (!URL.canParse(withScheme)) return null;
  const url = new URL(withScheme);
  if (url.hostname.length === 0 || url.hostname.includes(' ')) return null;
  if (url.pathname !== '/' && url.pathname !== '') return null;
  return url;
}

/**
 * What the user typed, turned into an origin. A bare hostname gets `https://`, because that is the
 * only scheme a real deployment can use (§9.2). `http` survives only when spelled out **and**
 * pointed at this machine (`LOOPBACK_HOSTS`), for a server running beside the app in development:
 * over a network it would let anybody on the path answer as the server.
 */
export function normaliseServerUrl(input: string): string | null {
  const url = parseAddress(input);
  if (url === null) return null;
  if (url.protocol === 'http:' && !LOOPBACK_HOSTS.has(url.hostname)) return null;
  return `${url.protocol}//${url.host}`;
}

/** A well-formed address refused only because it is plain `http` to another machine. */
export function isInsecureAddress(input: string): boolean {
  const url = parseAddress(input);
  return url !== null && url.protocol === 'http:' && !LOOPBACK_HOSTS.has(url.hostname);
}

/** What the user is shown: the host, without a scheme they never typed. */
export function serverLabel(serverUrl: string): string {
  return URL.canParse(serverUrl) ? new URL(serverUrl).host : serverUrl;
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
