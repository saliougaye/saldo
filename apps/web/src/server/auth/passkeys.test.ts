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
  it('is empty for an account with none', async () => {
    const session = await createTestSession(harness.db, 'Ada');
    expect(await listPasskeysForUser(harness.db, session.userId)).toEqual([]);
  });

  it('returns what the page shows, and nothing secret', async () => {
    const session = await createTestSession(harness.db, 'Ada');
    await addPasskey(session.userId, 'p1', {
      name: 'MacBook',
      backedUp: true,
      aaguid: 'FBFC3007-154E-4ECC-8C0B-6E020557D7BD',
    });
    const [row] = await listPasskeysForUser(harness.db, session.userId);
    expect(row).toEqual({
      id: 'p1',
      name: 'MacBook',
      credentialId: 'credential-p1',
      aaguid: 'FBFC3007-154E-4ECC-8C0B-6E020557D7BD',
      backedUp: true,
      createdAt: '2026-09-01T10:00:00.000Z',
    });
    expect(JSON.stringify(row)).not.toContain('key');
  });

  it('never returns somebody else’s', async () => {
    const mine = await createTestSession(harness.db, 'Ada');
    const theirs = await createTestSession(harness.db, 'Bob');
    await addPasskey(mine.userId, 'p1');
    await addPasskey(theirs.userId, 'p2');
    const rows = await listPasskeysForUser(harness.db, mine.userId);
    expect(rows.map((row) => row.id)).toEqual(['p1']);
  });
});
