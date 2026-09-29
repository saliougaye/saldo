import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { authenticate } from '../../../../src/server/auth/session';
import { createTestDatabase, type TestDatabase } from '../../../../src/server/test/harness';
import { createTestSession } from '../../../../src/server/test/session';
import { GET } from './route';

let harness: TestDatabase;

beforeAll(async () => {
  harness = await createTestDatabase();
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await harness.reset();
});
afterAll(async () => {
  await harness.close();
});

const get = (query: string) => GET(new Request(`http://localhost:3000/api/dev/sign-in${query}`));

describe('GET /api/dev/sign-in (temporary, removed in 0.3e-3)', () => {
  it('does not exist in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SALDO_DEV_SIGN_IN', '1');
    expect((await get('')).status).toBe(404);
  });

  it('does not exist in dev or test without the SALDO_DEV_SIGN_IN flag', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('SALDO_DEV_SIGN_IN', '');
    expect((await get('')).status).toBe(404);
  });

  it('signs a browser in as an existing user with a cookie Better Auth accepts', async () => {
    vi.stubEnv('SALDO_DEV_SIGN_IN', '1');
    const { userId } = await createTestSession(harness.db, 'Ada');
    const response = await get('');
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('http://localhost:3000/home');
    const cookie = (response.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
    const user = await authenticate(new Headers({ cookie }));
    expect(user?.id).toBe(userId);
  });

  it('answers only a request made to the loopback host', async () => {
    vi.stubEnv('SALDO_DEV_SIGN_IN', '1');
    await createTestSession(harness.db, 'Ada');
    const at = (url: string, headers: Record<string, string> = {}) =>
      GET(new Request(url, { headers }));
    expect((await at('http://saldo.example.com/api/dev/sign-in')).status).toBe(404);
    expect((await at('http://192.168.1.20:3000/api/dev/sign-in')).status).toBe(404);
    expect(
      (await at('http://localhost:3000/api/dev/sign-in', { host: 'saldo.example.com' })).status,
    ).toBe(404);
    expect((await at('http://127.0.0.1:3000/api/dev/sign-in')).status).toBe(303);
    expect((await at('http://[::1]:3000/api/dev/sign-in')).status).toBe(303);
  });

  it('answers 404 for an email nobody has', async () => {
    vi.stubEnv('SALDO_DEV_SIGN_IN', '1');
    await createTestSession(harness.db, 'Ada');
    expect((await get('?email=nobody%40example.com')).status).toBe(404);
  });
});
