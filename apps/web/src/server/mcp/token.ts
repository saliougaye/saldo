import type { ToolScope } from '@saldo/core';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { oauthAccessToken, oauthClient, oauthConsent, user } from '../db/schema';
import { bearerToken, hashOAuthToken } from './oauthToken';
import { mcpResourceUrl, protectedResourceMetadataUrl } from './urls';

/** Who is calling `/mcp`: the user who consented, the client they consented to, what they granted. */
export type McpPrincipal = { userId: string; clientId: string; scopes: ToolScope[] };

/** What the lookup reads for a token hash. */
export interface AccessTokenRow {
  userId: string;
  clientId: string;
  scopes: string[];
  resources: string[] | null;
  expiresAt: Date;
  revoked: Date | null;
  clientDisabled: boolean | null;
  banned: boolean | null;
}

const TOOL_SCOPES: readonly string[] = ['read', 'write'] satisfies readonly ToolScope[];
const isToolScope = (scope: string): scope is ToolScope => TOOL_SCOPES.includes(scope);

/**
 * §17.4.1, decision 4: the acceptance rule for the row the lookup found — which it finds only while the
 * user–client pair has a consent — pure. The browser session the consent was given in
 * is deliberately not consulted — an MCP client must not stop when its user signs out of the web.
 */
export function acceptAccessToken(
  row: AccessTokenRow | null,
  now: Date,
  resource: string,
): { ok: true; principal: McpPrincipal } | { ok: false } {
  if (row === null) return { ok: false };
  if (row.revoked !== null) return { ok: false };
  if (row.expiresAt.getTime() <= now.getTime()) return { ok: false };
  if (!(row.resources ?? []).includes(resource)) return { ok: false };
  if (row.clientDisabled === true || row.banned === true) return { ok: false };
  return {
    ok: true,
    principal: {
      userId: row.userId,
      clientId: row.clientId,
      scopes: row.scopes.filter(isToolScope),
    },
  };
}

/** RFC 6750 §3 + RFC 9728 §5.1. With no error it is exactly `Bearer resource_metadata="…"`. */
export function bearerChallenge(
  params: {
    error?: 'invalid_token' | 'invalid_request' | 'insufficient_scope';
    scope?: string;
  } = {},
): string {
  const parts: string[] = [];
  if (params.error !== undefined) parts.push(`error="${params.error}"`);
  if (params.scope !== undefined) parts.push(`scope="${params.scope}"`);
  parts.push(`resource_metadata="${protectedResourceMetadataUrl()}"`);
  return `Bearer ${parts.join(', ')}`;
}

function unauthorized(invalid: boolean): Response {
  return Response.json(
    invalid
      ? { error: 'invalid_token', error_description: 'The access token is not valid' }
      : { error: 'unauthorized', error_description: 'A bearer token is required' },
    {
      status: 401,
      headers: { 'www-authenticate': bearerChallenge(invalid ? { error: 'invalid_token' } : {}) },
    },
  );
}

/**
 * The first thing `/mcp` does after the switch. The token is accepted only in the header (OAuth 2.1),
 * looked up by its hash, and never logged.
 */
export async function verifyMcpRequest(
  request: Request,
): Promise<{ ok: true; principal: McpPrincipal } | { ok: false; response: Response }> {
  if (new URL(request.url).searchParams.has('access_token')) {
    return {
      ok: false,
      response: Response.json(
        {
          error: 'invalid_request',
          error_description: 'An access token is accepted only in the Authorization header',
        },
        {
          status: 400,
          headers: { 'www-authenticate': bearerChallenge({ error: 'invalid_request' }) },
        },
      ),
    };
  }
  const token = bearerToken(request);
  if (token === undefined) return { ok: false, response: unauthorized(false) };
  const [row] = await getDb()
    .select({
      userId: user.id,
      clientId: oauthAccessToken.clientId,
      scopes: oauthAccessToken.scopes,
      resources: oauthAccessToken.resources,
      expiresAt: oauthAccessToken.expiresAt,
      revoked: oauthAccessToken.revoked,
      clientDisabled: oauthClient.disabled,
      banned: user.banned,
    })
    .from(oauthAccessToken)
    .innerJoin(oauthClient, eq(oauthClient.clientId, oauthAccessToken.clientId))
    .innerJoin(user, eq(user.id, oauthAccessToken.userId))
    // The consent is the one source of truth for «this app may read my data»: the plugin's code and
    // refresh grants never check it, so a code exchanged after «Revoca accesso» would otherwise mint a
    // token that `/profile/connectors` neither shows nor can revoke.
    .innerJoin(
      oauthConsent,
      and(
        eq(oauthConsent.clientId, oauthAccessToken.clientId),
        eq(oauthConsent.userId, oauthAccessToken.userId),
      ),
    )
    .where(eq(oauthAccessToken.token, hashOAuthToken(token)))
    .limit(1);
  const verdict = acceptAccessToken(row ?? null, new Date(), mcpResourceUrl());
  if (!verdict.ok) return { ok: false, response: unauthorized(true) };
  return verdict;
}
