import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { GET as authGet } from '../../../app/api/auth/[...all]/route';
import { oauthClient, oauthConsent, serverSettings } from '../db/schema';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { createTestClient, grantTestConsent, TEST_REDIRECT } from '../test/oauth';
import { createTestSession, sessionCookie } from '../test/session';
import { readConsentRequest, submitConsent } from './consent';

let harness: TestDatabase;

beforeAll(async () => {
  harness = await createTestDatabase();
});

afterEach(async () => {
  vi.useRealTimers();
  await harness.reset();
});

afterAll(async () => {
  await harness.close();
});

const ORIGIN = 'http://localhost:3000';
const VERIFIER = `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll('-', '');
const CHALLENGE = createHash('sha256').update(VERIFIER).digest('base64url');

async function signedIn() {
  const session = await createTestSession(harness.db, 'Ada');
  return { userId: session.userId, cookie: await sessionCookie(session.token) };
}

function authorizeUrl(clientId: string, scope: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: TEST_REDIRECT,
    scope,
    state: 'st-1',
    code_challenge: CHALLENGE,
    code_challenge_method: 'S256',
    resource: `${ORIGIN}/mcp`,
  });
  return `${ORIGIN}/api/auth/oauth2/authorize?${params.toString()}`;
}

/** A browser with a session follows the authorize link; the plugin answers with a redirect. */
async function navigate(url: string, cookie: string): Promise<URL> {
  const response = await authGet(new Request(new URL(url, ORIGIN), { headers: { cookie } }));
  expect(response.status).toBe(302);
  return new URL(response.headers.get('location') ?? '', ORIGIN);
}

async function consentPage(clientId: string, cookie: string, scope = 'read write offline_access') {
  const location = await navigate(authorizeUrl(clientId, scope), cookie);
  expect(location.pathname).toBe('/oauth/consent');
  return location.searchParams;
}

describe('readConsentRequest', () => {
  it('names the client, its redirect host and what it asks for; a new client is fresh', async () => {
    const { userId, cookie } = await signedIn();
    const { clientId } = await createTestClient(harness.db);
    const params = await consentPage(clientId, cookie);
    expect(await readConsentRequest(params, userId)).toEqual({
      ok: true,
      request: {
        clientId,
        clientName: 'Claude Code',
        redirectHost: 'localhost:33418',
        requestedScopes: ['read', 'write'],
        fresh: true,
        previouslyAuthorizedAt: null,
      },
    });
  });

  it('asks for read alone when the client did not ask to write', async () => {
    const { userId, cookie } = await signedIn();
    const { clientId } = await createTestClient(harness.db);
    const params = await consentPage(clientId, cookie, 'read offline_access');
    expect(await readConsentRequest(params, userId)).toMatchObject({
      request: { requestedScopes: ['read'] },
    });
  });

  it('is not fresh when the client registered more than 10 minutes ago, or anyone consented', async () => {
    const { userId, cookie } = await signedIn();
    const old = await createTestClient(harness.db, {
      createdAt: new Date(Date.now() - 11 * 60_000),
    });
    expect(await readConsentRequest(await consentPage(old.clientId, cookie), userId)).toMatchObject(
      { request: { fresh: false } },
    );

    const known = await createTestClient(harness.db);
    const bob = await createTestSession(harness.db, 'Bob');
    await grantTestConsent(harness.db, {
      userId: bob.userId,
      clientId: known.clientId,
      scopes: ['read'],
    });
    expect(
      await readConsentRequest(await consentPage(known.clientId, cookie), userId),
    ).toMatchObject({ request: { fresh: false, previouslyAuthorizedAt: null } });
  });

  it('says when this user already authorized the client', async () => {
    const { userId, cookie } = await signedIn();
    const { clientId } = await createTestClient(harness.db);
    const at = new Date('2026-09-01T10:00:00.000Z');
    await grantTestConsent(harness.db, { userId, clientId, scopes: ['read'], at });
    // Asking for more than was granted brings the page back.
    const params = await consentPage(clientId, cookie, 'read write offline_access');
    expect(await readConsentRequest(params, userId)).toMatchObject({
      request: { previouslyAuthorizedAt: at },
    });
  });

  it('refuses a query whose signature does not hold', async () => {
    const { userId, cookie } = await signedIn();
    const { clientId } = await createTestClient(harness.db);
    const params = await consentPage(clientId, cookie);
    const tampered = new URLSearchParams(params);
    tampered.set('scope', 'read write offline_access openid');
    expect(await readConsentRequest(tampered, userId)).toEqual({ ok: false, reason: 'invalid' });
    const unsigned = new URLSearchParams(params);
    unsigned.delete('sig');
    expect(await readConsentRequest(unsigned, userId)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('refuses an expired query', async () => {
    const { userId, cookie } = await signedIn();
    const { clientId } = await createTestClient(harness.db);
    const params = await consentPage(clientId, cookie);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 11 * 60_000);
    expect(await readConsentRequest(params, userId)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('refuses a disabled client', async () => {
    const { userId, cookie } = await signedIn();
    const { clientId } = await createTestClient(harness.db);
    const params = await consentPage(clientId, cookie);
    await harness.db.update(oauthClient).set({ disabled: true });
    expect(await readConsentRequest(params, userId)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('says disabled while MCP is off', async () => {
    const { userId, cookie } = await signedIn();
    const { clientId } = await createTestClient(harness.db);
    const params = await consentPage(clientId, cookie);
    await harness.db
      .insert(serverSettings)
      .values({ key: 'mcp.enabled', value: false, updatedAt: new Date(), updatedBy: null });
    expect(await readConsentRequest(params, userId)).toEqual({ ok: false, reason: 'disabled' });
  });
});

describe('submitConsent', () => {
  it('accepting read only stores the consent and sends the browser on to a code', async () => {
    const { userId, cookie } = await signedIn();
    const { clientId } = await createTestClient(harness.db);
    const params = await consentPage(clientId, cookie);
    const { redirectTo } = await submitConsent({
      searchParams: params,
      userId,
      accept: true,
      scopes: ['read'],
    });
    expect(redirectTo.startsWith('/api/auth/oauth2/authorize?')).toBe(true);
    const forwarded = new URL(redirectTo, ORIGIN).searchParams;
    for (const name of ['sig', 'exp', 'ba_iat', 'ba_param', 'ba_pl'])
      expect(forwarded.has(name)).toBe(false);
    expect(forwarded.get('scope')).toBe('read offline_access');

    const [consent] = await harness.db
      .select()
      .from(oauthConsent)
      .where(eq(oauthConsent.userId, userId));
    expect(consent).toMatchObject({
      clientId,
      scopes: ['read', 'offline_access'],
      resources: [`${ORIGIN}/mcp`],
    });

    const back = await navigate(redirectTo, cookie);
    expect(`${back.origin}${back.pathname}`).toBe(TEST_REDIRECT);
    expect(back.searchParams.get('code')).toBeTruthy();
    expect(back.searchParams.get('state')).toBe('st-1');
    expect(back.searchParams.get('iss')).toBe(`${ORIGIN}/api/auth`);
  });

  it('is remembered: the same or fewer scopes skip the page, more bring it back', async () => {
    const { userId, cookie } = await signedIn();
    const { clientId } = await createTestClient(harness.db);
    const params = await consentPage(clientId, cookie, 'read offline_access');
    const { redirectTo } = await submitConsent({
      searchParams: params,
      userId,
      accept: true,
      scopes: ['read'],
    });
    await navigate(redirectTo, cookie);

    const again = await navigate(authorizeUrl(clientId, 'read offline_access'), cookie);
    expect(`${again.origin}${again.pathname}`).toBe(TEST_REDIRECT);
    const more = await navigate(authorizeUrl(clientId, 'read write offline_access'), cookie);
    expect(more.pathname).toBe('/oauth/consent');
  });

  it('a refusal goes back to the client with access_denied and stores nothing', async () => {
    const { userId, cookie } = await signedIn();
    const { clientId } = await createTestClient(harness.db);
    const params = await consentPage(clientId, cookie);
    const { redirectTo } = await submitConsent({
      searchParams: params,
      userId,
      accept: false,
      scopes: [],
    });
    const back = new URL(redirectTo);
    expect(`${back.origin}${back.pathname}`).toBe(TEST_REDIRECT);
    expect(back.searchParams.get('error')).toBe('access_denied');
    expect(back.searchParams.get('state')).toBe('st-1');
    expect(back.searchParams.get('iss')).toBe(`${ORIGIN}/api/auth`);
    expect(await harness.db.select().from(oauthConsent)).toEqual([]);
  });

  it('sends an invalid or switched-off request back to the consent page, writing nothing', async () => {
    const { userId, cookie } = await signedIn();
    const { clientId } = await createTestClient(harness.db);
    const params = await consentPage(clientId, cookie);
    const tampered = new URLSearchParams(params);
    tampered.set('client_id', 'someone-else');
    const { redirectTo } = await submitConsent({
      searchParams: tampered,
      userId,
      accept: true,
      scopes: ['read'],
    });
    expect(redirectTo).toBe(`/oauth/consent?${tampered.toString()}`);
    expect(await harness.db.select().from(oauthConsent)).toEqual([]);
  });
});
