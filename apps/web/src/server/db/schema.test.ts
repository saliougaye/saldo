import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { passkeys, users } from './schema';

let harness: TestDatabase;

beforeAll(async () => {
  harness = await createTestDatabase();
});

afterAll(async () => {
  await harness.close();
});

describe('schema', () => {
  it('round-trips a passkey, keeping the public key bytes and the transports array', async () => {
    const { db } = harness;
    const [user] = await db.insert(users).values({ displayName: 'Ada' }).returning();
    if (user === undefined) throw new Error('insert returned no row');

    await db.insert(passkeys).values({
      id: 'Y3JlZC1pZA',
      userId: user.id,
      publicKey: new Uint8Array([1, 2, 3, 250]),
      counter: 0,
      transports: ['internal', 'hybrid'],
      deviceType: 'multiDevice',
      backedUp: true,
    });

    const [row] = await db.select().from(passkeys).where(eq(passkeys.userId, user.id));
    if (row === undefined) throw new Error('select returned no row');
    expect(row.publicKey).toBeInstanceOf(Uint8Array);
    expect([...row.publicKey]).toEqual([1, 2, 3, 250]);
    expect(row.transports).toEqual(['internal', 'hybrid']);
    expect(row.lastUsedAt).toBeNull();
  });
});
