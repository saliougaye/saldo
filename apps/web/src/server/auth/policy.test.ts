import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { user } from '../db/schema';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { registrationAllowed, registrationRequiresInvite, userCount } from './policy';

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

async function addUser() {
  await harness.db.insert(user).values({
    id: crypto.randomUUID(),
    name: 'Ada',
    email: `${crypto.randomUUID()}@passkey.saldo.invalid`,
    emailVerified: false,
  });
}

describe('userCount', () => {
  it('counts the rows of `user`', async () => {
    await expect(userCount(harness.db)).resolves.toBe(0);
    await addUser();
    await expect(userCount(harness.db)).resolves.toBe(1);
  });
});

describe('registrationAllowed', () => {
  it('lets the first account in under every mode (0.3h: the wizard is the first invite)', async () => {
    await expect(registrationAllowed(harness.db, 'open')).resolves.toBe(true);
    await expect(registrationAllowed(harness.db, 'invite')).resolves.toBe(true);
    await expect(registrationAllowed(harness.db, 'first-user')).resolves.toBe(true);
    await expect(registrationAllowed(harness.db, 'closed')).resolves.toBe(true);
  });

  it('once an account exists: open and invite always, closed and first-user never', async () => {
    await addUser();
    await expect(registrationAllowed(harness.db, 'open')).resolves.toBe(true);
    await expect(registrationAllowed(harness.db, 'invite')).resolves.toBe(true);
    await expect(registrationAllowed(harness.db, 'first-user')).resolves.toBe(false);
    await expect(registrationAllowed(harness.db, 'closed')).resolves.toBe(false);
  });
});

describe('registrationRequiresInvite', () => {
  it('asks for no code on a fresh instance, even under invite', async () => {
    await expect(registrationRequiresInvite(harness.db, 'invite')).resolves.toBe(false);
  });

  it('is the only mode that demands a code once somebody exists', async () => {
    await addUser();
    await expect(registrationRequiresInvite(harness.db, 'invite')).resolves.toBe(true);
    await expect(registrationRequiresInvite(harness.db, 'open')).resolves.toBe(false);
    await expect(registrationRequiresInvite(harness.db, 'first-user')).resolves.toBe(false);
    await expect(registrationRequiresInvite(harness.db, 'closed')).resolves.toBe(false);
  });
});
