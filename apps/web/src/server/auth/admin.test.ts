import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { invites, passkey, session, syncRows, user } from '../db/schema';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { createTestSession } from '../test/session';
import {
  ADMIN_ROLE,
  accountDetail,
  claimRoleForNewUser,
  deleteUser,
  isAdmin,
  listAccounts,
  MEMBER_ROLE,
  promoteUser,
  restoreUser,
  revokeUser,
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

/**
 * These write the `user` row with no role at all and then claim one, which is the order the real
 * ceremony uses: better-auth creates the account, and `claimRoleForNewUser` decides what it is.
 */
async function accountWithNoRole(name: string, createdAt: Date): Promise<string> {
  const id = crypto.randomUUID();
  await harness.db.insert(user).values({
    id,
    name,
    email: `${id}@passkey.saldo.invalid`,
    emailVerified: false,
    createdAt,
    updatedAt: createdAt,
  });
  return id;
}

describe('claimRoleForNewUser', () => {
  it('makes the first account the admin and every later one a member', async () => {
    const ada = await accountWithNoRole('Ada', new Date('2026-09-11T09:00:00.000Z'));
    await expect(claimRoleForNewUser(harness.db, ada)).resolves.toBe(ADMIN_ROLE);

    const bob = await accountWithNoRole('Bob', new Date('2026-09-11T10:00:00.000Z'));
    await expect(claimRoleForNewUser(harness.db, bob)).resolves.toBe(MEMBER_ROLE);
  });

  it('writes the role out rather than leaving it implied by NULL', async () => {
    const bob = await accountWithNoRole('Bob', new Date('2026-09-11T10:00:00.000Z'));
    await accountWithNoRole('Ada', new Date('2026-09-11T09:00:00.000Z'));
    await claimRoleForNewUser(harness.db, bob);
    const [row] = await harness.db.select().from(user).where(eq(user.id, bob));
    // A member says `user`, not NULL: the next query to read this column must not have to guess.
    expect(row?.role).toBe(MEMBER_ROLE);
  });

  it('gives the instance exactly one owner when both accounts already exist', async () => {
    // The shape of the race: two ceremonies finish together, so by the time either of them claims
    // a role **both rows are already written**. Counting rows would answer "two" to both and
    // leave the server with no admin at all; the rule is "is the earliest account mine".
    const ada = await accountWithNoRole('Ada', new Date('2026-09-11T09:00:00.000Z'));
    const bob = await accountWithNoRole('Bob', new Date('2026-09-11T09:00:01.000Z'));

    const roles = [
      await claimRoleForNewUser(harness.db, bob),
      await claimRoleForNewUser(harness.db, ada),
    ];
    expect(roles.filter((role) => role === ADMIN_ROLE)).toHaveLength(1);
    // And it is the earlier account that got it, whichever order they claimed in.
    await expect(isAdmin(harness.db, ada)).resolves.toBe(true);
    await expect(isAdmin(harness.db, bob)).resolves.toBe(false);
  });

  it('does not hand the server to a newcomer on an instance that predates roles', async () => {
    // Upgrading: the existing account carries NULL, so there is no admin — but the next person
    // invited is not the earliest account either, and must not inherit the place.
    await accountWithNoRole('Saliou', new Date('2026-09-01T09:00:00.000Z'));
    const newcomer = await accountWithNoRole('Marco', new Date('2026-09-12T09:00:00.000Z'));
    await expect(claimRoleForNewUser(harness.db, newcomer)).resolves.toBe(MEMBER_ROLE);
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
    const sessions = await harness.db
      .select()
      .from(session)
      .where(eq(session.userId, member.userId));
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
    expect(rows[0]).toMatchObject({
      displayName: 'Ada',
      role: ADMIN_ROLE,
      revoked: false,
      email: expect.stringContaining('@passkey.saldo.invalid'),
    });
    expect(rows[1]).toMatchObject({ displayName: 'Bob', role: 'user', revoked: true });
    // §17.1.8: the admin's account list shows the email so a self-hoster can tell accounts apart —
    // synthetic or not, since only that lets an owner ask a passkey-only member for a real one.
  });
});

describe('accountDetail', () => {
  it('answers null for an id that names nothing', async () => {
    await expect(accountDetail(harness.db, 'nobody')).resolves.toBeNull();
  });

  it('carries the summary and, for a fresh account, empty counts', async () => {
    const { userId } = await createTestSession(harness.db, 'Ada', ADMIN_ROLE);
    await harness.db.delete(session).where(eq(session.userId, userId));
    const detail = await accountDetail(harness.db, userId);
    expect(detail).toMatchObject({
      id: userId,
      displayName: 'Ada',
      role: ADMIN_ROLE,
      revoked: false,
      emailVerified: false,
      lastSignInAt: null,
      passkeyCount: 0,
      syncedRows: 0,
      invite: null,
    });
  });

  it('counts passkeys and synced rows of that account only', async () => {
    const ada = await createTestSession(harness.db, 'Ada');
    const bob = await createTestSession(harness.db, 'Bob');
    for (const [userId, n] of [
      [ada.userId, 2],
      [bob.userId, 1],
    ] as const) {
      for (let i = 0; i < n; i += 1) {
        await harness.db.insert(passkey).values({
          id: crypto.randomUUID(),
          publicKey: 'k',
          userId,
          credentialID: crypto.randomUUID(),
          counter: 0,
          deviceType: 'singleDevice',
          backedUp: false,
        });
      }
    }
    await harness.db.insert(syncRows).values(
      ['a', 'b', 'c'].map((id, seq) => ({
        userId: ada.userId,
        entity: 'tag',
        id,
        updatedAt: 'h',
        deletedAt: null,
        data: {},
        seq,
      })),
    );
    await harness.db.insert(syncRows).values({
      userId: bob.userId,
      entity: 'tag',
      id: 'z',
      updatedAt: 'h',
      deletedAt: null,
      data: {},
      seq: 10,
    });
    const detail = await accountDetail(harness.db, ada.userId);
    expect(detail?.passkeyCount).toBe(2);
    expect(detail?.syncedRows).toBe(3);
  });

  it('reports the newest session as the last sign-in, as an ISO string', async () => {
    const { userId } = await createTestSession(harness.db, 'Ada');
    await harness.db.delete(session).where(eq(session.userId, userId));
    for (const [token, createdAt] of [
      ['t1', new Date('2026-09-01T08:00:00.000Z')],
      ['t2', new Date('2026-09-05T08:00:00.000Z')],
      ['t3', new Date('2026-09-03T08:00:00.000Z')],
    ] as const) {
      await harness.db.insert(session).values({
        id: crypto.randomUUID(),
        userId,
        token,
        expiresAt: new Date('2027-01-01T00:00:00.000Z'),
        createdAt,
        updatedAt: createdAt,
      });
    }
    const detail = await accountDetail(harness.db, userId);
    expect(detail?.lastSignInAt).toBe('2026-09-05T08:00:00.000Z');
  });

  it('names the invite that let the account in', async () => {
    const { userId } = await createTestSession(harness.db, 'Bob');
    const other = await createTestSession(harness.db, 'Cy');
    await harness.db.insert(invites).values([
      {
        id: 'inv-1',
        codeHash: 'h1',
        label: 'Per Bob',
        createdAt: NOW,
        expiresAt: NOW,
        usedAt: NOW,
        usedBy: userId,
      },
      {
        id: 'inv-2',
        codeHash: 'h2',
        label: 'Per Cy',
        createdAt: NOW,
        expiresAt: NOW,
        usedAt: NOW,
        usedBy: other.userId,
      },
    ]);
    const detail = await accountDetail(harness.db, userId);
    expect(detail?.invite).toEqual({ id: 'inv-1', label: 'Per Bob' });
  });

  it('reports whether the address is verified', async () => {
    const { userId } = await createTestSession(harness.db, 'Ada');
    await harness.db.update(user).set({ emailVerified: true }).where(eq(user.id, userId));
    expect((await accountDetail(harness.db, userId))?.emailVerified).toBe(true);
  });
});
