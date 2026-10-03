import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { GET as authGet, POST as authPost } from '../../../app/api/auth/[...all]/route';
import { oauthAccessToken, oauthRefreshToken, session } from '../db/schema';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { createTestClient, TEST_REDIRECT } from '../test/oauth';
import { createTestSession, sessionCookie } from '../test/session';
import { submitConsent } from './consent';
import { verifyMcpRequest } from './token';

/**
 * Decision 4: an MCP client must not stop when its user signs out of the web. The plugin revokes
 * every access token tied to a browser session when that session is deleted (its back-channel
 * logout plan), so Saldo detaches the tokens it issues from the session.
 */
let harness: TestDatabase;

beforeAll(async () => {
  harness = await createTestDatabase();
});

afterEach(async () => {
  await harness.reset();
});

afterAll(async () => {
  await harness.close();
});

const ORIGIN = 'http://localhost:3000';
const VERIFIER = 'v'.repeat(64);
const CHALLENGE = createHash('sha256').update(VERIFIER).digest('base64url');

async function follow(url: string, cookie: string): Promise<URL> {
  const response = await authGet(new Request(new URL(url, ORIGIN), { headers: { cookie } }));
  expect(response.status).toBe(302);
  return new URL(response.headers.get('location') ?? '', ORIGIN);
}

describe('tokens and the browser session', () => {
  it('signing out of the web leaves the MCP client connected', async () => {
    const ada = await createTestSession(harness.db, 'Ada');
    const cookie = await sessionCookie(ada.token);
    const { clientId } = await createTestClient(harness.db);
    const authorize = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: TEST_REDIRECT,
      scope: 'read offline_access',
      state: 'st-out',
      code_challenge: CHALLENGE,
      code_challenge_method: 'S256',
      resource: `${ORIGIN}/mcp`,
    });
    const consentAt = await follow(`/api/auth/oauth2/authorize?${authorize.toString()}`, cookie);
    const { redirectTo } = await submitConsent({
      searchParams: consentAt.searchParams,
      userId: ada.userId,
      accept: true,
      scopes: ['read'],
    });
    const code = (await follow(redirectTo, cookie)).searchParams.get('code') ?? '';

    const exchanged = await authPost(
      new Request(`${ORIGIN}/api/auth/oauth2/token`, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'x-forwarded-for': '192.0.2.20',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          code_verifier: VERIFIER,
          redirect_uri: TEST_REDIRECT,
          client_id: clientId,
          resource: `${ORIGIN}/mcp`,
        }),
      }),
    );
    expect(exchanged.status).toBe(200);
    const tokens = (await exchanged.json()) as { access_token: string; refresh_token: string };
    const mcp = () =>
      verifyMcpRequest(
        new Request(`${ORIGIN}/mcp`, {
          method: 'POST',
          headers: { authorization: `Bearer ${tokens.access_token}` },
        }),
      );
    expect((await mcp()).ok).toBe(true);
    for (const table of [oauthAccessToken, oauthRefreshToken]) {
      const rows = await harness.db.select({ sessionId: table.sessionId }).from(table);
      expect(rows).toEqual([{ sessionId: null }]);
    }

    const signedOut = await authPost(
      new Request(`${ORIGIN}/api/auth/sign-out`, {
        method: 'POST',
        headers: { cookie, origin: ORIGIN, 'content-type': 'application/json' },
        body: '{}',
      }),
    );
    expect(signedOut.status).toBe(200);
    expect(await harness.db.select().from(session).where(eq(session.userId, ada.userId))).toEqual(
      [],
    );

    expect((await mcp()).ok).toBe(true);
  });
});
