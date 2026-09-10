import { isNull } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { refreshTokens, users } from '../db/schema';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import {
  ACCESS_TTL_SECONDS,
  issueAccessToken,
  issueRefreshToken,
  REFRESH_TTL_DAYS,
  revokeRefreshToken,
  rotateRefreshToken,
  verifyAccessToken,
} from './tokens';

let harness: TestDatabase;
const T0 = new Date('2026-09-10T10:00:00.000Z');
const SUBJECT = '11111111-1111-4111-8111-111111111111';

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

describe('access tokens', () => {
  it('round-trips the subject', async () => {
    const token = await issueAccessToken(SUBJECT, T0);
    await expect(verifyAccessToken(token, T0)).resolves.toEqual({ userId: SUBJECT });
  });

  it('expires after the documented lifetime', async () => {
    const token = await issueAccessToken(SUBJECT, T0);
    const late = new Date(T0.getTime() + (ACCESS_TTL_SECONDS + 2) * 1000);
    await expect(verifyAccessToken(token, late)).rejects.toMatchObject({ status: 401 });
  });

  it('rejects a token that was not signed by this server', async () => {
    await expect(verifyAccessToken('not.a.jwt', T0)).rejects.toMatchObject({ status: 401 });
  });
});

describe('refresh tokens', () => {
  it('rotates: the old token dies, the new one works, and the chain is linked', async () => {
    const userId = await seedUser();
    const first = await issueRefreshToken(harness.db, { userId, deviceName: 'iPhone' }, T0);
    const rotated = await rotateRefreshToken(harness.db, first, T0);
    expect(rotated.userId).toBe(userId);
    expect(rotated.refreshToken).not.toBe(first);

    const rows = await harness.db.select().from(refreshTokens);
    expect(rows).toHaveLength(2);
    const [old] = rows.filter((row) => row.revokedAt !== null);
    expect(old?.replacedBy).not.toBeNull();

    const again = await rotateRefreshToken(harness.db, rotated.refreshToken, T0);
    expect(again.userId).toBe(userId);
  });

  it('detects reuse and revokes the whole live chain', async () => {
    const userId = await seedUser();
    const first = await issueRefreshToken(harness.db, { userId, deviceName: 'iPhone' }, T0);
    const second = await rotateRefreshToken(harness.db, first, T0);
    const third = await rotateRefreshToken(harness.db, second.refreshToken, T0);

    await expect(rotateRefreshToken(harness.db, first, T0)).rejects.toMatchObject({
      code: 'invalid_grant',
      status: 401,
    });
    // Every token of that chain is now dead, including the one the thief did not have.
    await expect(rotateRefreshToken(harness.db, third.refreshToken, T0)).rejects.toMatchObject({
      code: 'invalid_grant',
    });
    const live = await harness.db
      .select()
      .from(refreshTokens)
      .where(isNull(refreshTokens.revokedAt));
    expect(live).toEqual([]);
  });

  it('rejects an unknown or expired token', async () => {
    const userId = await seedUser();
    const token = await issueRefreshToken(harness.db, { userId, deviceName: 'iPhone' }, T0);
    await expect(rotateRefreshToken(harness.db, 'nope', T0)).rejects.toMatchObject({
      code: 'invalid_grant',
    });
    const late = new Date(T0.getTime() + 200 * 24 * 3600 * 1000);
    await expect(rotateRefreshToken(harness.db, token, late)).rejects.toMatchObject({
      code: 'invalid_grant',
    });
  });

  it('rejects a refresh token at the exact expiry instant', async () => {
    const userId = await seedUser();
    const token = await issueRefreshToken(harness.db, { userId, deviceName: 'iPhone' }, T0);
    const exactly = new Date(T0.getTime() + REFRESH_TTL_DAYS * 24 * 3600 * 1000);
    await expect(rotateRefreshToken(harness.db, token, exactly)).rejects.toMatchObject({
      code: 'invalid_grant',
    });
  });

  it('revokes on logout, and a second logout is not an error', async () => {
    const userId = await seedUser();
    const token = await issueRefreshToken(harness.db, { userId, deviceName: 'iPhone' }, T0);
    await revokeRefreshToken(harness.db, token, T0);
    const [row] = await harness.db.select().from(refreshTokens);
    expect(row?.revokedAt).not.toBeNull();
    await expect(revokeRefreshToken(harness.db, token, T0)).resolves.toBeUndefined();
  });
});
