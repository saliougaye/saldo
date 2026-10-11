import type { BetterAuthOptions } from 'better-auth';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { user } from '../db/schema';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { createTestSession, sessionCookie } from '../test/session';
import { ADMIN_ROLE, MEMBER_ROLE } from './admin';
import { auth, buildAuthOptions } from './auth';
import { authenticate } from './session';

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

/** Sets the ban flag and keeps the session rows: the gap that better-auth leaves open (§10). */
async function banOnly(userId: string): Promise<void> {
  await harness.db.update(user).set({ banned: true }).where(eq(user.id, userId));
}

/**
 * The guard against a future cookie cache. `authenticate` trusts `session.user.banned` because
 * `getSession` reads the user row on every call. A cached session is used only when the request has
 * a `session_data` cookie, so the ban tests below would still pass with a cache: this checks the
 * setting itself.
 */
describe('the session settings', () => {
  it('reads the database on every call: no cookie cache, no secondary storage', async () => {
    const options = buildAuthOptions();
    expect(options.session).not.toHaveProperty('cookieCache');
    expect(options).not.toHaveProperty('secondaryStorage');
    // What `getSession` reads at run time.
    // Widened to the library's type: the instance's own type names only the keys that are set.
    const running: BetterAuthOptions = (await auth().$context).options;
    expect(running.session?.cookieCache?.enabled).not.toBe(true);
    expect(running.secondaryStorage).toBeUndefined();
  });
});

describe('authenticate', () => {
  it('reads a banned account with a live bearer as signed out (§10)', async () => {
    const bob = await createTestSession(harness.db, 'Bob');
    expect(await authenticate(new Headers({ authorization: bob.bearer }))).not.toBeNull();

    await banOnly(bob.userId);

    expect(await authenticate(new Headers({ authorization: bob.bearer }))).toBeNull();
  });

  it('reads a banned account with a live cookie as signed out (§10)', async () => {
    const bob = await createTestSession(harness.db, 'Bob');
    const cookie = await sessionCookie(bob.token);
    expect(await authenticate(new Headers({ cookie }))).not.toBeNull();

    await banOnly(bob.userId);

    expect(await authenticate(new Headers({ cookie }))).toBeNull();
  });

  it('gives the role with the session, so a page render needs no second read', async () => {
    const admin = await createTestSession(harness.db, 'Ada', 'admin');
    const member = await createTestSession(harness.db, 'Bob', 'user');

    expect((await authenticate(new Headers({ authorization: admin.bearer })))?.role).toBe(
      ADMIN_ROLE,
    );
    expect((await authenticate(new Headers({ authorization: member.bearer })))?.role).toBe(
      MEMBER_ROLE,
    );
  });
});
