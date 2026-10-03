import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { serverSettings } from '../db/schema';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { createTestSession } from '../test/session';
import { smtpRowSchema } from './resolve';
import { decryptSecret } from './secret';
import {
  instanceName,
  mcpEnabled,
  registrationMode,
  type SettingsSource,
  SMTP_PASSWORD_SLOT,
  smtpForSending,
  smtpView,
} from './serverSettings';
import { removeSmtp, saveInstanceName, saveMcpEnabled, saveRegistration, saveSmtp } from './write';

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
const LATER = new Date('2026-10-01T09:00:00.000Z');

const noEnv: SettingsSource = {
  registration: null,
  instanceName: null,
  mcpEnabled: null,
  rpName: 'Saldo test',
  smtp: null,
  settingsKey: key,
};

const envSmtp = {
  host: 'smtp.env.example',
  port: 587,
  user: 'env-mailer',
  password: 'env-password',
  from: 'saldo@env.example',
};

const smtpInput = {
  host: 'smtp.example.com',
  port: 587,
  user: 'mailer',
  from: 'Saldo <saldo@example.com>',
};

async function storedRow(name: string) {
  const [row] = await harness.db.select().from(serverSettings).where(eq(serverSettings.key, name));
  return row;
}

/** The stored `smtp` row as the resolver reads it: parsed, never cast. */
async function storedSmtp() {
  return smtpRowSchema.parse((await storedRow('smtp'))?.value);
}

describe('saveRegistration', () => {
  it('stores one of the four modes and stamps who and when', async () => {
    const { userId } = await createTestSession(harness.db, 'Ada', 'admin');
    expect(await saveRegistration(harness.db, userId, 'invite', NOW, noEnv)).toEqual({ ok: true });
    const row = await storedRow('registration');
    expect(row).toMatchObject({ value: 'invite', updatedBy: userId });
    expect(row?.updatedAt).toEqual(NOW);
    expect(await registrationMode(harness.db, noEnv)).toBe('invite');
  });

  it('upserts on the key, restamping', async () => {
    await saveRegistration(harness.db, null, 'open', NOW, noEnv);
    await saveRegistration(harness.db, null, 'closed', LATER, noEnv);
    const rows = await harness.db.select().from(serverSettings);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ value: 'closed' });
    expect(rows[0]?.updatedAt).toEqual(LATER);
  });

  it.each(['everyone', '', null, 3])('refuses %j as invalid', async (raw) => {
    expect(await saveRegistration(harness.db, null, raw, NOW, noEnv)).toEqual({
      ok: false,
      error: 'invalid',
    });
    expect(await storedRow('registration')).toBeUndefined();
  });

  it('is locked when REGISTRATION is set, and writes nothing', async () => {
    expect(
      await saveRegistration(harness.db, null, 'open', NOW, { ...noEnv, registration: 'closed' }),
    ).toEqual({ ok: false, error: 'locked' });
    expect(await storedRow('registration')).toBeUndefined();
  });
});

describe('saveInstanceName', () => {
  it('stores the trimmed name', async () => {
    expect(await saveInstanceName(harness.db, null, '  Casa Gaye ', NOW, noEnv)).toEqual({
      ok: true,
    });
    expect(await instanceName(harness.db, noEnv)).toBe('Casa Gaye');
  });

  it('deletes the row for an empty name, so the default returns', async () => {
    await saveInstanceName(harness.db, null, 'Casa Gaye', NOW, noEnv);
    expect(await saveInstanceName(harness.db, null, '   ', LATER, noEnv)).toEqual({ ok: true });
    expect(await storedRow('instanceName')).toBeUndefined();
    expect(await instanceName(harness.db, noEnv)).toBe('Saldo test');
  });

  it('refuses more than 60 characters, and anything that is not a string', async () => {
    expect(await saveInstanceName(harness.db, null, 'x'.repeat(61), NOW, noEnv)).toEqual({
      ok: false,
      error: 'invalid',
    });
    expect(await saveInstanceName(harness.db, null, 7, NOW, noEnv)).toEqual({
      ok: false,
      error: 'invalid',
    });
    expect(await saveInstanceName(harness.db, null, 'x'.repeat(60), NOW, noEnv)).toEqual({
      ok: true,
    });
  });

  it('is locked when INSTANCE_NAME is set, even to clear it', async () => {
    const locked = { ...noEnv, instanceName: 'Da env' };
    expect(await saveInstanceName(harness.db, null, 'Altro', NOW, locked)).toEqual({
      ok: false,
      error: 'locked',
    });
    expect(await saveInstanceName(harness.db, null, '', NOW, locked)).toEqual({
      ok: false,
      error: 'locked',
    });
  });
});

describe('saveSmtp', () => {
  it('stores the password as an envelope that decrypts back, and the view never shows it', async () => {
    expect(
      await saveSmtp(harness.db, null, { ...smtpInput, password: PASSWORD }, NOW, noEnv),
    ).toEqual({ ok: true });
    const row = await storedRow('smtp');
    const stored = JSON.stringify(row?.value);
    expect(stored).not.toContain(PASSWORD);
    expect(stored).toContain('v1:');
    const view = await smtpView(harness.db, noEnv);
    expect(view.value).toEqual({
      host: 'smtp.example.com',
      port: 587,
      user: 'mailer',
      from: 'Saldo <saldo@example.com>',
      passwordSet: true,
      passwordReadable: true,
    });
    expect(JSON.stringify(view)).not.toContain(PASSWORD);
    const sending = await smtpForSending(harness.db, noEnv);
    expect(sending?.password).toBe(PASSWORD);
    const { password: envelope } = await storedSmtp();
    expect(envelope).not.toBeNull();
    expect(decryptSecret(envelope ?? '', key, SMTP_PASSWORD_SLOT)).toBe(PASSWORD);
  });

  it('keeps the stored password when the field is absent', async () => {
    await saveSmtp(harness.db, null, { ...smtpInput, password: PASSWORD }, NOW, noEnv);
    const before = await storedSmtp();
    // The port and the sender may change while the password is kept.
    expect(
      await saveSmtp(
        harness.db,
        null,
        { ...smtpInput, port: 465, from: 'other@example.com' },
        LATER,
        noEnv,
      ),
    ).toEqual({ ok: true });
    const after = await storedSmtp();
    expect(after).toMatchObject({ port: 465, from: 'other@example.com' });
    expect(after.password).toBe(before.password);
    expect((await smtpForSending(harness.db, noEnv))?.password).toBe(PASSWORD);
  });

  it.each([
    ['host', { host: 'smtp.elsewhere.example' }],
    ['user', { user: 'someone-else' }],
    ['user removed', { user: '' }],
  ])(
    'needs the password again when it is kept but the %s changed, and writes nothing',
    async (_label, patch) => {
      await saveSmtp(harness.db, null, { ...smtpInput, password: PASSWORD }, NOW, noEnv);
      const before = await storedRow('smtp');
      expect(await saveSmtp(harness.db, null, { ...smtpInput, ...patch }, LATER, noEnv)).toEqual({
        ok: false,
        error: 'passwordRequired',
      });
      expect(await storedRow('smtp')).toEqual(before);
    },
  );

  it('lets a new host come with a new password', async () => {
    await saveSmtp(harness.db, null, { ...smtpInput, password: PASSWORD }, NOW, noEnv);
    expect(
      await saveSmtp(
        harness.db,
        null,
        { ...smtpInput, host: 'smtp2.example.com', password: 'another-fake' },
        LATER,
        noEnv,
      ),
    ).toEqual({ ok: true });
    expect((await smtpForSending(harness.db, noEnv))?.password).toBe('another-fake');
  });

  it('replaces the password when a string is given, with a fresh envelope', async () => {
    await saveSmtp(harness.db, null, { ...smtpInput, password: PASSWORD }, NOW, noEnv);
    const before = await storedSmtp();
    await saveSmtp(harness.db, null, { ...smtpInput, password: 'another-fake' }, LATER, noEnv);
    const after = await storedSmtp();
    expect(after.password).not.toBe(before.password);
    expect((await smtpForSending(harness.db, noEnv))?.password).toBe('another-fake');
  });

  it('removes the password with null, which needs the user gone too', async () => {
    await saveSmtp(harness.db, null, { ...smtpInput, password: PASSWORD }, NOW, noEnv);
    expect(
      await saveSmtp(harness.db, null, { ...smtpInput, password: null }, LATER, noEnv),
    ).toEqual({ ok: false, error: 'invalid' });
    expect(
      await saveSmtp(harness.db, null, { ...smtpInput, user: '', password: null }, LATER, noEnv),
    ).toEqual({ ok: true });
    expect(await smtpView(harness.db, noEnv)).toMatchObject({
      value: { user: null, passwordSet: false },
    });
  });

  it('works without a user and without a password (a catcher such as Mailpit)', async () => {
    expect(
      await saveSmtp(
        harness.db,
        null,
        { host: 'localhost', port: '1025', from: 'saldo@example.com' },
        NOW,
        noEnv,
      ),
    ).toEqual({ ok: true });
    expect(await smtpView(harness.db, noEnv)).toMatchObject({
      value: { host: 'localhost', port: 1025, user: null, passwordSet: false },
    });
  });

  it('refuses a user with no password, and a password with no user', async () => {
    expect(await saveSmtp(harness.db, null, smtpInput, NOW, noEnv)).toEqual({
      ok: false,
      error: 'invalid',
    });
    expect(
      await saveSmtp(
        harness.db,
        null,
        { host: 'smtp.example.com', port: 587, from: 'saldo@example.com', password: PASSWORD },
        NOW,
        noEnv,
      ),
    ).toEqual({ ok: false, error: 'invalid' });
    expect(await storedRow('smtp')).toBeUndefined();
  });

  it.each([
    ['an empty host', { host: '' }],
    ['a host with a space', { host: 'smtp example.com' }],
    ['a host over 255', { host: 'h'.repeat(256) }],
    ['port 0', { port: 0 }],
    ['port 65536', { port: 65536 }],
    ['a fractional port', { port: 25.5 }],
    ['no port', { port: undefined }],
    ['a sender that is not an address', { from: 'Saldo' }],
    ['a sender with a bad address part', { from: 'Saldo <nope>' }],
    ['a sender with a line break', { from: 'Saldo\r\nBcc: x@example.com <saldo@example.com>' }],
    ['a user over 255', { user: 'u'.repeat(256) }],
  ])('refuses %s', async (_label, patch) => {
    expect(
      await saveSmtp(harness.db, null, { ...smtpInput, password: PASSWORD, ...patch }, NOW, noEnv),
    ).toEqual({ ok: false, error: 'invalid' });
    expect(await storedRow('smtp')).toBeUndefined();
  });

  it('refuses something that is not an object', async () => {
    expect(await saveSmtp(harness.db, null, 'smtp.example.com', NOW, noEnv)).toEqual({
      ok: false,
      error: 'invalid',
    });
  });

  it('accepts a bare address as the sender', async () => {
    expect(
      await saveSmtp(
        harness.db,
        null,
        { ...smtpInput, from: 'saldo@example.com', password: PASSWORD },
        NOW,
        noEnv,
      ),
    ).toEqual({ ok: true });
  });

  it('is locked when SMTP_HOST is set, and writes nothing', async () => {
    const locked = { ...noEnv, smtp: envSmtp };
    expect(
      await saveSmtp(harness.db, null, { ...smtpInput, password: PASSWORD }, NOW, locked),
    ).toEqual({ ok: false, error: 'locked' });
    expect(await removeSmtp(harness.db, null, locked)).toEqual({ ok: false, error: 'locked' });
    expect(await storedRow('smtp')).toBeUndefined();
  });
});

describe('removeSmtp', () => {
  it('deletes the row: mail is off again', async () => {
    await saveSmtp(harness.db, null, { ...smtpInput, password: PASSWORD }, NOW, noEnv);
    expect(await removeSmtp(harness.db, null, noEnv)).toEqual({ ok: true });
    expect(await storedRow('smtp')).toBeUndefined();
    expect((await smtpView(harness.db, noEnv)).value).toBeNull();
  });

  it('is fine when there was nothing to remove', async () => {
    expect(await removeSmtp(harness.db, null, noEnv)).toEqual({ ok: true });
  });
});

describe('saveMcpEnabled', () => {
  it('stores the switch as a boolean and stamps who and when', async () => {
    const { userId } = await createTestSession(harness.db, 'Ada', 'admin');
    expect(await saveMcpEnabled(harness.db, userId, false, NOW, noEnv)).toEqual({ ok: true });
    expect(await storedRow('mcp.enabled')).toMatchObject({ value: false, updatedBy: userId });
    expect(await mcpEnabled(harness.db, noEnv)).toBe(false);
    expect(await saveMcpEnabled(harness.db, userId, true, LATER, noEnv)).toEqual({ ok: true });
    expect(await mcpEnabled(harness.db, noEnv)).toBe(true);
  });

  it.each(['false', 0, null, 'off'])('refuses %j as invalid', async (raw) => {
    expect(await saveMcpEnabled(harness.db, null, raw, NOW, noEnv)).toEqual({
      ok: false,
      error: 'invalid',
    });
    expect(await storedRow('mcp.enabled')).toBeUndefined();
  });

  it('is locked when MCP_ENABLED is set, and writes nothing', async () => {
    expect(
      await saveMcpEnabled(harness.db, null, false, NOW, { ...noEnv, mcpEnabled: true }),
    ).toEqual({ ok: false, error: 'locked' });
    expect(await storedRow('mcp.enabled')).toBeUndefined();
  });
});
