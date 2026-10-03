import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { serverSettings, user } from '../db/schema';
import type { SettingsSource } from '../settings/serverSettings';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { setupNeeded, setupState } from './state';

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

const key = Buffer.alloc(32, 'A');

/** Nothing set by the environment: every value comes from the table or the default. */
const noEnv: SettingsSource = {
  registration: null,
  instanceName: null,
  rpName: 'Saldo test',
  smtp: null,
  settingsKey: key,
};

async function addUser() {
  await harness.db.insert(user).values({
    id: crypto.randomUUID(),
    name: 'Ada',
    email: 'ada@example.com',
    emailVerified: false,
  });
}

describe('setupNeeded', () => {
  it('is true with no account and false with one', async () => {
    await expect(setupNeeded(harness.db)).resolves.toBe(true);
    await addUser();
    await expect(setupNeeded(harness.db)).resolves.toBe(false);
  });
});

describe('setupState', () => {
  it('on a bare instance: needed, the defaults, nothing locked, no mail', async () => {
    const state = await setupState(harness.db, noEnv);
    expect(state.needed).toBe(true);
    expect(state.instanceName).toEqual({ value: 'Saldo test', source: 'default', locked: false });
    expect(state.registration).toEqual({ value: 'first-user', source: 'default', locked: false });
    expect(state.lockedVariables).toEqual([]);
    expect(state.mail).toBe('none');
  });

  it('reads a saved name and mode as coming from the database', async () => {
    const now = new Date();
    await harness.db.insert(serverSettings).values([
      { key: 'instanceName', value: 'Casa Rossi', updatedAt: now, updatedBy: null },
      { key: 'registration', value: 'invite', updatedAt: now, updatedBy: null },
    ]);
    const state = await setupState(harness.db, noEnv);
    expect(state.instanceName).toEqual({ value: 'Casa Rossi', source: 'database', locked: false });
    expect(state.registration).toEqual({ value: 'invite', source: 'database', locked: false });
  });

  it('marks what the environment sets as locked and names the variables', async () => {
    const state = await setupState(harness.db, {
      ...noEnv,
      registration: 'invite',
      instanceName: 'Casa Rossi',
    });
    expect(state.instanceName).toEqual({ value: 'Casa Rossi', source: 'env', locked: true });
    expect(state.registration).toEqual({ value: 'invite', source: 'env', locked: true });
    expect(state.lockedVariables).toEqual(['INSTANCE_NAME', 'REGISTRATION']);
  });

  it('reports mail from the environment', async () => {
    const state = await setupState(harness.db, {
      ...noEnv,
      smtp: {
        host: 'smtp.example.com',
        port: 587,
        user: null,
        password: null,
        from: 'saldo@example.com',
      },
    });
    expect(state.mail).toBe('env');
  });

  it('reports a stored configuration as configured', async () => {
    await harness.db.insert(serverSettings).values({
      key: 'smtp',
      value: {
        host: 'smtp.example.com',
        port: 587,
        user: null,
        password: null,
        from: 'saldo@example.com',
      },
      updatedAt: new Date(),
      updatedBy: null,
    });
    const state = await setupState(harness.db, noEnv);
    expect(state.mail).toBe('configured');
  });

  it('is not needed once an account exists', async () => {
    await addUser();
    const state = await setupState(harness.db, noEnv);
    expect(state.needed).toBe(false);
  });
});
