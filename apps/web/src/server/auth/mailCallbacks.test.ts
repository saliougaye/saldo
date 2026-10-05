import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { settleBackground } from '../background';
import { user } from '../db/schema';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { catchMail, enableMail, type MailCatcher, stopCatchingMail } from '../test/mail';
import { sendRecoveryLink, sendVerificationLink } from './mailCallbacks';

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
/** What the library builds from a caller who chose every callback: the `saldo://` ones are trusted origins. */
const HOSTILE_URL =
  'http://localhost:3000/api/auth/magic-link/verify?token=t0k3n&callbackURL=saldo%3A%2F%2Fsteal' +
  '&errorCallbackURL=saldo%3A%2F%2Ferr&newUserCallbackURL=saldo%3A%2F%2Fnew';

/** A mailed address, apart: the origin and path, then each query parameter by name. */
function parts(link: string | undefined): { where: string; query: Record<string, string> } {
  const url = new URL(link ?? 'x:');
  return { where: url.origin + url.pathname, query: Object.fromEntries(url.searchParams) };
}

const linkOf = (message: { text: string } | undefined) =>
  message?.text.split('\n').find((line) => line.startsWith('http'));

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
  it('does not let requests for addresses without accounts fill the throttle', async () => {
    await enableMail(harness.db);
    const { mailThrottle } = await import('../mail/throttle');
    for (let i = 0; i < 20; i += 1) await recover(`nobody${i}@example.com`);
    expect(mailThrottle.size()).toBe(0);
  });

  it('does not throw or fail when the transport does, and logs no address', async () => {
    await enableMail(harness.db);
    await account('ada@example.com');
    mail.failWith(new Error('550 ada@example.com rejected'));
    await expect(recover('ada@example.com')).resolves.toBeUndefined();
    expect(mail.sent).toEqual([]);
    expect(JSON.stringify(logged)).not.toContain('ada@example.com');
    expect(JSON.stringify(logged)).not.toContain('t0k3n');
  });

  it("keeps only the token of the library's link: the callbacks are ours, never the caller's", async () => {
    await enableMail(harness.db);
    await account('ada@example.com');
    sendRecoveryLink(harness.db, {
      email: 'ada@example.com',
      url: HOSTILE_URL,
      acceptLanguage: null,
    });
    await settleBackground();
    expect(mail.sent[0]?.text).not.toContain('saldo:');
    expect(mail.sent[0]?.text).not.toContain('saldo%3A');
    expect(parts(linkOf(mail.sent[0]))).toEqual({
      where: 'http://localhost:3000/recover/confirm',
      query: { token: 't0k3n' },
    });
  });
});

describe('sendVerificationLink', () => {
  it("keeps only the token of the library's link: the callback is ours, never the caller's", async () => {
    await enableMail(harness.db);
    const id = await account('ada@example.com', { verified: false });
    sendVerificationLink(harness.db, {
      user: { id, email: 'ada@example.com' },
      url: 'http://localhost:3000/api/auth/verify-email?token=abc&callbackURL=saldo%3A%2F%2Fsteal',
      acceptLanguage: null,
    });
    await settleBackground();
    expect(mail.sent[0]?.text).not.toContain('saldo:');
    expect(parts(linkOf(mail.sent[0])).query).toEqual({
      token: 'abc',
      callbackURL: '/email-verified',
    });
  });
});
