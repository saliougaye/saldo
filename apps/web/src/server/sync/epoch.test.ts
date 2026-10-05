import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { drainDeletedBlobs } from '../attachments/cleanup';
import { deletedBlobs, syncRows } from '../db/schema';
import { createFsStore } from '../storage/fsStore';
import { objectKey } from '../storage/types';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { createTestSession } from '../test/session';
import { deleteAccountData } from './epoch';

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

describe('deleteAccountData', () => {
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
