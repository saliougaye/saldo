import { getDb } from '../db/client';
import type { ServerDatabase } from '../db/types';
import { mcpEnabled } from '../settings/serverSettings';

const OAUTH_PREFIX = '/api/auth/oauth2/';
const WELL_KNOWN_PREFIX = '/api/auth/.well-known/';

/** What MCP clients use (§17.4.1). Everything else the plugin serves, Saldo does not offer. */
const OFFERED = new Set(['register', 'authorize', 'token', 'revoke', 'introspect']);

/**
 * Refused while MCP is off: what starts a new authorization. Token, revoke and introspect stay — a
 * refresh while off is harmless (`/mcp` answers 404), and a client that keeps its refresh token works
 * again when MCP is back on.
 */
const NEEDS_MCP = new Set(['register', 'authorize']);

const notFound = () => Response.json({ error: 'not_found' }, { status: 404 });

/**
 * Runs in the catch-all route before Better Auth: `null` lets the request through. The plugin's
 * consent/continue endpoints, its userinfo and end-session, and its client, resource and consent CRUD
 * all answer 404 — Saldo's consent is `/oauth/consent` (`consent.ts`), and nobody manages clients.
 */
export async function oauthGate(
  request: Request,
  db: ServerDatabase = getDb(),
): Promise<Response | null> {
  const { pathname } = new URL(request.url);
  if (pathname.startsWith(WELL_KNOWN_PREFIX)) return (await mcpEnabled(db)) ? null : notFound();
  if (!pathname.startsWith(OAUTH_PREFIX)) return null;
  const endpoint = pathname.slice(OAUTH_PREFIX.length);
  if (!OFFERED.has(endpoint)) return notFound();
  if (NEEDS_MCP.has(endpoint) && !(await mcpEnabled(db))) return notFound();
  return null;
}
