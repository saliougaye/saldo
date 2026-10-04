import { oauthAccessToken, oauthClient, oauthConsent, oauthRefreshToken } from '../db/schema';
import type { ServerDatabase } from '../db/types';
import { hashOAuthToken } from '../mcp/oauthToken';
import { mcpResourceUrl } from '../mcp/urls';

export const TEST_REDIRECT = 'http://localhost:33418/callback';

/** A registered public client, as `POST /oauth2/register` would have stored it. */
export async function createTestClient(
  db: ServerDatabase,
  overrides: Partial<typeof oauthClient.$inferInsert> = {},
): Promise<{ clientId: string }> {
  const clientId = overrides.clientId ?? `client-${crypto.randomUUID()}`;
  const now = new Date();
  await db.insert(oauthClient).values({
    id: crypto.randomUUID(),
    name: 'Claude Code',
    redirectUris: [TEST_REDIRECT],
    tokenEndpointAuthMethod: 'none',
    applicationType: 'native',
    grantTypes: ['authorization_code', 'refresh_token'],
    responseTypes: ['code'],
    scopes: ['read', 'write', 'offline_access'],
    createdAt: now,
    updatedAt: now,
    ...overrides,
    clientId,
  });
  return { clientId };
}

export async function grantTestConsent(
  db: ServerDatabase,
  input: { userId: string; clientId: string; scopes: string[]; at?: Date },
): Promise<void> {
  const at = input.at ?? new Date();
  await db.insert(oauthConsent).values({
    id: crypto.randomUUID(),
    clientId: input.clientId,
    userId: input.userId,
    scopes: input.scopes,
    resources: [mcpResourceUrl()],
    requestedUserInfoClaims: [],
    createdAt: at,
    updatedAt: at,
  });
}

/** An access token row the plugin would have written; returns the raw token, which only the client holds. */
export async function issueTestAccessToken(
  db: ServerDatabase,
  input: {
    userId: string;
    clientId: string;
    scopes?: string[];
    resources?: string[] | null;
    expiresAt?: Date;
    revoked?: Date | null;
  },
): Promise<{ token: string; bearer: string }> {
  const token = `test-at-${crypto.randomUUID()}`;
  await db.insert(oauthAccessToken).values({
    id: crypto.randomUUID(),
    token: hashOAuthToken(token),
    clientId: input.clientId,
    userId: input.userId,
    scopes: input.scopes ?? ['read'],
    resources: input.resources === undefined ? [mcpResourceUrl()] : input.resources,
    expiresAt: input.expiresAt ?? new Date(Date.now() + 3_600_000),
    createdAt: new Date(),
    revoked: input.revoked ?? null,
  });
  return { token, bearer: `Bearer ${token}` };
}

export async function issueTestRefreshToken(
  db: ServerDatabase,
  input: { userId: string; clientId: string; scopes?: string[] },
): Promise<void> {
  await db.insert(oauthRefreshToken).values({
    id: crypto.randomUUID(),
    token: hashOAuthToken(`test-rt-${crypto.randomUUID()}`),
    clientId: input.clientId,
    userId: input.userId,
    scopes: input.scopes ?? ['read', 'offline_access'],
    resources: [mcpResourceUrl()],
    expiresAt: new Date(Date.now() + 180 * 86_400_000),
    createdAt: new Date(),
  });
}
