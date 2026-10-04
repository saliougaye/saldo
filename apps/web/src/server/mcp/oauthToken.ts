import { createHash } from 'node:crypto';

/**
 * How access tokens, refresh tokens and authorization codes are stored (§17.4.1: «stored hashed»).
 * The same algorithm as the plugin's default (`defaultHasher`: SHA-256, base64url, no padding), but
 * passed to it as `storeTokens.hash` so the function `/mcp` looks tokens up with is, by construction,
 * the one they were stored with.
 */
export function hashOAuthToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}

/** RFC 6750 `b64token`. */
const BEARER = /^Bearer +([A-Za-z0-9\-._~+/]+=*) *$/i;

/** The token of `Authorization: Bearer …`, the only place one is accepted (OAuth 2.1). */
export function bearerToken(request: Request): string | undefined {
  const header = request.headers.get('authorization');
  if (header === null) return undefined;
  return BEARER.exec(header)?.[1];
}
