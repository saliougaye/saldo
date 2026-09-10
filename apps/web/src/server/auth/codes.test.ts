import { createHash } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { users } from '../db/schema';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { CODE_TTL_MS, consumeAuthCode, createAuthCode, validateRedirectUri } from './codes';

let harness: TestDatabase;
const T0 = new Date('2026-09-10T10:00:00.000Z');
const VERIFIER = 'a'.repeat(64);
const CHALLENGE = createHash('sha256').update(VERIFIER).digest('base64url');

async function seedUser(): Promise<string> {
  const [user] = await harness.db.insert(users).values({ displayName: 'Ada' }).returning();
  if (user === undefined) throw new Error('insert returned no row');
  return user.id;
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

describe('validateRedirectUri', () => {
  it('accepts an allow-listed scheme and rejects anything else', () => {
    expect(validateRedirectUri('saldo://auth/callback', ['saldo'])).toBe('saldo://auth/callback');
    expect(() => validateRedirectUri('https://evil.example/cb', ['saldo'])).toThrow(/redirect_uri/);
    expect(() => validateRedirectUri('not a uri', ['saldo'])).toThrow(/redirect_uri/);
  });
});

describe('auth codes', () => {
  it('mints a code that is exchanged once, with the right verifier', async () => {
    const userId = await seedUser();
    const { code, redirect } = await createAuthCode(
      harness.db,
      { userId, codeChallenge: CHALLENGE, redirectUri: 'saldo://auth/callback', state: 'st4te' },
      T0,
    );
    expect(redirect).toBe(`saldo://auth/callback?code=${encodeURIComponent(code)}&state=st4te`);

    await expect(consumeAuthCode(harness.db, code, VERIFIER, T0)).resolves.toEqual({ userId });
    await expect(consumeAuthCode(harness.db, code, VERIFIER, T0)).rejects.toMatchObject({
      code: 'invalid_grant',
    });
  });

  it('rejects a mismatched verifier without consuming the code', async () => {
    const userId = await seedUser();
    const { code } = await createAuthCode(
      harness.db,
      { userId, codeChallenge: CHALLENGE, redirectUri: 'saldo://auth/callback', state: 's' },
      T0,
    );
    await expect(consumeAuthCode(harness.db, code, 'b'.repeat(64), T0)).rejects.toMatchObject({
      code: 'invalid_grant',
    });
    // Still usable with the correct verifier: a wrong guess must not burn the code.
    await expect(consumeAuthCode(harness.db, code, VERIFIER, T0)).resolves.toEqual({ userId });
  });

  it('rejects an expired code', async () => {
    const userId = await seedUser();
    const { code } = await createAuthCode(
      harness.db,
      { userId, codeChallenge: CHALLENGE, redirectUri: 'saldo://auth/callback', state: 's' },
      T0,
    );
    const late = new Date(T0.getTime() + CODE_TTL_MS + 1);
    await expect(consumeAuthCode(harness.db, code, VERIFIER, late)).rejects.toMatchObject({
      code: 'invalid_grant',
    });
  });

  it('rejects a code at the exact expiry instant', async () => {
    const userId = await seedUser();
    const { code } = await createAuthCode(
      harness.db,
      { userId, codeChallenge: CHALLENGE, redirectUri: 'saldo://auth/callback', state: 's' },
      T0,
    );
    const exactly = new Date(T0.getTime() + CODE_TTL_MS);
    await expect(consumeAuthCode(harness.db, code, VERIFIER, exactly)).rejects.toMatchObject({
      code: 'invalid_grant',
    });
  });

  it('rejects an unknown code', async () => {
    await expect(consumeAuthCode(harness.db, 'nope', VERIFIER, T0)).rejects.toMatchObject({
      code: 'invalid_grant',
    });
  });
});
