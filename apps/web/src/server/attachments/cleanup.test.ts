import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SyncChangeEnvelope } from '@saldo/core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { deletedBlobs } from '../db/schema';
import { createFsStore } from '../storage/fsStore';
import { objectKey } from '../storage/types';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { createTestSession } from '../test/session';
import { BLOB_GRACE_DAYS, drainDeletedBlobs, enqueueDeletedBlobs } from './cleanup';

let harness: TestDatabase;
let dir: string;
let userId: string;

const NOW = new Date('2026-09-11T10:00:00.000Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
const BYTES = new Uint8Array([1, 2, 3]);

function tombstone(id: string): SyncChangeEnvelope {
  return {
    entity: 'attachment',
    id,
    updatedAt: '000000000000001-0000-dev',
    deletedAt: '2026-09-01T10:00:00.000Z',
    data: {},
  };
}

function live(id: string): SyncChangeEnvelope {
  return { ...tombstone(id), deletedAt: null };
}

beforeAll(async () => {
  harness = await createTestDatabase();
});

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'saldo-cleanup-'));
  userId = (await createTestSession(harness.db)).userId;
});

afterEach(async () => {
  await harness.reset();
  await rm(dir, { recursive: true, force: true });
});

afterAll(async () => {
  await harness.close();
});

describe('enqueueDeletedBlobs', () => {
  it('queues the attachments a push tombstoned, and nothing else', async () => {
    await enqueueDeletedBlobs(
      harness.db,
      userId,
      [tombstone('att-1'), live('att-2'), { ...tombstone('tag-1'), entity: 'tag' }],
      NOW,
    );
    const rows = await harness.db.select().from(deletedBlobs);
    expect(rows.map((row) => row.attachmentId)).toEqual(['att-1']);
  });

  it('keeps the first timestamp when the same deletion arrives twice', async () => {
    await enqueueDeletedBlobs(harness.db, userId, [tombstone('att-1')], daysAgo(3));
    await enqueueDeletedBlobs(harness.db, userId, [tombstone('att-1')], NOW);
    const rows = await harness.db.select().from(deletedBlobs);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tombstonedAt).toEqual(daysAgo(3));
  });

  it('writes nothing when a push tombstoned no attachment', async () => {
    await enqueueDeletedBlobs(harness.db, userId, [live('att-1')], NOW);
    expect(await harness.db.select().from(deletedBlobs)).toEqual([]);
  });
});

describe('drainDeletedBlobs', () => {
  const meta = { size: BYTES.byteLength, mimeType: 'image/jpeg' };

  it('leaves a blob alone until the grace period is over', async () => {
    const store = createFsStore(dir);
    await store.put(objectKey(userId, 'att-1'), BYTES, meta);
    await enqueueDeletedBlobs(harness.db, userId, [tombstone('att-1')], daysAgo(1));

    expect(await drainDeletedBlobs(harness.db, store, NOW)).toBe(0);
    expect(await store.head(objectKey(userId, 'att-1'))).toBe(BYTES.byteLength);
  });

  it('deletes the bytes once it is, and forgets the row', async () => {
    const store = createFsStore(dir);
    await store.put(objectKey(userId, 'att-1'), BYTES, meta);
    await enqueueDeletedBlobs(
      harness.db,
      userId,
      [tombstone('att-1')],
      daysAgo(BLOB_GRACE_DAYS + 1),
    );

    expect(await drainDeletedBlobs(harness.db, store, NOW)).toBe(1);
    expect(await store.head(objectKey(userId, 'att-1'))).toBeNull();
    expect(await harness.db.select().from(deletedBlobs)).toEqual([]);
  });

  it('forgets a blob that was never uploaded, rather than retrying it forever', async () => {
    const store = createFsStore(dir);
    await enqueueDeletedBlobs(harness.db, userId, [tombstone('att-1')], daysAgo(30));
    expect(await drainDeletedBlobs(harness.db, store, NOW)).toBe(1);
    expect(await harness.db.select().from(deletedBlobs)).toEqual([]);
  });

  it("never touches another user's object", async () => {
    const store = createFsStore(dir);
    const other = await createTestSession(harness.db, 'Bob');
    await store.put(objectKey(other.userId, 'att-1'), BYTES, meta);
    await enqueueDeletedBlobs(harness.db, userId, [tombstone('att-1')], daysAgo(30));

    await drainDeletedBlobs(harness.db, store, NOW);
    expect(await store.head(objectKey(other.userId, 'att-1'))).toBe(BYTES.byteLength);
  });
});
