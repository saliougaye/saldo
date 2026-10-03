import { verifyOAuthQueryParams } from '@better-auth/oauth-provider';
import { and, eq } from 'drizzle-orm';
import { auth } from '../auth/auth';
import { getDb } from '../db/client';
import { oauthClient, oauthConsent } from '../db/schema';
import { log, shortId } from '../log';
import { mcpEnabled } from '../settings/serverSettings';
// TODO(0.4a-1 merge): import from @saldo/core
import type { ToolScope } from './toolScope';
import { oauthIssuer } from './urls';

/** Decision 11: a client registered less than this long ago, that nobody has consented to, is «fresh». */
export const FRESH_CLIENT_MS = 10 * 60_000;

/**
 * Added by the plugin to sign the query, or meaningless once the user is on the consent page:
 * never forwarded to the authorize endpoint. `prompt` and `max_age` would send the browser back to
 * `/login` or to this page in a loop.
 */
const NOT_FORWARDED = new Set(['sig', 'exp', 'ba_iat', 'ba_param', 'ba_pl', 'prompt', 'max_age']);

export type ConsentRequest = {
  clientId: string;
  clientName: string;
  redirectHost: string;
  requestedScopes: ToolScope[];
  fresh: boolean;
  previouslyAuthorizedAt: Date | null;
};

/** Next's `searchParams` as the exact query the plugin signed (repeated keys kept: `ba_param`, `resource`). */
export function consentSearchParams(
  record: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined) continue;
    for (const one of Array.isArray(value) ? value : [value]) params.append(key, one);
  }
  return params;
}

/** The signature and expiry the plugin put on the query it redirected with (`verifyOAuthQueryParams`). */
export async function signedQueryHolds(searchParams: URLSearchParams): Promise<boolean> {
  if (!searchParams.has('sig')) return false;
  const { secret } = await auth().$context;
  return verifyOAuthQueryParams(searchParams.toString(), secret);
}

/** The authorize query to resume with: the signed one without its signature, optionally narrowed. */
export function authorizeQuery(searchParams: URLSearchParams, scope?: string): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of searchParams) {
    if (!NOT_FORWARDED.has(key)) params.append(key, value);
  }
  if (scope !== undefined) params.set('scope', scope);
  return params;
}

/** `read` is always asked for and always granted (the consent page marks it «richiesto»). */
export function requestedToolScopes(scope: string | null): ToolScope[] {
  return (scope ?? '').split(' ').includes('write') ? ['read', 'write'] : ['read'];
}

/** What a consent grants: `read`, `write` if asked and kept, `offline_access` if asked (decision 3). */
export function grantedScopes(
  requested: readonly ToolScope[],
  chosen: readonly ToolScope[],
  originalScope: string | null,
): string[] {
  const tools = requested.filter((scope) => scope === 'read' || chosen.includes(scope));
  const offline = (originalScope ?? '').split(' ').includes('offline_access')
    ? ['offline_access']
    : [];
  return [...tools, ...offline];
}

type Inspected =
  | { ok: true; request: ConsentRequest; redirectUri: string }
  | { ok: false; reason: 'invalid' | 'disabled' };

async function inspect(searchParams: URLSearchParams, userId: string): Promise<Inspected> {
  const db = getDb();
  if (!(await mcpEnabled(db))) return { ok: false, reason: 'disabled' };
  if (!(await signedQueryHolds(searchParams))) return { ok: false, reason: 'invalid' };
  const clientId = searchParams.get('client_id');
  const redirectUri = searchParams.get('redirect_uri');
  if (clientId === null || redirectUri === null || !URL.canParse(redirectUri)) {
    return { ok: false, reason: 'invalid' };
  }
  const [client] = await db
    .select({
      name: oauthClient.name,
      disabled: oauthClient.disabled,
      createdAt: oauthClient.createdAt,
    })
    .from(oauthClient)
    .where(eq(oauthClient.clientId, clientId));
  if (client === undefined || client.disabled === true) return { ok: false, reason: 'invalid' };
  const [mine] = await db
    .select({ createdAt: oauthConsent.createdAt })
    .from(oauthConsent)
    .where(and(eq(oauthConsent.clientId, clientId), eq(oauthConsent.userId, userId)));
  const [anyone] = await db
    .select({ id: oauthConsent.id })
    .from(oauthConsent)
    .where(eq(oauthConsent.clientId, clientId))
    .limit(1);
  const fresh =
    anyone === undefined &&
    client.createdAt !== null &&
    Date.now() - client.createdAt.getTime() < FRESH_CLIENT_MS;
  return {
    ok: true,
    redirectUri,
    request: {
      clientId,
      clientName: client.name ?? clientId,
      redirectHost: new URL(redirectUri).host,
      requestedScopes: requestedToolScopes(searchParams.get('scope')),
      fresh,
      previouslyAuthorizedAt: mine?.createdAt ?? null,
    },
  };
}

/**
 * §17.4.3, `/oauth/consent`: what the page shows. `invalid` for a query the plugin did not sign (or
 * signed more than ten minutes ago), an unknown or disabled client; `disabled` while MCP is off.
 */
export async function readConsentRequest(
  searchParams: URLSearchParams,
  userId: string,
): Promise<{ ok: true; request: ConsentRequest } | { ok: false; reason: 'invalid' | 'disabled' }> {
  const inspected = await inspect(searchParams, userId);
  return inspected.ok ? { ok: true, request: inspected.request } : inspected;
}

/** RFC 6749 §4.1.2.1 + RFC 9207: back to the client, which the signature vouches for. */
export function deniedRedirect(redirectUri: string, state: string | null): string {
  const url = new URL(redirectUri);
  url.searchParams.set('error', 'access_denied');
  url.searchParams.set('error_description', 'The user denied access');
  if (state !== null) url.searchParams.set('state', state);
  url.searchParams.set('iss', oauthIssuer());
  return url.toString();
}

/**
 * «Autorizza» / «Nega» (decision 9). Accepting stores the consent and returns the authorize URL to
 * navigate to, where the plugin re-checks everything and issues the code; refusing returns the
 * client's `redirect_uri` with `access_denied`. A query that no longer holds (or MCP switched off
 * meanwhile) returns the consent page itself, which then shows why.
 */
export async function submitConsent(args: {
  searchParams: URLSearchParams;
  userId: string;
  accept: boolean;
  scopes: ToolScope[];
}): Promise<{ redirectTo: string }> {
  const inspected = await inspect(args.searchParams, args.userId);
  if (!inspected.ok) return { redirectTo: `/oauth/consent?${args.searchParams.toString()}` };
  const { request, redirectUri } = inspected;
  if (!args.accept) {
    log('mcp', 'consent refused', {
      user: shortId(args.userId),
      client: shortId(request.clientId),
    });
    return { redirectTo: deniedRedirect(redirectUri, args.searchParams.get('state')) };
  }
  const scopes = grantedScopes(
    request.requestedScopes,
    args.scopes,
    args.searchParams.get('scope'),
  );
  const now = new Date();
  await getDb()
    .insert(oauthConsent)
    .values({
      id: crypto.randomUUID(),
      clientId: request.clientId,
      userId: args.userId,
      scopes,
      resources: args.searchParams.getAll('resource'),
      requestedUserInfoClaims: [],
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [oauthConsent.clientId, oauthConsent.userId],
      set: { scopes, resources: args.searchParams.getAll('resource'), updatedAt: now },
    });
  log('mcp', 'consent given', {
    user: shortId(args.userId),
    client: shortId(request.clientId),
    scopes: scopes.join(' '),
  });
  return {
    redirectTo: `/api/auth/oauth2/authorize?${authorizeQuery(args.searchParams, scopes.join(' ')).toString()}`,
  };
}
