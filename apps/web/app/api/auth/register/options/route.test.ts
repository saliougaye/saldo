import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetRateLimits } from '../../../../../src/server/auth/rateLimit';
import { users, webauthnChallenges } from '../../../../../src/server/db/schema';
import { createTestDatabase, type TestDatabase } from '../../../../../src/server/test/harness';

vi.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: vi.fn(async () => ({
    challenge: 'generated-challenge',
    rp: { id: 'localhost', name: 'Saldo test' },
    user: { id: 'dXNlcg', name: 'Ada', displayName: 'Ada' },
    pubKeyCredParams: [],
  })),
  generateAuthenticationOptions: vi.fn(),
  verifyRegistrationResponse: vi.fn(),
  verifyAuthenticationResponse: vi.fn(),
}));

const { POST } = await import('./route');

let harness: TestDatabase;

beforeAll(async () => {
  harness = await createTestDatabase();
});

beforeEach(() => {
  resetRateLimits();
});

afterEach(async () => {
  await harness.reset();
});

afterAll(async () => {
  await harness.close();
});

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/auth/register/options', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', ...headers },
  });
}

describe('POST /api/auth/register/options', () => {
  it('returns options and records the challenge with the pending display name', async () => {
    const response = await POST(post({ displayName: 'Ada' }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ challenge: 'generated-challenge' });

    const rows = await harness.db.select().from(webauthnChallenges);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      challenge: 'generated-challenge',
      kind: 'register',
      displayName: 'Ada',
    });
  });

  it('rejects an empty display name', async () => {
    const response = await POST(post({ displayName: '   ' }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'invalid_body' } });
  });

  it('rate limits after ten attempts from one address', async () => {
    for (let i = 0; i < 10; i += 1) {
      const ok = await POST(post({ displayName: 'Ada' }, { 'x-forwarded-for': '9.9.9.9' }));
      expect(ok.status).toBe(200);
    }
    const limited = await POST(post({ displayName: 'Ada' }, { 'x-forwarded-for': '9.9.9.9' }));
    expect(limited.status).toBe(429);
  });

  it('refuses when registration is closed', async () => {
    const { resetEnvCache } = await import('../../../../../src/server/env');
    vi.stubEnv('REGISTRATION', 'closed');
    resetEnvCache();
    try {
      const response = await POST(post({ displayName: 'Ada' }));
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: 'registration_closed' },
      });
    } finally {
      vi.unstubAllEnvs();
      resetEnvCache();
      await harness.db.delete(users);
    }
  });
});
