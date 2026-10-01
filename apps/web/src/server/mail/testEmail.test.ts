import { catalogs, makeTranslator } from '@saldo/i18n';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { SettingsSource } from '../settings/serverSettings';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { setMailTransportForTests } from './mailer';
import { sendTestEmail } from './testEmail';

const source: SettingsSource = {
  registration: null,
  instanceName: null,
  rpName: 'Saldo test',
  settingsKey: Buffer.alloc(32, 'A'),
  smtp: {
    host: 'smtp.example.com',
    port: 587,
    user: null,
    password: null,
    from: 'saldo@example.com',
  },
};

const t = makeTranslator(catalogs.en);
const instance = { name: 'Casa Gaye', host: 'saldo.example.com', version: '1.0.0' };

let harness: TestDatabase;

beforeAll(async () => {
  harness = await createTestDatabase();
});

afterAll(async () => {
  await harness.close();
});

afterEach(() => setMailTransportForTests(null));

describe('sendTestEmail', () => {
  it('mails the admin own address, in their language, naming the instance and the host', async () => {
    const sent: { to: string; subject: string; text: string }[] = [];
    setMailTransportForTests(() => ({
      send: async (message) => {
        sent.push(message);
      },
      close: () => {},
    }));
    const result = await sendTestEmail(
      harness.db,
      { email: 'ada@example.com', t, instance },
      source,
    );
    expect(result).toEqual({ ok: true, to: 'ada@example.com' });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe('ada@example.com');
    expect(sent[0]?.subject).toContain('Casa Gaye');
    expect(sent[0]?.text).toContain('Casa Gaye');
    expect(sent[0]?.text).toContain('saldo.example.com');
  });

  it('refuses an admin whose address is the placeholder, and sends nothing', async () => {
    let built = 0;
    setMailTransportForTests(() => {
      built += 1;
      return { send: async () => {}, close: () => {} };
    });
    const result = await sendTestEmail(
      harness.db,
      { email: 'abc@passkey.saldo.invalid', t, instance },
      source,
    );
    expect(result).toEqual({ ok: false, error: 'syntheticEmail' });
    expect(built).toBe(0);
  });

  it('passes the transport failure on, with its detail', async () => {
    setMailTransportForTests(() => ({
      send: async () => {
        throw new Error('connect ECONNREFUSED');
      },
      close: () => {},
    }));
    expect(
      await sendTestEmail(harness.db, { email: 'ada@example.com', t, instance }, source),
    ).toEqual({
      ok: false,
      error: 'failed',
      detail: 'connect ECONNREFUSED',
    });
  });
});
