import { createHash } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { GET as authGet } from '../../../app/api/auth/[...all]/route';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { createTestClient, TEST_REDIRECT } from '../test/oauth';
import { createTestSession, sessionCookie } from '../test/session';
import { oauthResumePath } from './resume';

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
const CHALLENGE = createHash('sha256').update('v'.repeat(64)).digest('base64url');

async function loginRedirect(clientId: string): Promise<URL> {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: TEST_REDIRECT,
    scope: 'read offline_access',
    state: 'st-2',
    code_challenge: CHALLENGE,
    code_challenge_method: 'S256',
    resource: `${ORIGIN}/mcp`,
    prompt: 'login',
  });
  const response = await authGet(
    new Request(`${ORIGIN}/api/auth/oauth2/authorize?${params.toString()}`),
  );
  expect(response.status).toBe(302);
  return new URL(response.headers.get('location') ?? '', ORIGIN);
}

describe('oauthResumePath', () => {
  it('turns the signed /login query back into the authorize request, which then reaches consent', async () => {
    const { clientId } = await createTestClient(harness.db);
    const login = await loginRedirect(clientId);
    expect(login.pathname).toBe('/login');

    const path = await oauthResumePath(login.searchParams);
    expect(path?.startsWith('/api/auth/oauth2/authorize?')).toBe(true);
    const resumed = new URL(path ?? '', ORIGIN).searchParams;
    for (const name of ['sig', 'exp', 'ba_iat', 'ba_param', 'prompt'])
      expect(resumed.has(name)).toBe(false);
    expect(resumed.get('client_id')).toBe(clientId);

    const session = await createTestSession(harness.db, 'Ada');
    const response = await authGet(
      new Request(new URL(path ?? '', ORIGIN), {
        headers: { cookie: await sessionCookie(session.token) },
      }),
    );
    expect(response.status).toBe(302);
    expect(new URL(response.headers.get('location') ?? '', ORIGIN).pathname).toBe('/oauth/consent');
  });

  it('is null for a /login with no signed query, or a tampered one', async () => {
    expect(await oauthResumePath(new URLSearchParams())).toBeNull();
    const { clientId } = await createTestClient(harness.db);
    const login = await loginRedirect(clientId);
    const tampered = new URLSearchParams(login.searchParams);
    tampered.set('redirect_uri', 'https://evil.example/cb');
    expect(await oauthResumePath(tampered)).toBeNull();
  });
});
