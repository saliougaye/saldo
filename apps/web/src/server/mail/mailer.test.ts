import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SettingsSource } from '../settings/serverSettings';
import { saveSmtp } from '../settings/write';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import {
  type MailTransport,
  type MailTransportFactory,
  mailEnabled,
  sendMail,
  setMailTransportForTests,
  type TransportOptions,
  transportSecurity,
} from './mailer';

// `log` prints nothing under test; capture what it is given to check what a log line may contain.
const logged = vi.hoisted(() => [] as unknown[][]);
vi.mock('../log', () => ({
  log: (...args: unknown[]) => {
    logged.push(args);
  },
  shortId: (id: string | null | undefined) => (id ?? 'none').slice(0, 8),
}));

let harness: TestDatabase;

beforeAll(async () => {
  harness = await createTestDatabase();
});

afterAll(async () => {
  await harness.close();
});

const key = Buffer.alloc(32, 'A');
// Not a real password.
const PASSWORD = 'fake-password-for-tests';
const RECIPIENT = 'ada.private@example.com';

const noEnv: SettingsSource = {
  registration: null,
  instanceName: null,
  rpName: 'Saldo test',
  smtp: null,
  settingsKey: key,
};

const envWith = (smtp: Partial<NonNullable<SettingsSource['smtp']>>): SettingsSource => ({
  ...noEnv,
  smtp: {
    host: 'smtp.example.com',
    port: 587,
    user: 'mailer',
    password: PASSWORD,
    from: 'Saldo <saldo@example.com>',
    ...smtp,
  },
});

interface Recorder {
  factory: MailTransportFactory;
  options: TransportOptions[];
  sent: Parameters<MailTransport['send']>[0][];
  closed: number;
}

function recorder(failWith?: Error): Recorder {
  const seen: Recorder = {
    options: [],
    sent: [],
    closed: 0,
    factory: (options) => {
      seen.options.push(options);
      return {
        send: async (message) => {
          if (failWith !== undefined) throw failWith;
          seen.sent.push(message);
        },
        close: () => {
          seen.closed += 1;
        },
      };
    },
  };
  return seen;
}

const message = { to: RECIPIENT, subject: 'Hello', text: 'Body' };

beforeEach(() => {
  logged.length = 0;
});

afterEach(async () => {
  setMailTransportForTests(null);
  await harness.reset();
});

describe('transportSecurity', () => {
  it('uses implicit TLS on 465', () => {
    expect(transportSecurity('smtp.example.com', 465)).toEqual({ secure: true, requireTLS: false });
  });

  it('requires STARTTLS on every other port', () => {
    expect(transportSecurity('smtp.example.com', 587)).toEqual({
      secure: false,
      requireTLS: true,
    });
    expect(transportSecurity('smtp.example.com', 25)).toEqual({ secure: false, requireTLS: true });
  });

  it.each(['localhost', '127.0.0.1', '::1', 'LOCALHOST'])('allows plain on %s', (host) => {
    expect(transportSecurity(host, 1025)).toEqual({ secure: false, requireTLS: false });
  });

  it('still uses implicit TLS on 465 for a local host', () => {
    expect(transportSecurity('localhost', 465)).toEqual({ secure: true, requireTLS: false });
  });
});

describe('sendMail', () => {
  it('answers notConfigured when there is no configuration, and builds no transport', async () => {
    const seen = recorder();
    setMailTransportForTests(seen.factory);
    expect(await sendMail(harness.db, message, noEnv)).toEqual({
      ok: false,
      error: 'notConfigured',
    });
    expect(seen.options).toEqual([]);
    expect(await mailEnabled(harness.db, noEnv)).toBe(false);
  });

  it('builds a transport from the environment group and sends', async () => {
    const seen = recorder();
    setMailTransportForTests(seen.factory);
    const source = envWith({});
    expect(await mailEnabled(harness.db, source)).toBe(true);
    expect(await sendMail(harness.db, message, source)).toEqual({ ok: true });
    expect(seen.options).toEqual([
      {
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: { user: 'mailer', pass: PASSWORD },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 30_000,
      },
    ]);
    expect(seen.sent).toEqual([
      { from: 'Saldo <saldo@example.com>', to: RECIPIENT, subject: 'Hello', text: 'Body' },
    ]);
    expect(seen.closed).toBe(1);
  });

  it('uses the stored configuration, decrypting the password only to send', async () => {
    const seen = recorder();
    setMailTransportForTests(seen.factory);
    await saveSmtp(
      harness.db,
      null,
      {
        host: 'localhost',
        port: 1025,
        user: 'mailer',
        password: PASSWORD,
        from: 'saldo@example.com',
      },
      new Date(),
      noEnv,
    );
    expect(await sendMail(harness.db, message, noEnv)).toEqual({ ok: true });
    expect(seen.options[0]).toMatchObject({
      host: 'localhost',
      secure: false,
      requireTLS: false,
      auth: { user: 'mailer', pass: PASSWORD },
    });
  });

  it('sends without auth when there is no user', async () => {
    const seen = recorder();
    setMailTransportForTests(seen.factory);
    await sendMail(harness.db, message, envWith({ user: null, password: null }));
    expect(seen.options[0]?.auth).toBeUndefined();
  });

  it('builds a new transport for each message and closes each', async () => {
    const seen = recorder();
    setMailTransportForTests(seen.factory);
    await sendMail(harness.db, message, envWith({}));
    await sendMail(harness.db, message, envWith({}));
    expect(seen.options).toHaveLength(2);
    expect(seen.closed).toBe(2);
  });

  it('answers notConfigured when the stored password no longer decrypts', async () => {
    const seen = recorder();
    setMailTransportForTests(seen.factory);
    await saveSmtp(
      harness.db,
      null,
      {
        host: 'smtp.example.com',
        port: 587,
        user: 'mailer',
        password: PASSWORD,
        from: 'saldo@example.com',
      },
      new Date(),
      noEnv,
    );
    const otherKey: SettingsSource = { ...noEnv, settingsKey: Buffer.alloc(32, 'B') };
    expect(await sendMail(harness.db, message, otherKey)).toEqual({
      ok: false,
      error: 'notConfigured',
    });
    expect(await mailEnabled(harness.db, otherKey)).toBe(false);
    expect(seen.options).toEqual([]);
  });

  it('answers failed with the transport detail, closes, and logs neither address nor password', async () => {
    const seen = recorder(
      Object.assign(new Error(`550 no such user ${RECIPIENT}`), { code: 'EENVELOPE' }),
    );
    setMailTransportForTests(seen.factory);
    const result = await sendMail(harness.db, message, envWith({}));
    expect(result).toEqual({
      ok: false,
      error: 'failed',
      detail: `550 no such user ${RECIPIENT}`,
    });
    expect(seen.closed).toBe(1);
    const lines = JSON.stringify(logged);
    expect(logged.length).toBeGreaterThan(0);
    expect(lines).not.toContain(RECIPIENT);
    expect(lines).not.toContain(PASSWORD);
    expect(lines).not.toContain('saldo@example.com');
  });
});
