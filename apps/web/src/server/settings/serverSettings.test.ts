import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { schema, serverSettings } from '../db/schema';
import type { ServerDatabase } from '../db/types';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { encryptSecret } from './secret';
import {
  instanceName,
  readServerSettings,
  registrationMode,
  type SettingsSource,
  smtpView,
} from './serverSettings';

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
// Not a real password.
const PASSWORD = 'fake-password-for-tests';
const NOW = new Date('2026-09-30T09:00:00.000Z');

const noEnv: SettingsSource = {
  registration: null,
  instanceName: null,
  mcpEnabled: null,
  rpName: 'Saldo test',
  smtp: null,
  settingsKey: key,
};

async function put(name: string, value: unknown) {
  await harness.db
    .insert(serverSettings)
    .values({ key: name, value, updatedAt: NOW, updatedBy: null });
}

const smtpRow = (password: string | null) => ({
  host: 'localhost',
  port: 1025,
  user: password === null ? null : 'mailer',
  password,
  from: 'Saldo <saldo@example.com>',
});

describe('readServerSettings', () => {
  it('lets the environment win over a row', async () => {
    await put('registration', 'closed');
    await put('instanceName', 'Casa Gaye');
    const settings = await readServerSettings(harness.db, {
      ...noEnv,
      registration: 'invite',
      instanceName: 'Da env',
    });
    expect(settings.registration).toMatchObject({ value: 'invite', source: 'env' });
    expect(settings.instanceName).toMatchObject({ value: 'Da env', source: 'env' });
  });

  it('reads a hand-edited row as not set', async () => {
    await put('registration', 'sometimes');
    expect((await readServerSettings(harness.db, noEnv)).registration.source).toBe('default');
  });

  it('follows the table: the next read sees a changed row', async () => {
    expect(await registrationMode(harness.db, noEnv)).toBe('first-user');
    await put('registration', 'open');
    expect(await registrationMode(harness.db, noEnv)).toBe('open');
  });
});

describe('smtpView', () => {
  it('never carries the password or its envelope', async () => {
    const envelope = encryptSecret(PASSWORD, key, 'smtp.password');
    await put('smtp', smtpRow(envelope));
    const view = await smtpView(harness.db, noEnv);
    expect(view.source).toBe('database');
    expect(view.value).toEqual({
      host: 'localhost',
      port: 1025,
      user: 'mailer',
      from: 'Saldo <saldo@example.com>',
      passwordSet: true,
      passwordReadable: true,
    });
    const serialised = JSON.stringify(view);
    expect(serialised).not.toContain(PASSWORD);
    expect(serialised).not.toContain(envelope);
    expect(serialised).not.toContain('v1:');
  });

  it('shows the environment group, locked, without its password', async () => {
    await put('smtp', smtpRow(null));
    const view = await smtpView(harness.db, {
      ...noEnv,
      smtp: {
        host: 'smtp.env.example',
        port: 587,
        user: 'mailer',
        password: PASSWORD,
        from: 'saldo@env.example',
      },
    });
    expect(view).toMatchObject({ source: 'env', envVar: 'SMTP_HOST' });
    expect(view.value).toMatchObject({ host: 'smtp.env.example', passwordSet: true });
    expect(JSON.stringify(view)).not.toContain(PASSWORD);
  });
});

describe('registrationMode and instanceName when the settings cannot be read', () => {
  // A database that was never migrated: there is no `server_settings` to read.
  const client = new PGlite();
  const broken: ServerDatabase = drizzle(client, { schema });
  afterAll(() => client.close());

  it('rejects, rather than answering with a default, when the mode is not locked', async () => {
    await expect(registrationMode(broken, noEnv)).rejects.toThrow();
    await expect(instanceName(broken, noEnv)).rejects.toThrow();
  });
});
