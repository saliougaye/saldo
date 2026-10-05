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
});
