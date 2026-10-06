import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../../../src/server/test/harness';
import { createTestSession } from '../../../src/server/test/session';
import { GET } from './route';

let harness: TestDatabase;

function get(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/me', { headers });
}

beforeAll(async () => {
  harness = await createTestDatabase();
});

afterEach(async () => {
  await harness.reset();
});

afterAll(async () => {
  await harness.close();
});

describe('GET /api/me', () => {
  it('rejects a missing, malformed or unknown bearer', async () => {
    expect((await GET(get())).status).toBe(401);
    expect((await GET(get({ authorization: 'Basic abc' }))).status).toBe(401);
    expect((await GET(get({ authorization: 'Bearer nope' }))).status).toBe(401);
  });

  it('rejects a token whose session has expired', async () => {
    const { bearer } = await createTestSession(harness.db);
    // Better Auth owns expiry; this proves the route trusts it rather than keeping its own clock.
    const { session } = await import('../../../src/server/db/schema');
    const { eq } = await import('drizzle-orm');
    await harness.db
      .update(session)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(session.token, bearer.replace('Bearer ', '')));
    expect((await GET(get({ authorization: bearer }))).status).toBe(401);
  });

  it('answers with the account, its email and whether the email is verified', async () => {
    const session = await createTestSession(harness.db, 'Ada');
    const response = await GET(
      new Request('http://localhost/api/me', { headers: { authorization: session.bearer } }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: session.userId,
      displayName: 'Ada',
      email: `${session.userId}@passkey.saldo.invalid`,
      emailVerified: false,
    });
  });
});
