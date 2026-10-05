import { SYNC_SCHEMA_VERSION } from '@saldo/core';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { dataEpochs, syncRows } from '../db/schema';
import { applyPush } from '../sync/push';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { createTestSession } from '../test/session';
import { readUserData } from '../userData/read';
import { lockOrder, WriteRefused, writeChanges, writeInTransaction } from './writeChanges';

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

  /*
   * A phone push landing between `build`'s read and the row locks. PGlite has one connection, so a
   * second transaction cannot run in between; the push is instead applied **inside** `build`, on
   * the same transaction, after the read — which leaves the row exactly as a concurrent push that
   * committed in that gap would. (The refusal then rolls the simulated push back with the rest:
   * that is the test's artefact, not the behaviour under test.)
   */
  it('refuses a write whose row changed after build read it', async () => {
    const { userId } = await createTestSession(harness.db);
    await writeChanges(harness.db, userId, [tag('t1', 'casa')], NOW);
    const refused = await writeInTransaction(harness.db, userId, NOW, async (tx) => {
      const [read] = (await readUserData(tx, userId)).tags;
      if (read === undefined) throw new Error('no tag');
      const phone = `${String(NOW.getTime() + 1000).padStart(15, '0')}-0000-phone`;
      const pushed = await applyPush(
        tx,
        userId,
        {
          schemaVersion: SYNC_SCHEMA_VERSION,
          deviceId: 'phone',
          changes: [
            {
              entity: 'tag',
              id: 't1',
              updatedAt: phone,
              deletedAt: null,
              data: { ...tag('t1', 'dal telefono').data, updatedAt: phone },
            },
          ],
        },
        NOW,
      );
      expect(pushed[0]?.status).toBe('applied');
      return { writes: [{ ...tag('t1', 'dal web'), basis: read.updatedAt }], result: undefined };
    }).catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(WriteRefused);
    expect((refused as WriteRefused).reason).toBe('conflict');
  });

  it('refuses to create a row that exists by the time it is locked', async () => {
    const { userId } = await createTestSession(harness.db);
    await writeChanges(harness.db, userId, [tag('t1', 'casa')], NOW);
    const refused = await writeInTransaction(harness.db, userId, NOW, async () => ({
      writes: [{ ...tag('t1', 'nuovo'), basis: null }],
      result: undefined,
    })).catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(WriteRefused);
    expect((refused as WriteRefused).reason).toBe('conflict');
    expect((await readUserData(harness.db, userId)).tags[0]?.name).toBe('casa');
  });
});

describe('lockOrder', () => {
  it('locks rows by entity, then id, whatever order the caller built them in', () => {
    const writes = [
      tag('t2', 'b'),
      { ...tag('a1', 'x'), entity: 'account' as const },
      tag('t1', 'a'),
    ];
    expect(lockOrder(writes).map((write) => `${write.entity}/${write.id}`)).toEqual([
      'account/a1',
      'tag/t1',
      'tag/t2',
    ]);
  });
});
