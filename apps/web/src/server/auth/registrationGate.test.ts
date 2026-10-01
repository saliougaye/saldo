import { APIError } from 'better-auth/api';
import { sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { serverSettings } from '../db/schema';
import { resetEnvCache } from '../env';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { auth, resetAuthForTests } from './auth';
import { burnInvite, createInvite, inviteIsUsable, revokeInvite } from './invites';
import { encodeRegistrationContext } from './registrationContext';

/**
 * The registration policy lives in the passkey plugin's `resolveUser` hook, and asking for
 * registration options is what runs it — the WebAuthn ceremony only begins **after** this call
 * returns. So these tests drive the real hook, with no authenticator anywhere: they are the only
 * thing that proves the gate is wired into Better Auth and not merely written down.
 *
 * `afterVerification` — the burn, and the first-account-becomes-admin rule — cannot be reached
 * this way: it needs a signed attestation from a real authenticator. It is covered by unit tests
 * on `burnInvite` and `claimRoleForNewUser` instead.
 */

let harness: TestDatabase;

const DAY_MS = 24 * 60 * 60 * 1000;

interface RegistrationOptions {
  challenge: string;
  user: { name: string; displayName: string };
}

function optionsFor(context: string): Promise<RegistrationOptions> {
  return auth().api.generatePasskeyRegistrationOptions({ query: { context } });
}

/** The refusal as the browser would see it, so two of them can be compared for sameness. */
async function refusal(context: string): Promise<{ status: string; message: string }> {
  try {
    await optionsFor(context);
  } catch (error) {
    if (error instanceof APIError) return { status: String(error.status), message: error.message };
    throw error;
  }
  throw new Error('the ceremony was allowed to start');
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

describe('the registration gate, on an open server', () => {
  it('starts the ceremony for somebody who gave a name', async () => {
    const options = await optionsFor(
      encodeRegistrationContext({ name: 'Ada', email: 'ada@example.com' }),
    );
    expect(options.challenge).toBeTypeOf('string');
    expect(options.user.name).toBe('Ada');
  });

  it('refuses a ceremony with no name to put on the account', async () => {
    await expect(
      refusal(encodeRegistrationContext({ name: '   ', email: 'ada@example.com' })),
    ).resolves.toEqual({
      status: 'BAD_REQUEST',
      message: 'Choose a name first',
    });
  });

  it('does not look at the code, so a nonsense one is as good as none', async () => {
    // The same two contexts are told apart only under `invite`, below: this is what makes the
    // mode, and not the code, the thing that decides.
    await expect(
      optionsFor(
        encodeRegistrationContext({
          name: 'Ada',
          email: 'ada@example.com',
          invite: 'ZZZZ-ZZZZ-ZZZZ-ZZZZ',
        }),
      ),
    ).resolves.toMatchObject({ user: { name: 'Ada' } });
    await expect(
      optionsFor(encodeRegistrationContext({ name: 'Ada', email: 'ada@example.com' })),
    ).resolves.toMatchObject({
      user: { name: 'Ada' },
    });
  });
});

describe('the registration gate, on a server that runs on invitation', () => {
  let previous: string | undefined;

  beforeAll(() => {
    // `buildAuthOptions()` reads `env()` once and `auth()` memoises the instance, so changing the
    // mode means throwing both caches away and letting the next call rebuild them.
    previous = process.env.REGISTRATION;
    process.env.REGISTRATION = 'invite';
    resetEnvCache();
    resetAuthForTests();
  });

  afterAll(() => {
    if (previous === undefined) delete process.env.REGISTRATION;
    else process.env.REGISTRATION = previous;
    resetEnvCache();
    resetAuthForTests();
  });

  it('starts the ceremony for a valid code, and does not spend it', async () => {
    const { code } = await createInvite(harness.db, {
      label: 'Marco',
      ttlDays: 7,
      createdBy: null,
      now: new Date(),
    });
    const options = await optionsFor(
      encodeRegistrationContext({ name: 'Marco', email: 'marco@example.com', invite: code }),
    );
    expect(options.user.name).toBe('Marco');
    // Invariant: a ceremony that is abandoned after this point must not have cost Marco his code.
    await expect(inviteIsUsable(harness.db, code, new Date())).resolves.toBe(true);
  });

  it('refuses every code that is no good, and with the same words each time', async () => {
    const now = new Date();
    const spent = await createInvite(harness.db, {
      label: null,
      ttlDays: 7,
      createdBy: null,
      now,
    });
    await burnInvite(harness.db, spent.code, now);

    const revoked = await createInvite(harness.db, {
      label: null,
      ttlDays: 7,
      createdBy: null,
      now,
    });
    await revokeInvite(harness.db, revoked.invite.id, now);

    const expired = await createInvite(harness.db, {
      label: null,
      ttlDays: 1,
      createdBy: null,
      now: new Date(now.getTime() - 10 * DAY_MS),
    });

    const answers = await Promise.all(
      ['ZZZZ-ZZZZ-ZZZZ-ZZZZ', spent.code, revoked.code, expired.code].map((invite) =>
        refusal(encodeRegistrationContext({ name: 'Marco', email: 'marco@example.com', invite })),
      ),
    );
    // One answer for unknown, spent, revoked and expired: the form must not become a way to find
    // out which codes exist.
    expect(answers).toEqual([
      { status: 'FORBIDDEN', message: 'That invite code is not valid' },
      { status: 'FORBIDDEN', message: 'That invite code is not valid' },
      { status: 'FORBIDDEN', message: 'That invite code is not valid' },
      { status: 'FORBIDDEN', message: 'That invite code is not valid' },
    ]);
  });

  it('refuses somebody who brought no code at all', async () => {
    await expect(
      refusal(encodeRegistrationContext({ name: 'Marco', email: 'marco@example.com' })),
    ).resolves.toEqual({
      status: 'FORBIDDEN',
      message: 'That invite code is not valid',
    });
  });
});

describe('the registration gate, when the mode is stored and not in the environment', () => {
  let previous: string | undefined;

  beforeAll(() => {
    // No `REGISTRATION`: the mode is whatever the panel saved, read at ceremony time. `auth()` is
    // built once below and never rebuilt, which is what these tests are about.
    previous = process.env.REGISTRATION;
    delete process.env.REGISTRATION;
    resetEnvCache();
    resetAuthForTests();
  });

  afterAll(() => {
    if (previous === undefined) delete process.env.REGISTRATION;
    else process.env.REGISTRATION = previous;
    resetEnvCache();
    resetAuthForTests();
  });

  const store = (registration: string) =>
    harness.db
      .insert(serverSettings)
      .values({ key: 'registration', value: registration, updatedAt: new Date(), updatedBy: null })
      .onConflictDoUpdate({
        target: serverSettings.key,
        set: { value: registration },
      });

  it('honours a mode saved after the instance was built, on the very next ceremony', async () => {
    const context = encodeRegistrationContext({ name: 'Ada', email: 'ada@example.com' });
    // Builds `auth()` while the table is empty: the default, `first-user`, lets the first in.
    await expect(optionsFor(context)).resolves.toMatchObject({ user: { name: 'Ada' } });

    await store('closed');
    await expect(refusal(context)).resolves.toEqual({
      status: 'FORBIDDEN',
      message: 'This server is not accepting new accounts',
    });

    await store('invite');
    await expect(refusal(context)).resolves.toEqual({
      status: 'FORBIDDEN',
      message: 'That invite code is not valid',
    });

    await store('open');
    await expect(optionsFor(context)).resolves.toMatchObject({ user: { name: 'Ada' } });
  });

  it('fails closed when the settings cannot be read: an error, never an open door', async () => {
    const context = encodeRegistrationContext({ name: 'Ada', email: 'ada@example.com' });
    await store('open');
    await harness.db.execute(sql`alter table server_settings rename to server_settings_away`);
    try {
      await expect(optionsFor(context)).rejects.toThrow();
    } finally {
      await harness.db.execute(sql`alter table server_settings_away rename to server_settings`);
    }
  });
});
