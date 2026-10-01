import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { isAdmin } from '../auth/admin';
import { deletedBlobs, session, syncRows, user } from '../db/schema';
import { createFsStore } from '../storage/fsStore';
import { type AttachmentStore, objectKey } from '../storage/types';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { createTestSession } from '../test/session';
import { deleteAccount, promoteAccount, restoreAccount, revokeAccount } from './accounts';

let harness: TestDatabase;
const NOW = new Date('2026-09-11T09:00:00.000Z');

beforeAll(async () => {
  harness = await createTestDatabase();
});

afterEach(async () => {
  await harness.reset();
});

afterAll(async () => {
  await harness.close();
});

async function twoAccounts() {
  const admin = await createTestSession(harness.db, 'Ada', 'admin');
  const member = await createTestSession(harness.db, 'Bob', 'user');
  return { admin: admin.userId, member: member.userId };
}

const row = (userId: string, entity: string, id: string, seq: number) => ({
  userId,
  entity,
  id,
  updatedAt: 'h',
  deletedAt: null,
  data: {},
  seq,
});

async function isRevokedRow(id: string): Promise<boolean | null> {
  const [found] = await harness.db
    .select({ banned: user.banned })
    .from(user)
    .where(eq(user.id, id));
  return found?.banned ?? null;
}

describe('promoteAccount', () => {
  it('makes a member an admin', async () => {
    const { admin, member } = await twoAccounts();
    await expect(promoteAccount(harness.db, admin, member)).resolves.toEqual({ ok: true });
    await expect(isAdmin(harness.db, member)).resolves.toBe(true);
  });

  it('refuses an account that does not exist', async () => {
    const { admin } = await twoAccounts();
    await expect(promoteAccount(harness.db, admin, 'nobody')).resolves.toEqual({
      ok: false,
      error: 'notFound',
    });
  });
});

describe('revokeAccount', () => {
  it('flags the account and closes its sessions at once', async () => {
    const { admin, member } = await twoAccounts();
    await expect(revokeAccount(harness.db, admin, member, NOW)).resolves.toEqual({ ok: true });
    expect(await isRevokedRow(member)).toBe(true);
    expect(await harness.db.select().from(session).where(eq(session.userId, member))).toHaveLength(
      0,
    );
    // The other account's session is not touched.
    expect(await harness.db.select().from(session).where(eq(session.userId, admin))).toHaveLength(
      1,
    );
  });

  it('refuses to revoke oneself, and changes nothing', async () => {
    const { admin } = await twoAccounts();
    await expect(revokeAccount(harness.db, admin, admin, NOW)).resolves.toEqual({
      ok: false,
      error: 'self',
    });
    expect(await isRevokedRow(admin)).toBe(false);
    expect(await harness.db.select().from(session).where(eq(session.userId, admin))).toHaveLength(
      1,
    );
  });

  it('refuses an account that does not exist', async () => {
    const { admin } = await twoAccounts();
    await expect(revokeAccount(harness.db, admin, 'nobody', NOW)).resolves.toEqual({
      ok: false,
      error: 'notFound',
    });
  });
});

describe('restoreAccount', () => {
  it('lifts a revocation', async () => {
    const { admin, member } = await twoAccounts();
    await revokeAccount(harness.db, admin, member, NOW);
    await expect(restoreAccount(harness.db, admin, member)).resolves.toEqual({ ok: true });
    expect(await isRevokedRow(member)).toBe(false);
  });

  it('refuses an account that does not exist', async () => {
    const { admin } = await twoAccounts();
    await expect(restoreAccount(harness.db, admin, 'nobody')).resolves.toEqual({
      ok: false,
      error: 'notFound',
    });
  });
});

describe('deleteAccount', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'saldo-admin-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const meta = { size: 1, mimeType: 'image/jpeg' };
  const bytes = new Uint8Array([1]);

  async function nameAddress(id: string, email: string) {
    await harness.db.update(user).set({ email }).where(eq(user.id, id));
  }

  it('refuses to delete oneself', async () => {
    const { admin } = await twoAccounts();
    await expect(
      deleteAccount(harness.db, null, admin, { id: admin, confirmation: 'anything' }),
    ).resolves.toEqual({ ok: false, error: 'self' });
    expect(await harness.db.select().from(user).where(eq(user.id, admin))).toHaveLength(1);
  });

  it('refuses an account that does not exist', async () => {
    const { admin } = await twoAccounts();
    await expect(
      deleteAccount(harness.db, null, admin, { id: 'nobody', confirmation: 'x' }),
    ).resolves.toEqual({ ok: false, error: 'notFound' });
  });

  it('refuses a confirmation that is not the address, and deletes nothing', async () => {
    const { admin, member } = await twoAccounts();
    await nameAddress(member, 'bob@example.com');
    await harness.db.insert(syncRows).values(row(member, 'tag', 't1', 1));
    await expect(
      deleteAccount(harness.db, null, admin, { id: member, confirmation: 'bob@example.org' }),
    ).resolves.toEqual({ ok: false, error: 'emailMismatch' });
    expect(await harness.db.select().from(user).where(eq(user.id, member))).toHaveLength(1);
    expect(await harness.db.select().from(syncRows)).toHaveLength(1);
  });

  it('accepts the address in any case and with blanks around it', async () => {
    const { admin, member } = await twoAccounts();
    await nameAddress(member, 'bob@example.com');
    await expect(
      deleteAccount(harness.db, null, admin, { id: member, confirmation: '  BOB@Example.com ' }),
    ).resolves.toEqual({ ok: true });
    expect(await harness.db.select().from(user).where(eq(user.id, member))).toHaveLength(0);
  });

  it('asks for the display name when the address is synthetic', async () => {
    const { admin, member } = await twoAccounts();
    const synthetic = `${member}@passkey.saldo.invalid`;
    await expect(
      deleteAccount(harness.db, null, admin, { id: member, confirmation: synthetic }),
    ).resolves.toEqual({ ok: false, error: 'emailMismatch' });
    await expect(
      deleteAccount(harness.db, null, admin, { id: member, confirmation: 'bob' }),
    ).resolves.toEqual({ ok: true });
  });

  it("cascades the synced rows and the account, and leaves everybody else's", async () => {
    const { admin, member } = await twoAccounts();
    await harness.db
      .insert(syncRows)
      .values([
        row(member, 'tag', 't1', 1),
        row(member, 'tag', 't2', 2),
        row(admin, 'tag', 't3', 3),
      ]);
    await deleteAccount(harness.db, null, admin, { id: member, confirmation: 'Bob' });
    const left = await harness.db.select().from(syncRows);
    expect(left.map((r) => r.userId)).toEqual([admin]);
  });

  it('deletes the attachment bytes of the account, and only of the account', async () => {
    const { admin, member } = await twoAccounts();
    const store = createFsStore(dir);
    // One referenced by a live attachment row, one known only to the deletion queue, one that
    // belongs to somebody else and happens to share an attachment id.
    await store.put(objectKey(member, 'att-live'), bytes, meta);
    await store.put(objectKey(member, 'att-queued'), bytes, meta);
    await store.put(objectKey(admin, 'att-live'), bytes, meta);
    await harness.db
      .insert(syncRows)
      .values([
        row(member, 'attachment', 'att-live', 1),
        row(member, 'tag', 'not-a-blob', 2),
        row(admin, 'attachment', 'att-live', 3),
      ]);
    await harness.db
      .insert(deletedBlobs)
      .values({ userId: member, attachmentId: 'att-queued', tombstonedAt: NOW });

    await expect(
      deleteAccount(harness.db, store, admin, { id: member, confirmation: 'Bob' }),
    ).resolves.toEqual({ ok: true });

    expect(await store.head(objectKey(member, 'att-live'))).toBeNull();
    expect(await store.head(objectKey(member, 'att-queued'))).toBeNull();
    expect(await store.head(objectKey(admin, 'att-live'))).toBe(1);
  });

  it('still deletes the account when the store fails, or when there is no store', async () => {
    const { admin, member } = await twoAccounts();
    await harness.db.insert(syncRows).values(row(member, 'attachment', 'att-1', 1));
    const failing: AttachmentStore = {
      ...createFsStore(dir),
      delete: () => Promise.reject(new Error('bucket unreachable')),
    };
    await expect(
      deleteAccount(harness.db, failing, admin, { id: member, confirmation: 'Bob' }),
    ).resolves.toEqual({ ok: true });
    expect(await harness.db.select().from(user).where(eq(user.id, member))).toHaveLength(0);

    const other = await createTestSession(harness.db, 'Cy');
    await harness.db.insert(syncRows).values(row(other.userId, 'attachment', 'att-2', 2));
    await expect(
      deleteAccount(harness.db, null, admin, { id: other.userId, confirmation: 'Cy' }),
    ).resolves.toEqual({ ok: true });
  });
});
