import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { settleBackground } from '../background';
import { syncRows, user } from '../db/schema';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { catchMail, enableMail, type MailCatcher, stopCatchingMail } from '../test/mail';
import { revokeUser } from './admin';
import { requestVerification, sendRecoveryLink, sendVerificationLink } from './mailCallbacks';

const logged = vi.hoisted(() => [] as unknown[][]);
vi.mock('../log', () => ({
  log: (...args: unknown[]) => {
    logged.push(args);
  },
  shortId: (id: string | null | undefined) => (id ?? 'none').slice(0, 8),
}));

let harness: TestDatabase;
let mail: MailCatcher;

beforeAll(async () => {
  harness = await createTestDatabase();
});

beforeEach(() => {
  mail = catchMail();
  logged.length = 0;
});

afterEach(async () => {
  await settleBackground();
  await harness.reset();
});

afterAll(async () => {
  stopCatchingMail();
  await harness.close();
});

const URL_ = 'http://localhost:3000/api/auth/magic-link/verify?token=t0k3n&callbackURL=%2F';

async function account(
  email: string,
  options: { verified?: boolean; banned?: boolean } = {},
): Promise<string> {
  const id = crypto.randomUUID();
  await harness.db.insert(user).values({
    id,
    name: 'Ada',
    email,
    emailVerified: options.verified ?? true,
    banned: options.banned ?? false,
  });
  return id;
}

async function recover(email: string, acceptLanguage: string | null = null): Promise<void> {
  sendRecoveryLink(harness.db, { email, url: URL_, acceptLanguage });
  await settleBackground();
}

describe('sendRecoveryLink', () => {
  it('mails a verified account exactly once, to that address, with the link', async () => {
    await enableMail(harness.db);
    await account('ada@example.com');
    await recover('ada@example.com');
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0]?.to).toBe('ada@example.com');
    expect(mail.sent[0]?.text.split('\n')).toContain(URL_);
    expect(mail.sent[0]?.from).toBe('Saldo <saldo@example.com>');
  });

  it('finds the account however the address was typed', async () => {
    await enableMail(harness.db);
    await account('ada@example.com');
    await recover('  Ada@Example.COM');
    expect(mail.sent.map((m) => m.to)).toEqual(['ada@example.com']);
  });

  it('mails nothing for an address with no account', async () => {
    await enableMail(harness.db);
    await recover('nobody@example.com');
    expect(mail.sent).toEqual([]);
  });

  it('mails nothing for an account whose address is not verified', async () => {
    await enableMail(harness.db);
    await account('ada@example.com', { verified: false });
    await recover('ada@example.com');
    expect(mail.sent).toEqual([]);
  });

  it('mails nothing for a revoked account', async () => {
    await enableMail(harness.db);
    const id = await account('ada@example.com');
    await revokeUser(harness.db, id, 'gone', new Date());
    await recover('ada@example.com');
    expect(mail.sent).toEqual([]);
  });

  it('mails nothing when the server has no SMTP', async () => {
    await account('ada@example.com');
    await recover('ada@example.com');
    expect(mail.sent).toEqual([]);
  });

  it('holds a second request for a minute, then the sixth of the hour', async () => {
    await enableMail(harness.db);
    await account('ada@example.com');
    await recover('ada@example.com');
    await recover('ada@example.com');
    expect(mail.sent).toHaveLength(1);
  });

  it('does not let requests for addresses without accounts fill the throttle', async () => {
    await enableMail(harness.db);
    const { mailThrottle } = await import('../mail/throttle');
    for (let i = 0; i < 20; i += 1) await recover(`nobody${i}@example.com`);
    expect(mailThrottle.size()).toBe(0);
  });

  it('returns at once, before anything is sent', async () => {
    await enableMail(harness.db);
    await account('ada@example.com');
    sendRecoveryLink(harness.db, { email: 'ada@example.com', url: URL_, acceptLanguage: null });
    expect(mail.sent).toEqual([]);
    await settleBackground();
    expect(mail.sent).toHaveLength(1);
  });

  it('does not throw or fail when the transport does, and logs no address', async () => {
    await enableMail(harness.db);
    await account('ada@example.com');
    mail.failWith(new Error('550 ada@example.com rejected'));
    await expect(recover('ada@example.com')).resolves.toBeUndefined();
    expect(mail.sent).toEqual([]);
    expect(JSON.stringify(logged)).not.toContain('ada@example.com');
    expect(JSON.stringify(logged)).not.toContain(URL_);
  });
});

describe('the language of the message', () => {
  async function withLanguage(userId: string, language: string): Promise<void> {
    await harness.db.insert(syncRows).values({
      userId,
      entity: 'settings',
      id: 'settings',
      updatedAt: '0',
      data: { language },
      seq: 1,
    });
  }

  it("is the recipient's own setting when they have one", async () => {
    await enableMail(harness.db);
    const id = await account('ada@example.com');
    await withLanguage(id, 'it');
    await recover('ada@example.com', 'de-DE,de;q=0.9');
    expect(mail.sent[0]?.subject).toContain('rientrare');
  });

  it("falls back to the request's Accept-Language while the setting is system", async () => {
    await enableMail(harness.db);
    const id = await account('ada@example.com');
    await withLanguage(id, 'system');
    await recover('ada@example.com', 'fr-FR,fr;q=0.9');
    expect(mail.sent[0]?.subject).toContain('retrouver');
  });

  it('is English with neither', async () => {
    await enableMail(harness.db);
    await account('ada@example.com');
    await recover('ada@example.com');
    expect(mail.sent[0]?.subject).toBe('Your link to get back into Saldo test');
  });
});

describe('sendVerificationLink', () => {
  const VERIFY_URL = 'http://localhost:3000/api/auth/verify-email?token=abc&callbackURL=%2Fx';

  async function verify(email: string): Promise<void> {
    const id = await account(email, { verified: false });
    sendVerificationLink(harness.db, {
      user: { id, email },
      url: VERIFY_URL,
      acceptLanguage: null,
    });
    await settleBackground();
  }

  it('mails a real address once, with the link', async () => {
    await enableMail(harness.db);
    await verify('ada@example.com');
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0]?.to).toBe('ada@example.com');
    expect(mail.sent[0]?.text.split('\n')).toContain(VERIFY_URL);
  });

  it('never mails a synthetic address', async () => {
    await enableMail(harness.db);
    await verify('abc@passkey.saldo.invalid');
    expect(mail.sent).toEqual([]);
  });

  it('mails nothing without SMTP', async () => {
    await verify('ada@example.com');
    expect(mail.sent).toEqual([]);
  });

  it('holds a second message for the same address for a minute', async () => {
    await enableMail(harness.db);
    const id = await account('ada@example.com', { verified: false });
    for (let i = 0; i < 3; i += 1) {
      sendVerificationLink(harness.db, {
        user: { id, email: 'ada@example.com' },
        url: VERIFY_URL,
        acceptLanguage: null,
      });
      await settleBackground();
    }
    expect(mail.sent).toHaveLength(1);
  });

  it('does not throw when the transport fails', async () => {
    await enableMail(harness.db);
    mail.failWith(new Error('down'));
    await expect(verify('ada@example.com')).resolves.toBeUndefined();
    expect(mail.sent).toEqual([]);
  });
});

describe('requestVerification', () => {
  const links = { secret: 'test-secret-test-secret', baseURL: 'http://localhost:3000/api/auth' };

  it('mints a link for an unverified real address and mails it', async () => {
    await enableMail(harness.db);
    const id = await account('ada@example.com', { verified: false });
    requestVerification(harness.db, { userId: id, ...links, acceptLanguage: null });
    await settleBackground();
    expect(mail.sent).toHaveLength(1);
    const link = mail.sent[0]?.text.split('\n').find((line) => line.startsWith('http'));
    expect(link).toMatch(
      /^http:\/\/localhost:3000\/api\/auth\/verify-email\?token=[\w.-]+&callbackURL=%2Femail-verified$/,
    );
  });

  it('mails nothing for a synthetic address, a verified one or an unknown id', async () => {
    await enableMail(harness.db);
    const synthetic = await account('abc@passkey.saldo.invalid', { verified: false });
    const verified = await account('bob@example.com', { verified: true });
    for (const userId of [synthetic, verified, crypto.randomUUID()]) {
      requestVerification(harness.db, { userId, ...links, acceptLanguage: null });
    }
    await settleBackground();
    expect(mail.sent).toEqual([]);
  });
});
