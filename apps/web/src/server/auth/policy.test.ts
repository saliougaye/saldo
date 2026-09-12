import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { user } from '../db/schema';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { registrationAllowed, registrationRequiresInvite } from './policy';

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

describe('registrationAllowed', () => {
  it('is always allowed when open and never when closed', async () => {
    await expect(registrationAllowed(harness.db, 'open')).resolves.toBe(true);
    await expect(registrationAllowed(harness.db, 'closed')).resolves.toBe(false);
    await harness.db.insert(user).values({
      id: crypto.randomUUID(),
      name: 'Ada',
      email: `${crypto.randomUUID()}@passkey.saldo.invalid`,
      emailVerified: false,
    });
    await expect(registrationAllowed(harness.db, 'open')).resolves.toBe(true);
    await expect(registrationAllowed(harness.db, 'closed')).resolves.toBe(false);
  });

  it('allows the first user only', async () => {
    await expect(registrationAllowed(harness.db, 'first-user')).resolves.toBe(true);
    await harness.db.insert(user).values({
      id: crypto.randomUUID(),
      name: 'Ada',
      email: `${crypto.randomUUID()}@passkey.saldo.invalid`,
      emailVerified: false,
    });
    await expect(registrationAllowed(harness.db, 'first-user')).resolves.toBe(false);
  });
});

describe('invite mode', () => {
  it('always reports registration as possible, because a code is what decides', async () => {
    // The health endpoint's answer drives one thing only: whether the app offers "create account".
    // Under `invite` it must, whether or not an unused code happens to exist right now — the
    // person holding one has to be able to reach the form.
    await expect(registrationAllowed(harness.db, 'invite')).resolves.toBe(true);
    await harness.db.insert(user).values({
      id: crypto.randomUUID(),
      name: 'Ada',
      email: `${crypto.randomUUID()}@passkey.saldo.invalid`,
      emailVerified: false,
    });
    await expect(registrationAllowed(harness.db, 'invite')).resolves.toBe(true);
  });

  it('is the only mode that demands a code', () => {
    expect(registrationRequiresInvite('invite')).toBe(true);
    expect(registrationRequiresInvite('open')).toBe(false);
    expect(registrationRequiresInvite('first-user')).toBe(false);
    expect(registrationRequiresInvite('closed')).toBe(false);
  });
});
