import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { revokeUser } from '../auth/admin';
import { oauthAccessToken, oauthClient } from '../db/schema';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { createTestClient, issueTestAccessToken } from '../test/oauth';
import { createTestSession } from '../test/session';
import { type AccessTokenRow, acceptAccessToken, verifyMcpRequest } from './token';

const RESOURCE = 'http://localhost:3000/mcp';
const NOW = new Date('2026-10-03T09:00:00.000Z');
const CHALLENGE =
  'Bearer resource_metadata="http://localhost:3000/.well-known/oauth-protected-resource"';

const row = (overrides: Partial<AccessTokenRow> = {}): AccessTokenRow => ({
  userId: 'u-1',
  clientId: 'c-1',
  scopes: ['read', 'offline_access'],
  resources: [RESOURCE],
  expiresAt: new Date(NOW.getTime() + 60_000),
  revoked: null,
  clientDisabled: false,
  banned: false,
  ...overrides,
});

describe('acceptAccessToken', () => {
  it('accepts a live token bound to /mcp, keeping only the tool scopes', () => {
    expect(acceptAccessToken(row(), NOW, RESOURCE)).toEqual({
      ok: true,
      principal: { userId: 'u-1', clientId: 'c-1', scopes: ['read'] },
    });
    expect(acceptAccessToken(row({ scopes: ['read', 'write'] }), NOW, RESOURCE)).toMatchObject({
      principal: { scopes: ['read', 'write'] },
    });
  });

  it.each<[string, AccessTokenRow | null]>([
    ['unknown', null],
    ['revoked', row({ revoked: NOW })],
    ['expired', row({ expiresAt: NOW })],
    ['bound to another resource', row({ resources: ['https://elsewhere.example/mcp'] })],
    ['bound to nothing', row({ resources: null })],
    ['of a disabled client', row({ clientDisabled: true })],
    ['of a revoked account', row({ banned: true })],
  ])('refuses a token that is %s', (_label, candidate) => {
    expect(acceptAccessToken(candidate, NOW, RESOURCE)).toEqual({ ok: false });
  });
});

describe('verifyMcpRequest', () => {
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

  const post = (headers: Record<string, string> = {}, url = RESOURCE) =>
    new Request(url, { method: 'POST', headers });

  it('answers 401 with the bare challenge when there is no token', async () => {
    const result = await verifyMcpRequest(post());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(401);
    expect(result.response.headers.get('www-authenticate')).toBe(CHALLENGE);
  });

  it('refuses a token in the query string', async () => {
    const result = await verifyMcpRequest(post({}, `${RESOURCE}?access_token=abc`));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(400);
    expect(await result.response.json()).toMatchObject({ error: 'invalid_request' });
  });

  it('answers 401 invalid_token for a token it does not know', async () => {
    const result = await verifyMcpRequest(post({ authorization: 'Bearer nope' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(401);
    expect(result.response.headers.get('www-authenticate')).toBe(
      'Bearer error="invalid_token", resource_metadata="http://localhost:3000/.well-known/oauth-protected-resource"',
    );
  });

  it('resolves a stored token to its user, client and tool scopes', async () => {
    const { userId } = await createTestSession(harness.db);
    const { clientId } = await createTestClient(harness.db);
    const { bearer } = await issueTestAccessToken(harness.db, {
      userId,
      clientId,
      scopes: ['read', 'write', 'offline_access'],
    });
    expect(await verifyMcpRequest(post({ authorization: bearer }))).toEqual({
      ok: true,
      principal: { userId, clientId, scopes: ['read', 'write'] },
    });
  });

  it('stops accepting it once deleted, once the client is disabled, once the account is revoked', async () => {
    const { userId } = await createTestSession(harness.db);
    const { clientId } = await createTestClient(harness.db);
    const first = await issueTestAccessToken(harness.db, { userId, clientId });
    await harness.db.delete(oauthAccessToken);
    expect((await verifyMcpRequest(post({ authorization: first.bearer }))).ok).toBe(false);

    const second = await issueTestAccessToken(harness.db, { userId, clientId });
    await harness.db.update(oauthClient).set({ disabled: true });
    expect((await verifyMcpRequest(post({ authorization: second.bearer }))).ok).toBe(false);
    await harness.db.update(oauthClient).set({ disabled: false });

    await revokeUser(harness.db, userId, null, new Date());
    expect((await verifyMcpRequest(post({ authorization: second.bearer }))).ok).toBe(false);
  });
});
