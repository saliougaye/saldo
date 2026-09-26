import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { syncRows } from '../db/schema';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { createTestSession } from '../test/session';
import { loadAttachment } from './attachment';

let harness: TestDatabase;

const HLC = '000000000000001-0000-dev';
const row = {
  id: 'att-1',
  createdAt: '2026-09-10T09:00:00.000Z',
  updatedAt: HLC,
  deletedAt: null,
  transactionId: 'tx-1',
  mimeType: 'image/jpeg',
  byteSize: 3,
  sha256: 'a'.repeat(64),
  width: null,
  height: null,
};

async function seed(userId: string, data: unknown, deletedAt: Date | null = null) {
  await harness.db.insert(syncRows).values({
    userId,
    entity: 'attachment',
    id: 'att-1',
    updatedAt: HLC,
    deletedAt,
    data,
    seq: 1,
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

describe('loadAttachment', () => {
  it('finds the user’s live attachment row', async () => {
    const { userId } = await createTestSession(harness.db, 'Ada');
    await seed(userId, row);
    expect(await loadAttachment(harness.db, userId, 'att-1')).toEqual({
      status: 'found',
      attachment: row,
    });
  });

  it('does not find a tombstone, or somebody else’s row', async () => {
    const ada = (await createTestSession(harness.db, 'Ada')).userId;
    const bob = (await createTestSession(harness.db, 'Bob')).userId;
    await seed(ada, row, new Date());
    expect(await loadAttachment(harness.db, ada, 'att-1')).toEqual({ status: 'missing' });
    expect(await loadAttachment(harness.db, bob, 'att-1')).toEqual({ status: 'missing' });
  });

  it('says when the stored row cannot be read', async () => {
    const { userId } = await createTestSession(harness.db, 'Ada');
    await seed(userId, { ...row, byteSize: 'three' });
    expect(await loadAttachment(harness.db, userId, 'att-1')).toEqual({ status: 'invalid' });
  });
});
