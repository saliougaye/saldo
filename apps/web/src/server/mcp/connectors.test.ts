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
import { revokeConnector } from './connectors';
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
