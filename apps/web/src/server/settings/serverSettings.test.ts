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
  smtpForSending,
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
const wrongKey = Buffer.alloc(32, 'B');
// Not a real password.
const PASSWORD = 'fake-password-for-tests';
const NOW = new Date('2026-09-30T09:00:00.000Z');

const noEnv: SettingsSource = {
  registration: null,
  instanceName: null,
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
  it('is all defaults on an empty table', async () => {
    const settings = await readServerSettings(harness.db, noEnv);
    expect(settings.registration).toEqual({ value: 'first-user', source: 'default', envVar: null });
    expect(settings.instanceName).toEqual({
      value: 'Saldo test',
      source: 'default',
      envVar: null,
    });
    expect(settings.smtp.value).toBeNull();
  });

  it('lets a row win over the default', async () => {
    await put('registration', 'closed');
    await put('instanceName', 'Casa Gaye');
    const settings = await readServerSettings(harness.db, noEnv);
    expect(settings.registration).toMatchObject({ value: 'closed', source: 'database' });
    expect(settings.instanceName).toMatchObject({ value: 'Casa Gaye', source: 'database' });
  });

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

describe('the narrow readers', () => {
  it('registrationMode and instanceName answer the resolved value', async () => {
    await put('instanceName', 'Casa Gaye');
    expect(await registrationMode(harness.db, noEnv)).toBe('first-user');
    expect(await instanceName(harness.db, noEnv)).toBe('Casa Gaye');
    expect(await registrationMode(harness.db, { ...noEnv, registration: 'open' })).toBe('open');
  });

  it('read the process environment when not handed one', async () => {
    // vitest.config.mts sets REGISTRATION=open and WEBAUTHN_RP_NAME='Saldo test'.
    expect(await registrationMode(harness.db)).toBe('open');
    expect(await instanceName(harness.db)).toBe('Saldo test');
  });
});

describe('smtpView', () => {
  it('is null, not configured, with nothing set', async () => {
    expect(await smtpView(harness.db, noEnv)).toEqual({
      value: null,
      source: 'default',
      envVar: null,
    });
  });

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

  it('says no password is set, and that nothing is unreadable, when there is none', async () => {
    await put('smtp', smtpRow(null));
    expect((await smtpView(harness.db, noEnv)).value).toMatchObject({
      user: null,
      passwordSet: false,
      passwordReadable: true,
    });
  });

  it('says a password no longer reads when the key changed', async () => {
    await put('smtp', smtpRow(encryptSecret(PASSWORD, wrongKey, 'smtp.password')));
    expect((await smtpView(harness.db, noEnv)).value).toMatchObject({
      passwordSet: true,
      passwordReadable: false,
    });
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

describe('smtpForSending', () => {
  it('is null when nothing is configured', async () => {
    expect(await smtpForSending(harness.db, noEnv)).toBeNull();
  });

  it('decrypts the stored password', async () => {
    await put('smtp', smtpRow(encryptSecret(PASSWORD, key, 'smtp.password')));
    expect(await smtpForSending(harness.db, noEnv)).toEqual({
      host: 'localhost',
      port: 1025,
      user: 'mailer',
      password: PASSWORD,
      from: 'Saldo <saldo@example.com>',
    });
  });

  it('works without a password (a catcher such as Mailpit)', async () => {
    await put('smtp', smtpRow(null));
    expect(await smtpForSending(harness.db, noEnv)).toMatchObject({ user: null, password: null });
  });

  it('is null when the password no longer decrypts', async () => {
    await put('smtp', smtpRow(encryptSecret(PASSWORD, wrongKey, 'smtp.password')));
    expect(await smtpForSending(harness.db, noEnv)).toBeNull();
  });

  it('is null for a password sealed under another slot', async () => {
    await put('smtp', smtpRow(encryptSecret(PASSWORD, key, 'ai.apiKey')));
    expect(await smtpForSending(harness.db, noEnv)).toBeNull();
  });

  it('uses the environment group as it is, with its plain password', async () => {
    await put('smtp', smtpRow(encryptSecret(PASSWORD, key, 'smtp.password')));
    const fromEnv = {
      host: 'smtp.env.example',
      port: 465,
      user: 'env-mailer',
      password: 'env-password',
      from: 'saldo@env.example',
    };
    expect(await smtpForSending(harness.db, { ...noEnv, smtp: fromEnv })).toEqual(fromEnv);
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

  it('does not ask the table at all when the environment sets the value', async () => {
    expect(await registrationMode(broken, { ...noEnv, registration: 'closed' })).toBe('closed');
    expect(await instanceName(broken, { ...noEnv, instanceName: 'Casa' })).toBe('Casa');
  });
});
