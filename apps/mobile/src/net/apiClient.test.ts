import { z } from 'zod';
import { ApiClientError, createApiClient } from './apiClient';

const SERVER = 'https://saldo.example.com';
const schema = z.object({ ok: z.boolean() });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('createApiClient', () => {
  it('sends the session header and parses the body', async () => {
    const seen: Request[] = [];
    const client = createApiClient({
      serverUrl: SERVER,
      getAuthHeaders: async () => ({ cookie: 'better-auth.session_token=session-1' }),
      fetchImpl: async (request) => {
        seen.push(request);
        return json({ ok: true });
      },
    });

    await expect(client.get('/api/me', schema)).resolves.toEqual({ ok: true });
    expect(seen[0]?.headers.get('cookie')).toBe('better-auth.session_token=session-1');
    expect(seen[0]?.url).toBe(`${SERVER}/api/me`);
  });

  it('posts a json body', async () => {
    let body: string | null = null;
    const client = createApiClient({
      serverUrl: SERVER,
      getAuthHeaders: async () => ({ cookie: 'better-auth.session_token=session-1' }),
      fetchImpl: async (request) => {
        body = await request.text();
        return json({ ok: true });
      },
    });
    await client.post('/api/sync/push', { changes: [] }, schema);
    expect(body).toBe('{"changes":[]}');
  });

  it('reports a 401 as an expired session', async () => {
    let expired = 0;
    const client = createApiClient({
      serverUrl: SERVER,
      getAuthHeaders: async () => ({ cookie: 'better-auth.session_token=session-1' }),
      onSessionExpired: () => {
        expired += 1;
      },
      fetchImpl: async () => json({ error: { code: 'unauthorized', message: 'no' } }, 401),
    });
    // Better Auth renews sessions as they are used, so a 401 means the session is gone, not that
    // some second credential needs rotating.
    await expect(client.get('/api/me', schema)).rejects.toMatchObject({ code: 'session_expired' });
    expect(expired).toBe(1);
  });

  it('surfaces the server error code', async () => {
    const client = createApiClient({
      serverUrl: SERVER,
      getAuthHeaders: async () => ({ cookie: 'better-auth.session_token=session-1' }),
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
      getAuthHeaders: async () => null,
      fetchImpl: async () => json({ ok: true }),
    });
    await expect(client.get('/api/me', schema)).rejects.toBeInstanceOf(ApiClientError);
    await expect(client.hasSession()).resolves.toBe(false);
  });

  it('rejects a response that does not match its schema', async () => {
    const client = createApiClient({
      serverUrl: SERVER,
      getAuthHeaders: async () => ({ cookie: 'better-auth.session_token=session-1' }),
      fetchImpl: async () => json({ nonsense: true }),
    });
    await expect(client.get('/api/me', schema)).rejects.toMatchObject({ code: 'bad_response' });
  });
});
