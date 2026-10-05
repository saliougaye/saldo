import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { createTestSession } from '../test/session';
import {
  mcpUsage,
  oauthAccessToken,
  oauthClient,
  oauthConsent,
  oauthRefreshToken,
  user,
} from './schema';

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

describe('oauth tables and mcp_usage', () => {
  async function client(clientId: string) {
    await harness.db.insert(oauthClient).values({
      id: crypto.randomUUID(),
      clientId,
      name: 'Claude Code',
      redirectUris: ['http://localhost:33418/callback'],
      scopes: ['read', 'write', 'offline_access'],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  it('deleting an account carries its consents, tokens and usage away', async () => {
    const { db } = harness;
    const { userId } = await createTestSession(db);
    await client('c-1');
    const now = new Date();
    const later = new Date(now.getTime() + 3_600_000);
    await db.insert(oauthConsent).values({
      id: crypto.randomUUID(),
      clientId: 'c-1',
      userId,
      scopes: ['read'],
      createdAt: now,
      updatedAt: now,
    });
    const refreshId = crypto.randomUUID();
    await db.insert(oauthRefreshToken).values({
      id: refreshId,
      token: 'r-hash',
      clientId: 'c-1',
      userId,
      scopes: ['read', 'offline_access'],
      expiresAt: later,
      createdAt: now,
    });
    await db.insert(oauthAccessToken).values({
      id: crypto.randomUUID(),
      token: 'a-hash',
      clientId: 'c-1',
      userId,
      refreshId,
      scopes: ['read'],
      resources: ['http://localhost:3000/mcp'],
      expiresAt: later,
      createdAt: now,
    });
    await db.insert(mcpUsage).values({ userId, clientId: 'c-1', lastUsedAt: now, calls: 1 });

    await db.delete(user).where(eq(user.id, userId));

    expect(await db.select().from(oauthConsent)).toEqual([]);
    expect(await db.select().from(oauthAccessToken)).toEqual([]);
    expect(await db.select().from(oauthRefreshToken)).toEqual([]);
    expect(await db.select().from(mcpUsage)).toEqual([]);
    // The client registered itself; it is nobody's account and stays.
    expect(await db.select().from(oauthClient)).toHaveLength(1);
  });
});
