import { env } from '../env';

/**
 * §17.4.1. Every URL MCP clients see, derived from `PUBLIC_URL` (already without a trailing slash).
 *
 * The issuer is `{PUBLIC_URL}/api/auth`, not `PUBLIC_URL`: the plugin's issuer is Better Auth's base
 * URL, which includes the base path, and with no JWT plugin there is no other issuer setting.
 */
export function mcpResourceUrl(publicUrl: string = env().publicUrl): string {
  return `${publicUrl}/mcp`;
}

export function oauthIssuer(publicUrl: string = env().publicUrl): string {
  return `${publicUrl}/api/auth`;
}

export function protectedResourceMetadataUrl(publicUrl: string = env().publicUrl): string {
  return `${publicUrl}/.well-known/oauth-protected-resource`;
}

/**
 * The scopes the authorization server knows. `read` and `write` are the two a person sees (D40);
 * `offline_access` is technical — the plugin issues a refresh token only when it is granted — and is
 * granted with `read` whenever the client asked for it.
 */
export const OAUTH_SCOPES = ['read', 'write', 'offline_access'] as const;
