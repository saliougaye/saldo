import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { syncRows } from '../db/schema';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { createTestSession } from '../test/session';
import { readPull } from './pull';

let harness: TestDatabase;

async function seedUser(name: string): Promise<string> {
  return (await createTestSession(harness.db, name)).userId;
}

async function seedRow(userId: string, id: string, seq: number): Promise<void> {
  await harness.db.insert(syncRows).values({
    userId,
    entity: 'tag',
    id,
    updatedAt: `00177500000000${seq}-0000-device-a`,
    deletedAt: null,
    data: { id, name: id },
    seq,
  });
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

describe('readPull', () => {
  it('returns rows after the cursor, in seq order, and reports the next cursor', async () => {
    const userId = await seedUser('Ada');
    for (const seq of [1, 2, 3]) await seedRow(userId, `tag-${seq}`, seq);

    const page = await readPull(harness.db, userId, { since: 0, limit: 500 });
    expect(page.changes.map((change) => change.seq)).toEqual([1, 2, 3]);
    expect(page.nextSince).toBe(3);
    expect(page.hasMore).toBe(false);

    const empty = await readPull(harness.db, userId, { since: 3, limit: 500 });
    expect(empty.changes).toEqual([]);
    expect(empty.nextSince).toBe(3);
  });

  it('pages, and says so', async () => {
    const userId = await seedUser('Ada');
    for (const seq of [1, 2, 3, 4, 5]) await seedRow(userId, `tag-${seq}`, seq);

    const first = await readPull(harness.db, userId, { since: 0, limit: 2 });
    expect(first.changes.map((change) => change.id)).toEqual(['tag-1', 'tag-2']);
    expect(first).toMatchObject({ nextSince: 2, hasMore: true });

    const second = await readPull(harness.db, userId, { since: first.nextSince, limit: 2 });
    expect(second.changes.map((change) => change.id)).toEqual(['tag-3', 'tag-4']);
    expect(second.hasMore).toBe(true);

    const third = await readPull(harness.db, userId, { since: second.nextSince, limit: 2 });
    expect(third.changes.map((change) => change.id)).toEqual(['tag-5']);
    expect(third.hasMore).toBe(false);
  });

  it("never returns another user's rows", async () => {
    const ada = await seedUser('Ada');
    const bob = await seedUser('Bob');
    await seedRow(ada, 'tag-ada', 1);
    await seedRow(bob, 'tag-bob', 2);

    const page = await readPull(harness.db, ada, { since: 0, limit: 500 });
    expect(page.changes.map((change) => change.id)).toEqual(['tag-ada']);
  });

  it('serialises a tombstone as an ISO string', async () => {
    const userId = await seedUser('Ada');
    await harness.db.insert(syncRows).values({
      userId,
      entity: 'tag',
      id: 'tag-1',
      updatedAt: '001775000000000-0000-device-a',
      deletedAt: new Date('2026-09-10T10:00:00.000Z'),
      data: { id: 'tag-1', name: 'Gone' },
      seq: 1,
    });
    const page = await readPull(harness.db, userId, { since: 0, limit: 500 });
    expect(page.changes[0]?.deletedAt).toBe('2026-09-10T10:00:00.000Z');
  });
});
