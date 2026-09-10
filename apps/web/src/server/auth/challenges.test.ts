import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { webauthnChallenges } from '../db/schema';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { CHALLENGE_TTL_MS, consumeChallenge, createChallenge } from './challenges';

let harness: TestDatabase;
const T0 = new Date('2026-09-10T10:00:00.000Z');

beforeAll(async () => {
  harness = await createTestDatabase();
});

afterEach(async () => {
  await harness.reset();
});

afterAll(async () => {
  await harness.close();
});

describe('challenges', () => {
  it('stores a challenge and consumes it exactly once', async () => {
    await createChallenge(harness.db, { challenge: 'abc', kind: 'login' }, T0);
    const found = await consumeChallenge(harness.db, 'abc', 'login', T0);
    expect(found.displayName).toBeNull();
    await expect(consumeChallenge(harness.db, 'abc', 'login', T0)).rejects.toMatchObject({
      code: 'challenge_not_found',
      status: 400,
    });
  });

  it('keeps the pending display name of a registration ceremony', async () => {
    await createChallenge(
      harness.db,
      { challenge: 'reg', kind: 'register', displayName: 'Ada' },
      T0,
    );
    await expect(consumeChallenge(harness.db, 'reg', 'register', T0)).resolves.toMatchObject({
      displayName: 'Ada',
    });
  });

  it('refuses a challenge of the wrong kind', async () => {
    await createChallenge(harness.db, { challenge: 'abc', kind: 'login' }, T0);
    await expect(consumeChallenge(harness.db, 'abc', 'register', T0)).rejects.toMatchObject({
      code: 'challenge_not_found',
    });
  });

  it('refuses a challenge at the exact expiry instant', async () => {
    await createChallenge(harness.db, { challenge: 'abc', kind: 'login' }, T0);
    const exactly = new Date(T0.getTime() + CHALLENGE_TTL_MS);
    await expect(consumeChallenge(harness.db, 'abc', 'login', exactly)).rejects.toMatchObject({
      code: 'challenge_expired',
    });
  });

  it('refuses an expired challenge and clears it', async () => {
    await createChallenge(harness.db, { challenge: 'abc', kind: 'login' }, T0);
    const late = new Date(T0.getTime() + CHALLENGE_TTL_MS + 1);
    await expect(consumeChallenge(harness.db, 'abc', 'login', late)).rejects.toMatchObject({
      code: 'challenge_expired',
    });
    await expect(harness.db.select().from(webauthnChallenges)).resolves.toEqual([]);
  });
});
