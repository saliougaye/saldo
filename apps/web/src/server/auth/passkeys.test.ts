import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { passkey } from '../db/schema';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { createTestSession } from '../test/session';
import { listPasskeysForUser } from './passkeys';

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

async function addPasskey(userId: string, id: string, over: Record<string, unknown> = {}) {
  await harness.db.insert(passkey).values({
    id,
    userId,
    name: null,
    publicKey: 'key',
    credentialID: `credential-${id}`,
    counter: 0,
    deviceType: 'singleDevice',
    backedUp: false,
    transports: 'internal',
    createdAt: new Date('2026-09-01T10:00:00.000Z'),
    aaguid: null,
    ...over,
  });
}

describe('listPasskeysForUser', () => {
  it('never returns somebody else’s', async () => {
    const mine = await createTestSession(harness.db, 'Ada');
    const theirs = await createTestSession(harness.db, 'Bob');
    await addPasskey(mine.userId, 'p1');
    await addPasskey(theirs.userId, 'p2');
    const rows = await listPasskeysForUser(harness.db, mine.userId);
    expect(rows.map((row) => row.id)).toEqual(['p1']);
  });
});
