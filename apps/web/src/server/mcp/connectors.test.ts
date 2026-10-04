import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { settleBackground } from '../background';
import { mcpUsage, oauthAccessToken, oauthConsent, oauthRefreshToken } from '../db/schema';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import {
  createTestClient,
  grantTestConsent,
  issueTestAccessToken,
  issueTestRefreshToken,
} from '../test/oauth';
import { createTestSession } from '../test/session';
import { listConnectors, mcpAdminStats, revokeConnector } from './connectors';
import { resetMcpUsageForTests } from './usage';

let harness: TestDatabase;

beforeAll(async () => {
  harness = await createTestDatabase();
});

beforeEach(() => {
  resetMcpUsageForTests();
});

afterEach(async () => {
  await settleBackground();
  await harness.reset();
});

afterAll(async () => {
  await harness.close();
});

const NOW = new Date('2026-10-03T09:00:00.000Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000);

describe('listConnectors', () => {
  it('lists one row per consent, newest first, with granted tool scopes and usage', async () => {
    const { userId } = await createTestSession(harness.db);
    const claude = await createTestClient(harness.db, {
      name: 'Claude',
      redirectUris: ['https://claude.ai/api/mcp/auth_callback'],
    });
    const code = await createTestClient(harness.db, { name: null });
    await grantTestConsent(harness.db, {
      userId,
      clientId: claude.clientId,
      scopes: ['read', 'write', 'offline_access'],
      at: daysAgo(10),
    });
    await grantTestConsent(harness.db, {
      userId,
      clientId: code.clientId,
      scopes: ['read'],
      at: daysAgo(1),
    });
    await harness.db
      .insert(mcpUsage)
      .values({ userId, clientId: claude.clientId, lastUsedAt: daysAgo(2), calls: 42 });

    expect(await listConnectors(userId)).toEqual([
      {
        clientId: code.clientId,
        name: code.clientId,
        redirectHost: 'localhost:33418',
        scopes: ['read'],
        authorizedAt: daysAgo(1),
        lastUsedAt: null,
        calls: 0,
      },
      {
        clientId: claude.clientId,
        name: 'Claude',
        redirectHost: 'claude.ai',
        scopes: ['read', 'write'],
        authorizedAt: daysAgo(10),
        lastUsedAt: daysAgo(2),
        calls: 42,
      },
    ]);
  });

  it('shows nobody else’s consents', async () => {
    const ada = await createTestSession(harness.db, 'Ada');
    const bob = await createTestSession(harness.db, 'Bob');
    const { clientId } = await createTestClient(harness.db);
    await grantTestConsent(harness.db, { userId: bob.userId, clientId, scopes: ['read'] });
    expect(await listConnectors(ada.userId)).toEqual([]);
  });
});

describe('revokeConnector', () => {
  it('deletes the pair’s consent, tokens and usage, and nothing of anyone else', async () => {
    const ada = await createTestSession(harness.db, 'Ada');
    const bob = await createTestSession(harness.db, 'Bob');
    const { clientId } = await createTestClient(harness.db);
    for (const { userId } of [ada, bob]) {
      await grantTestConsent(harness.db, { userId, clientId, scopes: ['read', 'offline_access'] });
      await issueTestAccessToken(harness.db, { userId, clientId });
      await issueTestRefreshToken(harness.db, { userId, clientId });
      await harness.db.insert(mcpUsage).values({ userId, clientId, lastUsedAt: NOW, calls: 1 });
    }

    await revokeConnector(ada.userId, clientId);

    for (const table of [oauthConsent, oauthAccessToken, oauthRefreshToken, mcpUsage]) {
      const rows = await harness.db.select({ userId: table.userId }).from(table);
      expect(rows).toEqual([{ userId: bob.userId }]);
    }
  });
});

describe('mcpAdminStats', () => {
  it('counts users with an app, all users, consents, and pairs used in the last 7 days', async () => {
    const ada = await createTestSession(harness.db, 'Ada');
    const bob = await createTestSession(harness.db, 'Bob');
    await createTestSession(harness.db, 'Cleo');
    const one = await createTestClient(harness.db);
    const two = await createTestClient(harness.db);
    await grantTestConsent(harness.db, {
      userId: ada.userId,
      clientId: one.clientId,
      scopes: ['read'],
    });
    await grantTestConsent(harness.db, {
      userId: ada.userId,
      clientId: two.clientId,
      scopes: ['read'],
    });
    await grantTestConsent(harness.db, {
      userId: bob.userId,
      clientId: one.clientId,
      scopes: ['read'],
    });
    await harness.db.insert(mcpUsage).values([
      { userId: ada.userId, clientId: one.clientId, lastUsedAt: daysAgo(1), calls: 5 },
      { userId: ada.userId, clientId: two.clientId, lastUsedAt: daysAgo(8), calls: 5 },
      { userId: bob.userId, clientId: one.clientId, lastUsedAt: daysAgo(6), calls: 5 },
    ]);
    expect(await mcpAdminStats(NOW)).toEqual({
      usersWithConnectors: 2,
      totalUsers: 3,
      connectorsAuthorized: 3,
      connectorsUsedLast7Days: 2,
    });
  });
});
