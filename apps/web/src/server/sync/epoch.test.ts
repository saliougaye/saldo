import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { drainDeletedBlobs } from '../attachments/cleanup';
import { deletedBlobs, syncRows } from '../db/schema';
import { ApiError } from '../http/errors';
import { createFsStore } from '../storage/fsStore';
import { objectKey } from '../storage/types';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { createTestSession } from '../test/session';
import { assertEpoch, deleteAccountData, lockEpoch, readEpoch } from './epoch';

let harness: TestDatabase;
let dir: string;
let userId: string;

const NOW = new Date('2026-09-17T10:00:00.000Z');
const BYTES = new Uint8Array([1, 2, 3]);

async function insertRow(owner: string, entity: string, id: string): Promise<void> {
  await harness.db.insert(syncRows).values({
    userId: owner,
    entity,
    id,
    updatedAt: '001775000000000-0000-device-a',
    deletedAt: null,
    data: { id },
    seq: 1,
  });
}

beforeAll(async () => {
  harness = await createTestDatabase();
});

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'saldo-epoch-'));
  userId = (await createTestSession(harness.db)).userId;
});

afterEach(async () => {
  await harness.reset();
  await rm(dir, { recursive: true, force: true });
});

afterAll(async () => {
  await harness.close();
});

describe('readEpoch', () => {
  it('is 0 for an account whose data was never deleted', async () => {
    expect(await readEpoch(harness.db, userId)).toBe(0);
  });
});

describe('lockEpoch', () => {
  it('answers the current epoch inside a transaction, creating the row it locks', async () => {
    const epoch = await harness.db.transaction((tx) => lockEpoch(tx, userId));
    expect(epoch).toBe(0);
    await deleteAccountData(harness.db, userId, NOW);
    expect(await harness.db.transaction((tx) => lockEpoch(tx, userId))).toBe(1);
  });
});

describe('assertEpoch', () => {
  it('lets through a device on the current generation, or one that does not say', () => {
    expect(() => assertEpoch(2, 2)).not.toThrow();
    expect(() => assertEpoch(undefined, 2)).not.toThrow();
  });

  it('refuses a device on an earlier generation with 409 data_reset', () => {
    try {
      assertEpoch(1, 2);
      expect.unreachable('assertEpoch should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ status: 409, code: 'data_reset' });
    }
  });
});

describe('deleteAccountData', () => {
  it("deletes the account's rows, and nobody else's", async () => {
    const other = (await createTestSession(harness.db, 'Bob')).userId;
    await insertRow(userId, 'tag', 'tag-1');
    await insertRow(userId, 'transaction', 'tx-1');
    await insertRow(other, 'tag', 'tag-2');

    await deleteAccountData(harness.db, userId, NOW);

    expect(await harness.db.select().from(syncRows).where(eq(syncRows.userId, userId))).toEqual([]);
    expect(await harness.db.select().from(syncRows).where(eq(syncRows.userId, other))).toHaveLength(
      1,
    );
  });

  it('moves the epoch up by one each time', async () => {
    expect(await deleteAccountData(harness.db, userId, NOW)).toBe(1);
    expect(await deleteAccountData(harness.db, userId, NOW)).toBe(2);
    expect(await readEpoch(harness.db, userId)).toBe(2);
  });

  it('queues the attachment bytes so the next drain deletes them', async () => {
    const store = createFsStore(dir);
    const meta = { size: BYTES.byteLength, mimeType: 'image/jpeg' };
    await store.put(objectKey(userId, 'att-1'), BYTES, meta);
    await insertRow(userId, 'attachment', 'att-1');
    await insertRow(userId, 'tag', 'tag-1');

    await deleteAccountData(harness.db, userId, NOW);

    const queued = await harness.db.select().from(deletedBlobs);
    expect(queued.map((row) => row.attachmentId)).toEqual(['att-1']);
    // No grace period: the rows are gone everywhere, so no device can still need the bytes.
    expect(await drainDeletedBlobs(harness.db, store, NOW)).toBe(1);
    expect(await store.head(objectKey(userId, 'att-1'))).toBeNull();
  });
});
