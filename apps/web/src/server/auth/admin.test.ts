import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { session, user } from '../db/schema';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { createTestSession } from '../test/session';
import {
  ADMIN_ROLE,
  deleteUser,
  isAdmin,
  listAccounts,
  promoteUser,
  restoreUser,
  revokeUser,
  roleForNewUser,
} from './admin';

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

describe('roleForNewUser', () => {
  it('makes the first account the admin and every later one a member', async () => {
    await expect(roleForNewUser(harness.db)).resolves.toBe(ADMIN_ROLE);
    await createTestSession(harness.db, 'Ada', ADMIN_ROLE);
    await expect(roleForNewUser(harness.db)).resolves.toBe('user');
  });
});

describe('isAdmin', () => {
  it('is true only for the admin role', async () => {
    const admin = await createTestSession(harness.db, 'Ada', ADMIN_ROLE);
    const member = await createTestSession(harness.db, 'Bob', 'user');
    await expect(isAdmin(harness.db, admin.userId)).resolves.toBe(true);
    await expect(isAdmin(harness.db, member.userId)).resolves.toBe(false);
    await expect(isAdmin(harness.db, 'nobody')).resolves.toBe(false);
  });

  it('is false for a revoked admin, so being thrown out outranks the role', async () => {
    const admin = await createTestSession(harness.db, 'Ada', ADMIN_ROLE);
    await revokeUser(harness.db, admin.userId, 'left the household', NOW);
    await expect(isAdmin(harness.db, admin.userId)).resolves.toBe(false);
  });
});

describe('revokeUser', () => {
  it('marks the account and deletes every session it had', async () => {
    const member = await createTestSession(harness.db, 'Bob', 'user');
    await expect(revokeUser(harness.db, member.userId, 'left', NOW)).resolves.toBe(true);

    const [row] = await harness.db.select().from(user).where(eq(user.id, member.userId));
    expect(row?.banned).toBe(true);
    expect(row?.banReason).toBe('left');
    // Better Auth's own ban check only runs when a **new** session is created, so an existing
    // bearer has to be killed by removing the row it names.
    const sessions = await harness.db.select().from(session).where(eq(session.userId, member.userId));
    expect(sessions).toHaveLength(0);
  });

  it('reports an unknown id rather than pretending', async () => {
    await expect(revokeUser(harness.db, 'nobody', null, NOW)).resolves.toBe(false);
  });

  it('keeps the account and its data, so restoring is possible', async () => {
    const member = await createTestSession(harness.db, 'Bob', 'user');
    await revokeUser(harness.db, member.userId, null, NOW);
    await expect(restoreUser(harness.db, member.userId)).resolves.toBe(true);
    const [row] = await harness.db.select().from(user).where(eq(user.id, member.userId));
    expect(row?.banned).toBe(false);
    expect(row?.banReason).toBeNull();
  });
});

describe('deleteUser', () => {
  it('removes the account for good', async () => {
    const member = await createTestSession(harness.db, 'Bob', 'user');
    await expect(deleteUser(harness.db, member.userId)).resolves.toBe(true);
    const rows = await harness.db.select().from(user).where(eq(user.id, member.userId));
    expect(rows).toHaveLength(0);
    await expect(deleteUser(harness.db, member.userId)).resolves.toBe(false);
  });
});

describe('promoteUser', () => {
  it('hands the admin role to somebody else, which is the way back in after losing a phone', async () => {
    const member = await createTestSession(harness.db, 'Bob', 'user');
    await expect(promoteUser(harness.db, member.userId)).resolves.toBe(true);
    await expect(isAdmin(harness.db, member.userId)).resolves.toBe(true);
  });
});

describe('listAccounts', () => {
  it('reports each account with its role and whether it is revoked, oldest first', async () => {
    const admin = await createTestSession(harness.db, 'Ada', ADMIN_ROLE);
    const member = await createTestSession(harness.db, 'Bob', 'user');
    await revokeUser(harness.db, member.userId, 'left', NOW);

    const rows = await listAccounts(harness.db);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.id).toBe(admin.userId);
    expect(rows[0]).toMatchObject({ displayName: 'Ada', role: ADMIN_ROLE, revoked: false });
    expect(rows[1]).toMatchObject({ displayName: 'Bob', role: 'user', revoked: true });
    // The synthetic `.invalid` address says nothing about anybody and is not worth returning.
    expect(JSON.stringify(rows)).not.toContain('passkey.saldo.invalid');
  });
});
