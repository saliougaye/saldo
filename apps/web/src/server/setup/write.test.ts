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
  it('writes the name and the mode, by nobody', async () => {
    const result = await saveSetupServer(
      harness.db,
      { name: '  Casa Rossi ', mode: 'invite' },
      now,
      noEnv,
    );
    expect(result).toEqual({ ok: true });
    await expect(row('instanceName')).resolves.toBe('Casa Rossi');
    await expect(row('registration')).resolves.toBe('invite');
    const [saved] = await harness.db
      .select({ updatedBy: serverSettings.updatedBy })
      .from(serverSettings)
      .where(eq(serverSettings.key, 'registration'));
    expect(saved?.updatedBy).toBeNull();
  });

  it('an empty name leaves no row, so the default name applies', async () => {
    await saveSetupServer(harness.db, { name: 'Casa Rossi', mode: 'open' }, now, noEnv);
    const result = await saveSetupServer(harness.db, { name: '', mode: 'open' }, now, noEnv);
    expect(result).toEqual({ ok: true });
    await expect(row('instanceName')).resolves.toBeUndefined();
  });

  it('skips what the environment sets and writes the rest', async () => {
    const result = await saveSetupServer(harness.db, { name: 'Casa Rossi', mode: 'closed' }, now, {
      ...noEnv,
      registration: 'invite',
    });
    expect(result).toEqual({ ok: true });
    await expect(row('instanceName')).resolves.toBe('Casa Rossi');
    await expect(row('registration')).resolves.toBeUndefined();
  });

  it('refuses a mode the wizard does not offer, and a name over 60 characters', async () => {
    await expect(
      saveSetupServer(harness.db, { name: 'Casa', mode: 'first-user' }, now, noEnv),
    ).resolves.toEqual({ ok: false, error: 'invalid' });
    await expect(
      saveSetupServer(harness.db, { name: 'x'.repeat(61), mode: 'open' }, now, noEnv),
    ).resolves.toEqual({ ok: false, error: 'invalid' });
    await expect(saveSetupServer(harness.db, 'nonsense', now, noEnv)).resolves.toEqual({
      ok: false,
      error: 'invalid',
    });
    await expect(row('instanceName')).resolves.toBeUndefined();
  });

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
