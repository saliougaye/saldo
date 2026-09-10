import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetRateLimits } from '../../../src/server/auth/rateLimit';
import { issueAccessToken, issueRefreshToken } from '../../../src/server/auth/tokens';
import { refreshTokens, users } from '../../../src/server/db/schema';
import { createTestDatabase, type TestDatabase } from '../../../src/server/test/harness';
import { POST as logout } from '../auth/logout/route';
import { GET } from './route';

let harness: TestDatabase;

function get(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/me', { headers });
}

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

describe('GET /api/me', () => {
  it('returns the bearer user', async () => {
    const [user] = await harness.db.insert(users).values({ displayName: 'Ada' }).returning();
    if (user === undefined) throw new Error('insert returned no row');
    const token = await issueAccessToken(user.id, new Date());
    const response = await GET(get({ authorization: `Bearer ${token}` }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ id: user.id, displayName: 'Ada' });
  });

  it('rejects a missing, malformed or unknown bearer', async () => {
    expect((await GET(get())).status).toBe(401);
    expect((await GET(get({ authorization: 'Basic abc' }))).status).toBe(401);
    expect((await GET(get({ authorization: 'Bearer nope' }))).status).toBe(401);
    // A well-signed token for a user that no longer exists is also 401.
    const orphan = await issueAccessToken('11111111-1111-4111-8111-111111111111', new Date());
    expect((await GET(get({ authorization: `Bearer ${orphan}` }))).status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('revokes the refresh token and answers 204', async () => {
    const [user] = await harness.db.insert(users).values({ displayName: 'Ada' }).returning();
    if (user === undefined) throw new Error('insert returned no row');
    const token = await issueRefreshToken(
      harness.db,
      { userId: user.id, deviceName: 'iPhone' },
      new Date(),
    );
    const response = await logout(
      new Request('http://localhost/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: token }),
        headers: { 'content-type': 'application/json' },
      }),
    );
    expect(response.status).toBe(204);
    const [row] = await harness.db.select().from(refreshTokens);
    expect(row?.revokedAt).not.toBeNull();
  });
});
