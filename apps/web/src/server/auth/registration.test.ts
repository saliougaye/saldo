import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { invites, user } from '../db/schema';
import type { ServerDatabase } from '../db/types';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { ADMIN_ROLE, MEMBER_ROLE } from './admin';
import { createInvite } from './invites';
import { completeRegistration, resolveRegistration, type UserStore } from './registration';
import { readRegistrationContext } from './registrationContext';

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

/** The half of Better Auth's internal adapter these two functions use, over the test database. */
function storeFor(db: ServerDatabase): UserStore {
  return {
    findUserById: async (id) => {
      const [row] = await db
        .select({ id: user.id, email: user.email })
        .from(user)
        .where(eq(user.id, id));
      return row ?? null;
    },
    createUser: async (input) => {
      const [row] = await db
        .insert(user)
        .values({ ...input, emailVerified: false })
        .returning({ id: user.id });
      if (row === undefined) throw new Error('insert returned no row');
      return row;
    },
  };
}

const context = (value: { name?: string; email?: string; invite?: string }) =>
  readRegistrationContext(JSON.stringify(value));

describe('resolveRegistration', () => {
  it('returns the account to be, with the email lowercased', async () => {
    const resolved = await resolveRegistration(harness.db, {
      mode: 'open',
      context: context({ name: 'Ada', email: 'Ada@Example.com' }),
      now: new Date(),
    });
    expect(resolved.name).toBe('Ada');
    expect(resolved.email).toBe('ada@example.com');
    expect(resolved.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('refuses a closed instance', async () => {
    await expect(
      resolveRegistration(harness.db, {
        mode: 'closed',
        context: context({ name: 'Ada', email: 'ada@example.com' }),
        now: new Date(),
      }),
    ).rejects.toMatchObject({ body: { code: 'registration_closed' } });
  });

  it('refuses an empty name', async () => {
    await expect(
      resolveRegistration(harness.db, {
        mode: 'open',
        context: context({ name: '  ', email: 'ada@example.com' }),
        now: new Date(),
      }),
    ).rejects.toMatchObject({ body: { code: 'display_name_required' } });
  });

  it('refuses a missing or malformed email', async () => {
    for (const email of [undefined, '', 'ada', 'ada@']) {
      await expect(
        resolveRegistration(harness.db, {
          mode: 'open',
          context: context({ name: 'Ada', email }),
          now: new Date(),
        }),
      ).rejects.toMatchObject({ body: { code: 'email_required' } });
    }
  });

  it('refuses an email another account already has', async () => {
    await harness.db
      .insert(user)
      .values({ id: 'u1', name: 'Ada', email: 'ada@example.com', emailVerified: false });
    await expect(
      resolveRegistration(harness.db, {
        mode: 'open',
        context: context({ name: 'Ada again', email: 'ADA@example.com' }),
        now: new Date(),
      }),
    ).rejects.toMatchObject({ body: { code: 'email_taken' } });
  });

  /**
   * The invite is what bounds «this email already has an account» (decision 7): an instance that is
   * not open must refuse before it answers, or an anonymous caller could read the address list.
   */
  it('refuses the invite before it says whether the email is taken', async () => {
    await harness.db
      .insert(user)
      .values({ id: 'u1', name: 'Ada', email: 'ada@example.com', emailVerified: false });
    await expect(
      resolveRegistration(harness.db, {
        mode: 'invite',
        context: context({
          name: 'Ada again',
          email: 'ada@example.com',
          invite: 'NOPE-NOPE-NOPE-NOPE',
        }),
        now: new Date(),
      }),
    ).rejects.toMatchObject({ body: { code: 'invalid_invite' } });
  });

  it('refuses an unusable invite under invite mode, and nothing is spent', async () => {
    const { invite } = await createInvite(harness.db, {
      label: null,
      ttlDays: 7,
      createdBy: null,
      now: new Date(),
    });
    await expect(
      resolveRegistration(harness.db, {
        mode: 'invite',
        context: context({ name: 'Ada', email: 'ada@example.com', invite: 'NOPE-NOPE-NOPE-NOPE' }),
        now: new Date(),
      }),
    ).rejects.toMatchObject({ body: { code: 'invalid_invite' } });
    const [row] = await harness.db.select().from(invites).where(eq(invites.id, invite.id));
    expect(row?.usedAt).toBeNull();
  });
});

describe('completeRegistration', () => {
  const resolved = { id: '11111111-1111-4111-8111-111111111111', name: 'Ada' };

  it('writes the account with the email, and makes the first one the admin', async () => {
    const result = await completeRegistration(harness.db, {
      mode: 'open',
      context: context({ name: 'Ada', email: 'Ada@Example.com' }),
      resolved,
      store: storeFor(harness.db),
      now: new Date(),
    });
    expect(result).toEqual({ userId: resolved.id });
    const [row] = await harness.db.select().from(user).where(eq(user.id, resolved.id));
    expect(row?.email).toBe('ada@example.com');
    expect(row?.role).toBe(ADMIN_ROLE);
  });

  it('makes every later account a member', async () => {
    await harness.db
      .insert(user)
      .values({ id: 'first', name: 'First', email: 'first@example.com', emailVerified: false });
    await completeRegistration(harness.db, {
      mode: 'open',
      context: context({ name: 'Ada', email: 'ada@example.com' }),
      resolved,
      store: storeFor(harness.db),
      now: new Date(),
    });
    const [row] = await harness.db.select().from(user).where(eq(user.id, resolved.id));
    expect(row?.role).toBe(MEMBER_ROLE);
  });

  it('spends the invite and records whose it was', async () => {
    const { code, invite } = await createInvite(harness.db, {
      label: null,
      ttlDays: 7,
      createdBy: null,
      now: new Date(),
    });
    await completeRegistration(harness.db, {
      mode: 'invite',
      context: context({ name: 'Ada', email: 'ada@example.com', invite: code }),
      resolved,
      store: storeFor(harness.db),
      now: new Date(),
    });
    const [row] = await harness.db.select().from(invites).where(eq(invites.id, invite.id));
    expect(row?.usedAt).not.toBeNull();
    expect(row?.usedBy).toBe(resolved.id);
  });

  it('gives the invite back when the account cannot be written', async () => {
    const { code, invite } = await createInvite(harness.db, {
      label: null,
      ttlDays: 7,
      createdBy: null,
      now: new Date(),
    });
    const failing: UserStore = {
      findUserById: async () => null,
      createUser: async () => {
        throw new Error('no room at the inn');
      },
    };
    await expect(
      completeRegistration(harness.db, {
        mode: 'invite',
        context: context({ name: 'Ada', email: 'ada@example.com', invite: code }),
        resolved,
        store: failing,
        now: new Date(),
      }),
    ).rejects.toThrow();
    const [row] = await harness.db.select().from(invites).where(eq(invites.id, invite.id));
    expect(row?.usedAt).toBeNull();
  });

  it('answers email_taken when the unique index refuses the row', async () => {
    await harness.db
      .insert(user)
      .values({ id: 'other', name: 'Other', email: 'ada@example.com', emailVerified: false });
    await expect(
      completeRegistration(harness.db, {
        mode: 'open',
        context: context({ name: 'Ada', email: 'ada@example.com' }),
        resolved,
        store: storeFor(harness.db),
        now: new Date(),
      }),
    ).rejects.toMatchObject({ body: { code: 'email_taken' } });
  });

  /**
   * The row exists and holds its owner's address; failing here would leave somebody who can never
   * register with that address again and has no passkey to sign in with. A role can be given back
   * (`user promote`), so the account wins over the role.
   */
  it('keeps the account when the role cannot be claimed', async () => {
    // `claimRoleForNewUser` is the only thing here that opens a transaction, so this breaks that and
    // nothing else.
    const withoutTransactions = new Proxy(harness.db, {
      get(target, property, receiver) {
        if (property === 'transaction') {
          return () => Promise.reject(new Error('the lock could not be taken'));
        }
        return Reflect.get(target, property, receiver);
      },
    }) as ServerDatabase;
    const created = await completeRegistration(withoutTransactions, {
      mode: 'open',
      context: context({ name: 'Ada', email: 'ada@example.com' }),
      resolved,
      store: storeFor(harness.db),
      now: new Date(),
    });
    expect(created.userId).toBe(resolved.id);
    const [row] = await harness.db.select().from(user).where(eq(user.id, resolved.id));
    expect(row?.email).toBe('ada@example.com');
    expect(row?.role).toBeNull();
  });

  /** Decision 12: this is «add a passkey» on an account that already exists. */
  it('does nothing when the id already names an account', async () => {
    await harness.db.insert(user).values({
      id: resolved.id,
      name: 'Ada',
      email: 'ada@example.com',
      emailVerified: false,
      role: MEMBER_ROLE,
    });
    const { invite } = await createInvite(harness.db, {
      label: null,
      ttlDays: 7,
      createdBy: null,
      now: new Date(),
    });
    const result = await completeRegistration(harness.db, {
      // A closed instance and no invite in the context: neither may stop an existing account from
      // adding a passkey, which is exactly what this path is.
      mode: 'closed',
      context: context({ name: '', email: '' }),
      resolved,
      store: storeFor(harness.db),
      now: new Date(),
    });
    expect(result).toEqual({ userId: resolved.id });
    const [row] = await harness.db.select().from(invites).where(eq(invites.id, invite.id));
    expect(row?.usedAt).toBeNull();
  });
});
