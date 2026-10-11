import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { invites, passkey, session, syncRows, user } from '../db/schema';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { createTestSession } from '../test/session';
import {
  ADMIN_ROLE,
  accountDetail,
  accountDetails,
  claimRoleForNewUser,
  isAdmin,
  MEMBER_ROLE,
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
  it('is false for a revoked admin, so being thrown out outranks the role', async () => {
    const admin = await createTestSession(harness.db, 'Ada', ADMIN_ROLE);
    await revokeUser(harness.db, admin.userId, 'left the household', NOW);
    await expect(isAdmin(harness.db, admin.userId)).resolves.toBe(false);
  });
});

describe('accountDetails', () => {
  it('gives every account what accountDetail gives it, oldest first, in one pass', async () => {
    // Admin → Account renders the panel of every row from this one read. A grouped query that
    // drops an account with no session, or gives one account's counts to another, shows wrong
    // facts in a panel nobody re-checks.
    const ada = await accountWithNoRole('Ada', new Date('2026-09-11T09:00:00.000Z'));
    const bob = await accountWithNoRole('Bob', new Date('2026-09-11T10:00:00.000Z'));
    const cleo = await accountWithNoRole('Cleo', new Date('2026-09-11T11:00:00.000Z'));
    await claimRoleForNewUser(harness.db, ada);
    await revokeUser(harness.db, cleo, 'moved out', NOW);
    const LATER = new Date('2026-09-12T08:00:00.000Z');
    for (const createdAt of [LATER, NOW]) {
      await harness.db.insert(session).values({
        id: crypto.randomUUID(),
        userId: bob,
        token: crypto.randomUUID(),
        createdAt,
        expiresAt: new Date('2026-12-01T00:00:00.000Z'),
        updatedAt: createdAt,
      });
    }
    for (const id of ['k1', 'k2']) {
      await harness.db.insert(passkey).values({
        id,
        userId: bob,
        name: null,
        publicKey: 'key',
        credentialID: `credential-${id}`,
        counter: 0,
        deviceType: 'singleDevice',
        backedUp: false,
        transports: 'internal',
        createdAt: NOW,
        aaguid: null,
      });
    }
    for (const [seq, userId] of [ada, bob, bob].entries()) {
      await harness.db.insert(syncRows).values({
        userId,
        entity: 'tag',
        id: `t${seq}`,
        updatedAt: 'h',
        deletedAt: null,
        data: {},
        seq,
      });
    }
    await harness.db.insert(invites).values({
      id: 'invite-bob',
      codeHash: 'hash-bob',
      label: 'Per Bob',
      createdBy: ada,
      createdAt: NOW,
      expiresAt: new Date('2026-09-18T09:00:00.000Z'),
      usedAt: NOW,
      usedBy: bob,
    });

    const all = await accountDetails(harness.db);
    expect(all.map((detail) => detail.displayName)).toEqual(['Ada', 'Bob', 'Cleo']);
    for (const id of [ada, bob, cleo]) {
      expect(all.find((detail) => detail.id === id)).toEqual(await accountDetail(harness.db, id));
    }
    expect(all[1]).toMatchObject({
      lastSignInAt: LATER.toISOString(),
      passkeyCount: 2,
      syncedRows: 2,
      invite: { id: 'invite-bob', label: 'Per Bob' },
    });
    expect(all[2]).toMatchObject({
      revoked: true,
      lastSignInAt: null,
      passkeyCount: 0,
      syncedRows: 0,
      invite: null,
    });
  });
});
