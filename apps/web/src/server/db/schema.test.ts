import { and, eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { createTestSession } from '../test/session';
import { dataEpochs, invites, serverSettings, syncRows, user } from './schema';

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
  it('keeps one epoch per account, gone with the account', async () => {
    const { db } = harness;
    const { userId } = await createTestSession(db);
    await db.insert(dataEpochs).values({ userId });

    const [row] = await db.select().from(dataEpochs).where(eq(dataEpochs.userId, userId));
    expect(row).toEqual({ userId, epoch: 0, resetAt: null });

    await db.delete(user).where(eq(user.id, userId));
    expect(await db.select().from(dataEpochs)).toEqual([]);
  });

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

describe('invites', () => {
  it('round-trips an invite and keeps its lifecycle columns', async () => {
    const { db } = harness;
    const { userId } = await createTestSession(db);
    await db.insert(invites).values({
      id: 'invite-1',
      codeHash: 'a'.repeat(64),
      label: 'Marco',
      createdBy: userId,
      createdAt: new Date('2026-09-11T09:00:00.000Z'),
      expiresAt: new Date('2026-09-18T09:00:00.000Z'),
      usedAt: null,
      usedBy: null,
      revokedAt: null,
    });
    const [row] = await db.select().from(invites).where(eq(invites.id, 'invite-1'));
    expect(row?.label).toBe('Marco');
    expect(row?.expiresAt.toISOString()).toBe('2026-09-18T09:00:00.000Z');
    expect(row?.usedAt).toBeNull();
  });

  it('keeps the invite when the account that minted it is deleted', async () => {
    const { db } = harness;
    const { userId } = await createTestSession(db);
    await db.insert(invites).values({
      id: 'invite-2',
      codeHash: 'b'.repeat(64),
      label: null,
      createdBy: userId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 1000),
      usedAt: null,
      usedBy: null,
      revokedAt: null,
    });
    await db.delete(user).where(eq(user.id, userId));
    const [row] = await db.select().from(invites).where(eq(invites.id, 'invite-2'));
    // `set null`, not `cascade`: removing an account must not erase the record of who it invited.
    expect(row?.createdBy).toBeNull();
  });
});

describe('server_settings', () => {
  it('keeps one json value per key, stamped with who changed it and when', async () => {
    const { db } = harness;
    const { userId } = await createTestSession(db);
    const updatedAt = new Date('2026-09-30T09:00:00.000Z');
    await db
      .insert(serverSettings)
      .values({ key: 'registration', value: 'invite', updatedAt, updatedBy: userId });
    await db.insert(serverSettings).values({
      key: 'smtp',
      value: { host: 'localhost', port: 1025 },
      updatedAt,
      updatedBy: userId,
    });

    const [row] = await db.select().from(serverSettings).where(eq(serverSettings.key, 'smtp'));
    expect(row?.value).toEqual({ host: 'localhost', port: 1025 });
    expect(row?.updatedAt.toISOString()).toBe('2026-09-30T09:00:00.000Z');
    await expect(
      db.insert(serverSettings).values({ key: 'smtp', value: {}, updatedAt, updatedBy: null }),
    ).rejects.toThrow();
  });

  it('keeps the setting when the admin who changed it is deleted', async () => {
    const { db } = harness;
    const { userId } = await createTestSession(db);
    await db.insert(serverSettings).values({
      key: 'instanceName',
      value: 'Casa',
      updatedAt: new Date(),
      updatedBy: userId,
    });
    await db.delete(user).where(eq(user.id, userId));
    const [row] = await db.select().from(serverSettings);
    // `set null`, not `cascade`: the instance's configuration outlives whoever typed it.
    expect(row?.value).toBe('Casa');
    expect(row?.updatedBy).toBeNull();
  });
});
