import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { user } from '../db/schema';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { emailIsTaken, isSyntheticEmail, normaliseEmail, syntheticEmail } from './email';

describe('normaliseEmail', () => {
  it('lowercases and trims', () => {
    expect(normaliseEmail('  Ada@Example.COM ')).toBe('ada@example.com');
  });

  it('refuses what is not an address', () => {
    expect(normaliseEmail('')).toBeNull();
    expect(normaliseEmail('ada')).toBeNull();
    expect(normaliseEmail('ada@')).toBeNull();
    expect(normaliseEmail('ada @example.com')).toBeNull();
  });

  it('refuses an address longer than the 254 characters SMTP allows', () => {
    expect(normaliseEmail(`${'a'.repeat(250)}@example.com`)).toBeNull();
  });
});

describe('the synthetic addresses of §9.1', () => {
  it('is built from the account id, in the reserved TLD', () => {
    expect(syntheticEmail('abc')).toBe('abc@passkey.saldo.invalid');
  });

  it('is recognised whatever its case', () => {
    expect(isSyntheticEmail('abc@passkey.saldo.invalid')).toBe(true);
    expect(isSyntheticEmail('ABC@Passkey.Saldo.Invalid')).toBe(true);
    expect(isSyntheticEmail('ada@example.com')).toBe(false);
    // Not ours: the domain has to be the whole of it, not a suffix somebody chose.
    expect(isSyntheticEmail('ada@evil-passkey.saldo.invalid')).toBe(false);
  });
});

describe('emailIsTaken', () => {
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

  it('is false on an empty instance', async () => {
    expect(await emailIsTaken(harness.db, 'ada@example.com')).toBe(false);
  });

  it('is true whatever the case the row was stored in', async () => {
    await harness.db
      .insert(user)
      .values({ id: 'u1', name: 'Ada', email: 'Ada@Example.com', emailVerified: false });
    expect(await emailIsTaken(harness.db, 'ada@example.com')).toBe(true);
  });

  it('ignores the account it is asked to ignore, so a save of the same address is not a clash', async () => {
    await harness.db
      .insert(user)
      .values({ id: 'u1', name: 'Ada', email: 'ada@example.com', emailVerified: false });
    expect(await emailIsTaken(harness.db, 'ada@example.com', 'u1')).toBe(false);
    expect(await emailIsTaken(harness.db, 'ada@example.com', 'u2')).toBe(true);
  });
});
