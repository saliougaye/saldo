import { SYNC_SCHEMA_VERSION } from '@saldo/core';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { revokeUser } from '../../src/server/auth/admin';
import { createTestDatabase, type TestDatabase } from '../../src/server/test/harness';
import { createTestSession } from '../../src/server/test/session';
import { GET as me } from './me/route';
import { POST as push } from './sync/push/route';

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

function pushRequest(bearer: string): Request {
  return new Request('http://localhost/api/sync/push', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: bearer },
    body: JSON.stringify({
      schemaVersion: SYNC_SCHEMA_VERSION,
      deviceId: 'device-a',
      changes: [],
    }),
  });
}

describe('a revoked account', () => {
  it('loses its bearer and stops syncing, in the same breath', async () => {
    const bob = await createTestSession(harness.db, 'Bob', 'user');
    // Before: the account works.
    expect(
      (await me(new Request('http://localhost/api/me', { headers: { authorization: bob.bearer } })))
        .status,
    ).toBe(200);
    expect((await push(pushRequest(bob.bearer))).status).toBe(200);

    await revokeUser(harness.db, bob.userId, 'no longer in the household', new Date());

    // After: the same bearer is refused, and so is every attempt to exchange a row with it.
    expect(
      (await me(new Request('http://localhost/api/me', { headers: { authorization: bob.bearer } })))
        .status,
    ).toBe(401);
    expect((await push(pushRequest(bob.bearer))).status).toBe(401);
  });

  it("does not take anybody else's access with it", async () => {
    const ada = await createTestSession(harness.db, 'Ada', 'user');
    const bob = await createTestSession(harness.db, 'Bob', 'user');
    await revokeUser(harness.db, bob.userId, null, new Date());
    expect(
      (await me(new Request('http://localhost/api/me', { headers: { authorization: ada.bearer } })))
        .status,
    ).toBe(200);
  });
});
