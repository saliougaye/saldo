import { SYNC_SCHEMA_VERSION, type SyncChangeEnvelope } from '@saldo/core';
import { and, eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { syncRows } from '../db/schema';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { createTestSession } from '../test/session';
import { applyPush } from './push';

let harness: TestDatabase;
const NOW = new Date('2026-09-10T10:00:00.000Z');
/** The server's own wall clock, so the HLCs below are not treated as skewed. */
const WALL = String(NOW.getTime()).padStart(15, '0');

async function seedUser(name = 'Ada'): Promise<string> {
  return (await createTestSession(harness.db, name)).userId;
}

function tag(id: string, name: string, hlc: string): SyncChangeEnvelope {
  return {
    entity: 'tag',
    id,
    updatedAt: hlc,
    deletedAt: null,
    data: {
      id,
      createdAt: '2026-09-10T09:00:00.000Z',
      updatedAt: hlc,
      deletedAt: null,
      name,
    },
  };
}

const request = (changes: SyncChangeEnvelope[], deviceId = 'device-a') => ({
  schemaVersion: SYNC_SCHEMA_VERSION,
  deviceId,
  changes,
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

describe('applyPush', () => {
  it('applies a new row and assigns an increasing seq', async () => {
    const userId = await seedUser();
    const results = await applyPush(
      harness.db,
      userId,
      request([
        tag('tag-1', 'Rimborsabile', `${WALL}-0000-device-a`),
        tag('tag-2', 'Trasloco', `${WALL}-0001-device-a`),
      ]),
      NOW,
    );
    expect(results.map((result) => result.status)).toEqual(['applied', 'applied']);

    const rows = await harness.db.select().from(syncRows).where(eq(syncRows.userId, userId));
    expect(rows).toHaveLength(2);
    const seqs = rows.map((row) => row.seq).sort((a, b) => a - b);
    expect(seqs[1]).toBeGreaterThan(seqs[0] ?? 0);
  });

  it('overwrites an older row and answers stale for an older push', async () => {
    const userId = await seedUser();
    const older = tag('tag-1', 'Old', `${WALL}-0000-device-a`);
    const newer = tag('tag-1', 'New', `${WALL}-0001-device-a`);

    await applyPush(harness.db, userId, request([newer]), NOW);
    const results = await applyPush(harness.db, userId, request([older], 'device-b'), NOW);
    expect(results[0]?.status).toBe('stale');

    const [row] = await harness.db
      .select()
      .from(syncRows)
      .where(and(eq(syncRows.userId, userId), eq(syncRows.id, 'tag-1')));
    expect(row?.data).toMatchObject({ name: 'New' });
  });

  it('answers invalid for a body that does not match its schema, and applies the rest', async () => {
    const userId = await seedUser();
    const broken: SyncChangeEnvelope = {
      ...tag('tag-1', 'Broken', `${WALL}-0000-device-a`),
      data: { id: 'tag-1', name: '' },
    };
    const results = await applyPush(
      harness.db,
      userId,
      request([broken, tag('tag-2', 'Fine', `${WALL}-0001-device-a`)]),
      NOW,
    );
    expect(results[0]).toMatchObject({ id: 'tag-1', status: 'invalid' });
    expect(results[0]?.error).toBeTruthy();
    expect(results[1]?.status).toBe('applied');
    const rows = await harness.db.select().from(syncRows).where(eq(syncRows.userId, userId));
    expect(rows.map((row) => row.id)).toEqual(['tag-2']);
  });

  it('answers invalid for an envelope that disagrees with its body', async () => {
    const userId = await seedUser();
    const mismatched: SyncChangeEnvelope = {
      ...tag('tag-1', 'Fine', `${WALL}-0000-device-a`),
      id: 'tag-9',
    };
    const results = await applyPush(harness.db, userId, request([mismatched]), NOW);
    expect(results[0]?.status).toBe('invalid');
  });

  it('rejects a clock more than 24h ahead of the server', async () => {
    const userId = await seedUser();
    const future = String(NOW.getTime() + 25 * 3600 * 1000).padStart(15, '0');
    const results = await applyPush(
      harness.db,
      userId,
      request([tag('tag-1', 'From the future', `${future}-0000-device-a`)]),
      NOW,
    );
    expect(results[0]).toMatchObject({ status: 'invalid' });
    expect(results[0]?.error).toMatch(/clock/i);
  });

  it('stores a tombstone as a row, not a delete', async () => {
    const userId = await seedUser();
    const deletedAt = '2026-09-10T10:00:00.000Z';
    const hlc = `${WALL}-0000-device-a`;
    const change: SyncChangeEnvelope = {
      entity: 'tag',
      id: 'tag-1',
      updatedAt: hlc,
      deletedAt,
      data: {
        id: 'tag-1',
        createdAt: '2026-09-10T09:00:00.000Z',
        updatedAt: hlc,
        deletedAt,
        name: 'Gone',
      },
    };
    const results = await applyPush(harness.db, userId, request([change]), NOW);
    expect(results[0]?.status).toBe('applied');
    const [row] = await harness.db.select().from(syncRows).where(eq(syncRows.userId, userId));
    expect(row?.deletedAt).not.toBeNull();
  });

  it("keeps two users' rows apart", async () => {
    const ada = await seedUser('Ada');
    const bob = await seedUser('Bob');
    await applyPush(harness.db, ada, request([tag('tag-1', 'Ada', `${WALL}-0000-device-a`)]), NOW);
    await applyPush(
      harness.db,
      bob,
      request([tag('tag-1', 'Bob', `${WALL}-0000-device-b`)], 'device-b'),
      NOW,
    );
    const [row] = await harness.db
      .select()
      .from(syncRows)
      .where(and(eq(syncRows.userId, ada), eq(syncRows.id, 'tag-1')));
    expect(row?.data).toMatchObject({ name: 'Ada' });
  });
});
