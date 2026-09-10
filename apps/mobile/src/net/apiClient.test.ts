import { z } from 'zod';
import { createMemoryTokenStore, type Tokens } from '../auth/tokenStore';
import { ApiClientError, createApiClient } from './apiClient';

const SERVER = 'https://saldo.example.com';
const schema = z.object({ ok: z.boolean() });

function tokens(overrides: Partial<Tokens> = {}): Tokens {
  return {
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    expiresAt: Date.now() + 900_000,
    userId: 'user-1',
    displayName: 'Ada',
    ...overrides,
  };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const tokenPair = {
  access_token: 'access-2',
  refresh_token: 'refresh-2',
  expires_in: 900,
  user: { id: 'user-1', displayName: 'Ada' },
};

describe('createApiClient', () => {
  it('sends the bearer and parses the body', async () => {
    const store = createMemoryTokenStore();
    await store.save(SERVER, tokens());
    const seen: Request[] = [];
    const client = createApiClient({
      serverUrl: SERVER,
      store,
      fetchImpl: async (request) => {
        seen.push(request);
        return json({ ok: true });
      },
    });

    await expect(client.get('/api/me', schema)).resolves.toEqual({ ok: true });
    expect(seen[0]?.headers.get('authorization')).toBe('Bearer access-1');
    expect(seen[0]?.url).toBe(`${SERVER}/api/me`);
  });

  it('refreshes once on 401 and retries the call', async () => {
    const store = createMemoryTokenStore();
    await store.save(SERVER, tokens());
    const calls: string[] = [];
    const client = createApiClient({
      serverUrl: SERVER,
      store,
      fetchImpl: async (request) => {
        const path = new URL(request.url).pathname;
        calls.push(`${request.method} ${path}`);
        if (path === '/api/auth/token') return json(tokenPair);
        return request.headers.get('authorization') === 'Bearer access-2'
          ? json({ ok: true })
          : json({ error: { code: 'invalid_token', message: 'no' } }, 401);
      },
    });

    await expect(client.get('/api/me', schema)).resolves.toEqual({ ok: true });
    expect(calls).toEqual(['GET /api/me', 'POST /api/auth/token', 'GET /api/me']);
    await expect(store.load(SERVER)).resolves.toMatchObject({ accessToken: 'access-2' });
  });

  it('refreshes only once for concurrent calls', async () => {
    const store = createMemoryTokenStore();
    await store.save(SERVER, tokens());
    let refreshes = 0;
    const client = createApiClient({
      serverUrl: SERVER,
      store,
      fetchImpl: async (request) => {
        if (new URL(request.url).pathname === '/api/auth/token') {
          refreshes += 1;
          return json(tokenPair);
        }
        return request.headers.get('authorization') === 'Bearer access-2'
          ? json({ ok: true })
          : json({ error: { code: 'invalid_token', message: 'no' } }, 401);
      },
    });

    await Promise.all([client.get('/api/me', schema), client.get('/api/health', schema)]);
    // The server revokes a refresh chain when a token is presented twice, so two parallel
    // refreshes would sign the device out. One shared attempt is not an optimisation.
    expect(refreshes).toBe(1);
  });

  it('reports a session expiry when the refresh itself fails', async () => {
    const store = createMemoryTokenStore();
    await store.save(SERVER, tokens());
    let expired = 0;
    const client = createApiClient({
      serverUrl: SERVER,
      store,
      onSessionExpired: () => {
        expired += 1;
      },
      fetchImpl: async (request) =>
        new URL(request.url).pathname === '/api/auth/token'
          ? json({ error: { code: 'invalid_grant', message: 'no' } }, 401)
          : json({ error: { code: 'invalid_token', message: 'no' } }, 401),
    });

    await expect(client.get('/api/me', schema)).rejects.toBeInstanceOf(ApiClientError);
    expect(expired).toBe(1);
    await expect(store.load(SERVER)).resolves.toBeNull();
  });

  it('surfaces the server error code', async () => {
    const store = createMemoryTokenStore();
    await store.save(SERVER, tokens());
    const client = createApiClient({
      serverUrl: SERVER,
      store,
      fetchImpl: async () => json({ error: { code: 'schema_too_old', message: 'update' } }, 409),
    });
    await expect(client.get('/api/me', schema)).rejects.toMatchObject({
      code: 'schema_too_old',
      status: 409,
    });
  });

  it('fails closed when there is no session', async () => {
    const client = createApiClient({
      serverUrl: SERVER,
      store: createMemoryTokenStore(),
      fetchImpl: async () => json({ ok: true }),
    });
    await expect(client.get('/api/me', schema)).rejects.toMatchObject({ code: 'no_session' });
  });
});
