import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { users } from '../db/schema';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { registrationAllowed } from './registration';

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
    await harness.db.insert(users).values({ displayName: 'Ada' });
    await expect(registrationAllowed(harness.db, 'open')).resolves.toBe(true);
    await expect(registrationAllowed(harness.db, 'closed')).resolves.toBe(false);
  });

  it('allows the first user only', async () => {
    await expect(registrationAllowed(harness.db, 'first-user')).resolves.toBe(true);
    await harness.db.insert(users).values({ displayName: 'Ada' });
    await expect(registrationAllowed(harness.db, 'first-user')).resolves.toBe(false);
  });
});
