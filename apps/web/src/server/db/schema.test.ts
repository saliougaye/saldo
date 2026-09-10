import { and, eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { createTestSession } from '../test/session';
import { syncRows } from './schema';

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

describe('schema', () => {
  it('round-trips a sync row, keeping its json body and its tombstone', async () => {
    const { db } = harness;
    const { userId } = await createTestSession(db);
    await db.insert(syncRows).values({
      userId,
      entity: 'tag',
      id: 'tag-1',
      updatedAt: '001775000000000-0000-device-a',
      deletedAt: new Date('2026-09-10T10:00:00.000Z'),
      data: { id: 'tag-1', name: 'Trasloco', tagIds: ['a', 'b'] },
      seq: 1,
    });

    const [row] = await db
      .select()
      .from(syncRows)
      .where(and(eq(syncRows.userId, userId), eq(syncRows.id, 'tag-1')));
    expect(row?.data).toEqual({ id: 'tag-1', name: 'Trasloco', tagIds: ['a', 'b'] });
    expect(row?.deletedAt?.toISOString()).toBe('2026-09-10T10:00:00.000Z');
    expect(row?.seq).toBe(1);
  });

  it('scopes a row to its user through the composite primary key', async () => {
    const { db } = harness;
    const ada = await createTestSession(db, 'Ada');
    const bob = await createTestSession(db, 'Bob');
    for (const owner of [ada, bob]) {
      await db.insert(syncRows).values({
        userId: owner.userId,
        entity: 'tag',
        id: 'tag-1',
        updatedAt: '001775000000000-0000-device-a',
        deletedAt: null,
        data: { id: 'tag-1', name: owner.userId },
        seq: 1,
      });
    }
    const rows = await db.select().from(syncRows).where(eq(syncRows.id, 'tag-1'));
    // Same row id, two owners, no collision: the key is (user_id, entity, id).
    expect(rows).toHaveLength(2);
  });
});
