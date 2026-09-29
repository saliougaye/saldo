import { and, eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { dataEpochs, serverClock, syncRows } from '../db/schema';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { createTestSession } from '../test/session';
import { readUserData } from '../userData/read';
import { WriteRefused, writeChanges, writeInTransaction } from './writeChanges';

let harness: TestDatabase;
const NOW = new Date('2026-09-29T10:00:00.000Z');

const tag = (id: string, name: string, deletedAt: string | null = null) => ({
  entity: 'tag' as const,
  id,
  data: { id, name, createdAt: '2026-09-29T09:00:00.000Z', deletedAt },
});

beforeAll(async () => {
  harness = await createTestDatabase();
});
afterEach(async () => {
  await harness.reset();
});
afterAll(async () => {
  await harness.close();
});

describe('writeChanges', () => {
  it('writes rows the projection then reads, each with a seq', async () => {
    const { userId } = await createTestSession(harness.db);
    await writeChanges(harness.db, userId, [tag('t1', 'casa'), tag('t2', 'lavoro')], NOW);
    const data = await readUserData(harness.db, userId);
    expect(data.tags.map((row) => row.name).sort()).toEqual(['casa', 'lavoro']);
    const rows = await harness.db.select().from(syncRows).where(eq(syncRows.userId, userId));
    expect(
      rows.every(
        (row) => row.seq > 0 && row.updatedAt === (row.data as { updatedAt: string }).updatedAt,
      ),
    ).toBe(true);
  });

  it('wins over a row a phone stamped an hour ahead of the server', async () => {
    const { userId } = await createTestSession(harness.db);
    const ahead = `${String(NOW.getTime() + 3_600_000).padStart(15, '0')}-0000-phone`;
    await harness.db.insert(syncRows).values({
      userId,
      entity: 'tag',
      id: 't1',
      updatedAt: ahead,
      deletedAt: null,
      data: {
        id: 't1',
        name: 'vecchio',
        createdAt: '2026-09-29T09:00:00.000Z',
        updatedAt: ahead,
        deletedAt: null,
      },
      seq: 1,
    });
    await writeChanges(harness.db, userId, [tag('t1', 'nuovo')], NOW);
    const data = await readUserData(harness.db, userId);
    expect(data.tags[0]?.name).toBe('nuovo');
  });

  it('writes a tombstone as a tombstone', async () => {
    const { userId } = await createTestSession(harness.db);
    await writeChanges(harness.db, userId, [tag('t1', 'casa')], NOW);
    await writeChanges(harness.db, userId, [tag('t1', 'casa', NOW.toISOString())], NOW);
    expect((await readUserData(harness.db, userId)).tags).toEqual([]);
    const [row] = await harness.db
      .select()
      .from(syncRows)
      .where(and(eq(syncRows.userId, userId), eq(syncRows.id, 't1')));
    expect(row?.deletedAt).not.toBeNull();
  });

  it('refuses a row its schema refuses, and writes none of the batch', async () => {
    const { userId } = await createTestSession(harness.db);
    await expect(
      writeChanges(harness.db, userId, [tag('t1', 'casa'), tag('t2', '')], NOW),
    ).rejects.toBeInstanceOf(WriteRefused);
    expect((await readUserData(harness.db, userId)).tags).toEqual([]);
  });

  it('takes the epoch lock the push takes', async () => {
    const { userId } = await createTestSession(harness.db);
    await writeChanges(harness.db, userId, [tag('t1', 'casa')], NOW);
    const [epoch] = await harness.db.select().from(dataEpochs).where(eq(dataEpochs.userId, userId));
    expect(epoch?.epoch).toBe(0);
  });
});

describe('writeInTransaction', () => {
  it('applies the writes build returns, and returns its result', async () => {
    const { userId } = await createTestSession(harness.db);
    const result = await writeInTransaction(harness.db, userId, NOW, async () => ({
      writes: [tag('t1', 'casa')],
      result: 'the id',
    }));
    expect(result).toBe('the id');
    const data = await readUserData(harness.db, userId);
    expect(data.tags.map((row) => row.name)).toEqual(['casa']);
  });

  it('writes nothing, and does not touch the clock, when build decides not to write', async () => {
    const { userId } = await createTestSession(harness.db);
    const result = await writeInTransaction(harness.db, userId, NOW, async () => ({
      writes: [],
      result: 'nothing to do',
    }));
    expect(result).toBe('nothing to do');
    expect((await readUserData(harness.db, userId)).tags).toEqual([]);
    expect(await harness.db.select().from(serverClock)).toEqual([]);
  });

  it('lets build read the account’s data on the same transaction, after the epoch lock', async () => {
    const { userId } = await createTestSession(harness.db);
    await writeChanges(harness.db, userId, [tag('t1', 'casa')], NOW);
    const seenNames = await writeInTransaction(harness.db, userId, NOW, async (tx) => {
      const data = await readUserData(tx, userId);
      return { writes: [], result: data.tags.map((row) => row.name) };
    });
    expect(seenNames).toEqual(['casa']);
  });

  it('rolls back build’s writes if a later one in the batch is refused', async () => {
    const { userId } = await createTestSession(harness.db);
    await expect(
      writeInTransaction(harness.db, userId, NOW, async () => ({
        writes: [tag('t1', 'casa'), tag('t2', '')],
        result: undefined,
      })),
    ).rejects.toBeInstanceOf(WriteRefused);
    expect((await readUserData(harness.db, userId)).tags).toEqual([]);
  });
});
