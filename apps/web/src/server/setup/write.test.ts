import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { serverSettings, user } from '../db/schema';
import type { SettingsSource } from '../settings/serverSettings';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { saveSetupServer } from './write';

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

const now = new Date('2026-10-03T09:00:00Z');
const key = Buffer.alloc(32, 'A');

const noEnv: SettingsSource = {
  registration: null,
  instanceName: null,
  mcpEnabled: null,
  rpName: 'Saldo test',
  smtp: null,
  settingsKey: key,
};

async function row(key: string): Promise<unknown> {
  const [found] = await harness.db
    .select({ value: serverSettings.value })
    .from(serverSettings)
    .where(eq(serverSettings.key, key));
  return found?.value;
}

describe('saveSetupServer', () => {
  it('refuses once an account exists: the panel is the way from then on', async () => {
    await harness.db.insert(user).values({
      id: crypto.randomUUID(),
      name: 'Ada',
      email: 'ada@example.com',
      emailVerified: false,
    });
    const result = await saveSetupServer(
      harness.db,
      { name: 'Casa Rossi', mode: 'open' },
      now,
      noEnv,
    );
    expect(result).toEqual({ ok: false, error: 'alreadySetUp' });
    await expect(row('instanceName')).resolves.toBeUndefined();
  });
});
