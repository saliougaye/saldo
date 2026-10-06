import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { serverSettings } from '../db/schema';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { smtpRowSchema } from './resolve';
import { decryptSecret } from './secret';
import {
  type SettingsSource,
  SMTP_PASSWORD_SLOT,
  smtpForSending,
  smtpView,
} from './serverSettings';
import { removeSmtp, saveSmtp } from './write';

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

  it('refuses a sender with a line break, which would inject a header', async () => {
    expect(
      await saveSmtp(
        harness.db,
        null,
        {
          ...smtpInput,
          password: PASSWORD,
          from: 'Saldo\r\nBcc: x@example.com <saldo@example.com>',
        },
        NOW,
        noEnv,
      ),
    ).toEqual({ ok: false, error: 'invalid' });
    expect(await storedRow('smtp')).toBeUndefined();
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
