import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { user } from '../db/schema';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { createTestSession } from '../test/session';
import { MAX_DISPLAY_NAME_LENGTH, renameAccount } from './displayName';
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

const NOW = new Date('2026-10-24T09:00:00.000Z');

async function nameOf(userId: string): Promise<string | undefined> {
  const [row] = await harness.db.select({ name: user.name }).from(user).where(eq(user.id, userId));
  return row?.name;
}

describe('renameAccount', () => {
  it('renames the account, trimmed, and the next session read shows the new name', async () => {
    const ada = await createTestSession(harness.db, 'Ada');
    const result = await renameAccount(harness.db, ada.userId, '  Ada Lovelace ', NOW);
    expect(result).toEqual({ ok: true, name: 'Ada Lovelace' });
    const signedIn = await authenticate(new Headers({ authorization: ada.bearer }));
    expect(signedIn?.displayName).toBe('Ada Lovelace');
  });

  it('changes only the account it is given, never another one', async () => {
    const ada = await createTestSession(harness.db, 'Ada');
    const bob = await createTestSession(harness.db, 'Bob');
    await renameAccount(harness.db, ada.userId, 'Ada L.', NOW);
    expect(await nameOf(ada.userId)).toBe('Ada L.');
    expect(await nameOf(bob.userId)).toBe('Bob');
  });

  it('refuses an empty name, a name of blanks, a value that is not text and a name too long', async () => {
    const ada = await createTestSession(harness.db, 'Ada');
    for (const input of ['', '   ', null, 42, { name: 'Eve' }]) {
      expect(await renameAccount(harness.db, ada.userId, input, NOW)).toEqual({
        ok: false,
        reason: 'empty',
      });
    }
    expect(
      await renameAccount(harness.db, ada.userId, 'x'.repeat(MAX_DISPLAY_NAME_LENGTH + 1), NOW),
    ).toEqual({ ok: false, reason: 'tooLong' });
    expect(await nameOf(ada.userId)).toBe('Ada');
  });

  it('answers notFound for an account that no longer exists', async () => {
    const result = await renameAccount(harness.db, crypto.randomUUID(), 'Ghost', NOW);
    expect(result).toEqual({ ok: false, reason: 'notFound' });
  });
});
