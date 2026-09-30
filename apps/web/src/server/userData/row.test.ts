import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { syncRows } from '../db/schema';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { createTestSession } from '../test/session';
import { writeChanges } from '../write/writeChanges';
import { loadRow } from './row';

let harness: TestDatabase;
const NOW = new Date('2026-09-29T10:00:00.000Z');

beforeAll(async () => {
  harness = await createTestDatabase();
});
afterEach(async () => {
  await harness.reset();
});
afterAll(async () => {
  await harness.close();
});

describe('loadRow', () => {
  it('finds a live row, not deleted', async () => {
    const { userId } = await createTestSession(harness.db);
    await writeChanges(
      harness.db,
      userId,
      [
        {
          entity: 'tag',
          id: 't1',
          data: { id: 't1', name: 'casa', createdAt: NOW.toISOString(), deletedAt: null },
        },
      ],
      NOW,
    );
    const result = await loadRow(harness.db, userId, 'tag', 't1');
    expect(result.status).toBe('found');
    if (result.status === 'found') {
      expect(result.row.name).toBe('casa');
      expect(result.deleted).toBe(false);
    }
  });

  it('finds a tombstoned row, marked deleted', async () => {
    const { userId } = await createTestSession(harness.db);
    await writeChanges(
      harness.db,
      userId,
      [
        {
          entity: 'tag',
          id: 't1',
          data: { id: 't1', name: 'casa', createdAt: NOW.toISOString(), deletedAt: null },
        },
      ],
      NOW,
    );
    await writeChanges(
      harness.db,
      userId,
      [
        {
          entity: 'tag',
          id: 't1',
          data: {
            id: 't1',
            name: 'casa',
            createdAt: NOW.toISOString(),
            deletedAt: NOW.toISOString(),
          },
        },
      ],
      NOW,
    );
    const result = await loadRow(harness.db, userId, 'tag', 't1');
    expect(result.status).toBe('found');
    if (result.status === 'found') {
      expect(result.row.name).toBe('casa');
      expect(result.deleted).toBe(true);
    }
  });

  it('answers missing for an id that was never written', async () => {
    const { userId } = await createTestSession(harness.db);
    const result = await loadRow(harness.db, userId, 'tag', 'nope');
    expect(result).toEqual({ status: 'missing' });
  });

  it('answers invalid for a row that fails its schema', async () => {
    const { userId } = await createTestSession(harness.db);
    await harness.db.insert(syncRows).values({
      userId,
      entity: 'tag',
      id: 'bad',
      updatedAt: '000000000000001-0000-dev',
      deletedAt: null,
      data: { id: 'bad' },
      seq: 1,
    });
    const result = await loadRow(harness.db, userId, 'tag', 'bad');
    expect(result).toEqual({ status: 'invalid' });
  });
});
