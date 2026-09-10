import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { auth } from '../../../src/server/auth/auth';
import { createTestDatabase, type TestDatabase } from '../../../src/server/test/harness';
import { createTestSession } from '../../../src/server/test/session';

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

/** The browser's session, expressed the way the bearer plugin reads it. */
function asSession(bearer: string): Headers {
  return new Headers({ authorization: bearer });
}

describe('the browser to app handoff', () => {
  it('mints a token for the ceremony session and exchanges it for that same user', async () => {
    const { userId, bearer } = await createTestSession(harness.db, 'Ada');
    const { token } = await auth().api.generateOneTimeToken({ headers: asSession(bearer) });
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);

    const verified = await auth().api.verifyOneTimeToken({ body: { token } });
    expect(verified.user.id).toBe(userId);
    expect(verified.user.name).toBe('Ada');
  });

  it('is single use: the second exchange fails', async () => {
    const { bearer } = await createTestSession(harness.db);
    const { token } = await auth().api.generateOneTimeToken({ headers: asSession(bearer) });
    await auth().api.verifyOneTimeToken({ body: { token } });
    // Whoever else read the deep link gets nothing.
    await expect(auth().api.verifyOneTimeToken({ body: { token } })).rejects.toBeTruthy();
  });

  it('refuses a token nobody minted', async () => {
    await createTestSession(harness.db);
    await expect(
      auth().api.verifyOneTimeToken({ body: { token: 'not-a-token' } }),
    ).rejects.toBeTruthy();
  });

  it('cannot be minted without a session', async () => {
    await expect(auth().api.generateOneTimeToken({ headers: new Headers() })).rejects.toBeTruthy();
  });

  it('stores the token hashed, so a database reader cannot replay it', async () => {
    const { bearer } = await createTestSession(harness.db);
    const { token } = await auth().api.generateOneTimeToken({ headers: asSession(bearer) });
    const { verification } = await import('../../../src/server/db/schema');
    const rows = await harness.db.select().from(verification);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((row) => row.value === token || row.identifier.includes(token))).toBe(false);
  });
});
