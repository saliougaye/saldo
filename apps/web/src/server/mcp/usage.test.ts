import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { settleBackground } from '../background';
import { mcpUsage } from '../db/schema';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { createTestClient } from '../test/oauth';
import { createTestSession } from '../test/session';
import { forgetMcpUsage, recordMcpUsage, resetMcpUsageForTests } from './usage';

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

const T0 = new Date('2026-10-03T09:00:00.000Z');
const at = (seconds: number) => new Date(T0.getTime() + seconds * 1000);

async function rows() {
  await settleBackground();
  return harness.db.select().from(mcpUsage);
}

describe('recordMcpUsage', () => {
  it('writes the first call of a pair at once', async () => {
    const { userId } = await createTestSession(harness.db);
    const { clientId } = await createTestClient(harness.db);
    recordMcpUsage(userId, clientId, T0);
    expect(await rows()).toEqual([{ userId, clientId, lastUsedAt: T0, calls: 1 }]);
  });

  it('counts the calls of the next minute and writes them with the first call after it', async () => {
    const { userId } = await createTestSession(harness.db);
    const { clientId } = await createTestClient(harness.db);
    recordMcpUsage(userId, clientId, T0);
    recordMcpUsage(userId, clientId, at(10));
    recordMcpUsage(userId, clientId, at(59));
    expect(await rows()).toEqual([{ userId, clientId, lastUsedAt: T0, calls: 1 }]);
    recordMcpUsage(userId, clientId, at(61));
    expect(await rows()).toEqual([{ userId, clientId, lastUsedAt: at(61), calls: 4 }]);
  });

  it('keeps each (user, client) pair apart', async () => {
    const ada = await createTestSession(harness.db, 'Ada');
    const bob = await createTestSession(harness.db, 'Bob');
    const { clientId } = await createTestClient(harness.db);
    recordMcpUsage(ada.userId, clientId, T0);
    recordMcpUsage(bob.userId, clientId, at(1));
    const stored = await rows();
    expect(stored).toHaveLength(2);
    expect(stored.every((row) => row.calls === 1)).toBe(true);
  });

  it('forgets what was counted for a revoked pair', async () => {
    const { userId } = await createTestSession(harness.db);
    const { clientId } = await createTestClient(harness.db);
    recordMcpUsage(userId, clientId, T0);
    recordMcpUsage(userId, clientId, at(5));
    await settleBackground();
    await harness.db.delete(mcpUsage);
    forgetMcpUsage(userId, clientId);
    recordMcpUsage(userId, clientId, at(6));
    expect(await rows()).toEqual([{ userId, clientId, lastUsedAt: at(6), calls: 1 }]);
  });
});
