import { createHash } from 'node:crypto';
import { createEmailVerificationToken } from 'better-auth/api';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { recoverState, recoveryVerifyPath } from '../../../src/features/auth/recoverView';
import { revokeUser } from '../../../src/server/auth/admin';
import { auth } from '../../../src/server/auth/auth';
import { settleBackground } from '../../../src/server/background';
import { session, user, verification } from '../../../src/server/db/schema';
import { createTestDatabase, type TestDatabase } from '../../../src/server/test/harness';
import {
  catchMail,
  enableMail,
  type MailCatcher,
  stopCatchingMail,
} from '../../../src/server/test/mail';
import { createTestSession, sessionCookie } from '../../../src/server/test/session';
import ConfirmPage from '../../(auth)/recover/confirm/page';
import { GET, POST } from './[...all]/route';

vi.mock('../../../src/i18n/server', () => ({
  publicI18n: async () => ({ locale: 'it', t: (key: string) => key }),
}));
vi.mock('../../../src/server/page/instanceSettings', () => ({
  pageInstanceInfo: async () => ({ name: 'Saldo test', version: '0', host: 'localhost:3000' }),
}));

/**
 * 0.3f-3, through the real handler: what the two flows do, and what the new endpoints let a stranger
 * do. The mail transport is faked (no socket) and the background sends are awaited through their
 * hook, never through time.
 */
let harness: TestDatabase;
let mail: MailCatcher;

beforeAll(async () => {
  harness = await createTestDatabase();
});

beforeEach(async () => {
  mail = catchMail();
  await enableMail(harness.db);
});

afterEach(async () => {
  await settleBackground();
  await harness.reset();
});

afterAll(async () => {
  stopCatchingMail();
  await harness.close();
});

const BASE = 'http://localhost:3000/api/auth';
const ADA = 'ada@example.com';

async function account(email: string, options: { verified?: boolean } = {}): Promise<string> {
  const id = crypto.randomUUID();
  await harness.db
    .insert(user)
    .values({ id, name: 'Ada', email, emailVerified: options.verified ?? true, banned: false });
  return id;
}

let caller = 0;
function post(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  // A caller of its own each time, so the rate limiter (one bucket per address) stays out of the way.
  caller += 1;
  return POST(
    new Request(`${BASE}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': `203.0.113.${caller % 250}`,
        ...headers,
      },
      body: JSON.stringify(body),
    }),
  );
}

function get(url: string): Promise<Response> {
  caller += 1;
  return GET(new Request(url, { headers: { 'x-forwarded-for': `198.51.100.${caller % 250}` } }));
}

const RECOVER = {
  callbackURL: '/profile/passkeys?recovered',
  errorCallbackURL: '/recover',
};

async function askForRecovery(email: string, extra: Record<string, unknown> = {}) {
  const response = await post('/sign-in/magic-link', { email, ...RECOVER, ...extra });
  await settleBackground();
  return response;
}

/** The link in the last message: the one line that is an address. */
function linkIn(message: { text: string } | undefined): string {
  const link = message?.text.split('\n').find((line) => line.startsWith('http'));
  if (link === undefined) throw new Error('no link in the message');
  return link;
}

async function hasSessionCookie(response: Response): Promise<boolean> {
  const { authCookies } = await auth().$context;
  return response.headers
    .getSetCookie()
    .some((cookie) => cookie.startsWith(`${authCookies.sessionToken.name}=`));
}

/**
 * What the confirm page's button opens: the library's verify endpoint, from the token in the mailed
 * link. The mailed link itself points at a Saldo page and consumes nothing.
 */
const verifyUrl = (mailed: string) =>
  `http://localhost:3000${recoveryVerifyPath(new URL(mailed).searchParams.get('token') ?? '')}`;

const location = (response: Response) => new URL(response.headers.get('location') ?? 'x:', BASE);

describe('recovery by magic link', () => {
  it('mails a verified account a link that signs it in once and lands on the callback', async () => {
    const id = await account(ADA);
    const asked = await askForRecovery(ADA);
    expect(asked.status).toBe(200);
    expect(await asked.json()).toEqual({ status: true });
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0]?.to).toBe(ADA);

    const link = linkIn(mail.sent[0]);
    const opened = await get(verifyUrl(link));
    expect(opened.status).toBe(302);
    expect(location(opened).pathname + location(opened).search).toBe('/profile/passkeys?recovered');
    expect(await hasSessionCookie(opened)).toBe(true);
    const sessions = await harness.db.select().from(session).where(eq(session.userId, id));
    expect(sessions).toHaveLength(1);

    // Single use: the same link again ends on the error redirect, with no cookie.
    const again = await get(verifyUrl(link));
    expect(again.status).toBe(302);
    expect(location(again).pathname).toBe('/recover');
    expect(location(again).searchParams.get('error')).toBe('INVALID_TOKEN');
    expect(await hasSessionCookie(again)).toBe(false);
    // What the browser lands on is what /recover maps to its «this link no longer works» line.
    expect(
      recoverState({
        mailEnabled: true,
        error: location(again).searchParams.get('error') ?? undefined,
      }),
    ).toBe('expiredLink');
  });

  it('mails a link to a page that asks first: opening the page consumes nothing', async () => {
    const id = await account(ADA);
    await askForRecovery(ADA);
    const link = linkIn(mail.sent[0]);
    expect(new URL(link).pathname).toBe('/recover/confirm');

    // A mail scanner, or a stranger's cross-site GET, loads the page…
    const token = new URL(link).searchParams.get('token') ?? '';
    await ConfirmPage({ searchParams: Promise.resolve({ token }) });
    expect(await harness.db.select().from(session).where(eq(session.userId, id))).toHaveLength(0);
    expect(await harness.db.select().from(verification)).toHaveLength(1);

    // …and the link still works afterwards, when somebody presses the button.
    const opened = await get(verifyUrl(link));
    expect(await hasSessionCookie(opened)).toBe(true);
    expect(await harness.db.select().from(verification)).toHaveLength(0);
  });

  it('stores the token hashed and for fifteen minutes', async () => {
    await account(ADA);
    await askForRecovery(ADA);
    const token = new URL(linkIn(mail.sent[0])).searchParams.get('token') ?? '';
    const rows = await harness.db.select().from(verification);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.identifier).not.toBe(token);
    expect(rows[0]?.identifier).toBe(createHash('sha256').update(token).digest('base64url'));
    const minutes = ((rows[0]?.expiresAt.getTime() ?? 0) - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(14);
    expect(minutes).toBeLessThanOrEqual(15);
  });

  it('answers an unknown address like a known one, sends nothing and creates nothing', async () => {
    const response = await askForRecovery('nobody@example.com');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: true });
    expect(mail.sent).toEqual([]);
    expect(await harness.db.select().from(user)).toHaveLength(0);
  });

  it('never creates an account, even for a link that somebody minted for an unknown address', async () => {
    // What `signInMagicLink` would have stored had it been asked for this address and had the mail
    // reached a stranger. `disableSignUp` is the only thing between this row and a new account.
    const token = 'a-token-for-somebody-who-has-no-account';
    await harness.db.insert(verification).values({
      id: crypto.randomUUID(),
      identifier: createHash('sha256').update(token).digest('base64url'),
      value: JSON.stringify({ email: 'new@example.com', name: 'New' }),
      expiresAt: new Date(Date.now() + 60_000),
    });
    const opened = await get(
      `${BASE}/magic-link/verify?token=${token}&callbackURL=%2F&errorCallbackURL=%2Frecover%3Ferror%3Dlink`,
    );
    expect(opened.status).toBe(302);
    expect(location(opened).pathname).toBe('/recover');
    expect(location(opened).searchParams.get('error')).toBe('new_user_signup_disabled');
    expect(await hasSessionCookie(opened)).toBe(false);
    expect(await harness.db.select().from(user)).toHaveLength(0);
  });

  it('sends nothing to an account whose address is not verified', async () => {
    await account(ADA, { verified: false });
    const response = await askForRecovery(ADA);
    expect(await response.json()).toEqual({ status: true });
    expect(mail.sent).toEqual([]);
  });

  it('sends nothing when the server has no SMTP', async () => {
    await harness.reset();
    await account(ADA);
    const response = await askForRecovery(ADA);
    expect(await response.json()).toEqual({ status: true });
    expect(mail.sent).toEqual([]);
  });

  it('sends nothing to a revoked account, and refuses a link minted before the revocation', async () => {
    const id = await account(ADA);
    await askForRecovery(ADA);
    const link = linkIn(mail.sent[0]);
    await revokeUser(harness.db, id, 'gone', new Date());

    // No new link for a revoked account…
    mail.sent.length = 0;
    const again = await askForRecovery(ADA);
    expect(await again.json()).toEqual({ status: true });
    expect(mail.sent).toEqual([]);

    // …and the old one opens nothing: the `admin` plugin refuses the session.
    const opened = await get(verifyUrl(link));
    expect(opened.status).not.toBe(200);
    expect(await hasSessionCookie(opened)).toBe(false);
    expect(await harness.db.select().from(session).where(eq(session.userId, id))).toHaveLength(0);
  });

  it('holds a second request for the same address for a minute, answering the same', async () => {
    await account(ADA);
    await askForRecovery(ADA);
    const second = await askForRecovery(ADA);
    expect(await second.json()).toEqual({ status: true });
    expect(mail.sent).toHaveLength(1);
  });

  it("writes the message in the recipient's language, from Accept-Language without a setting", async () => {
    await account(ADA);
    await post('/sign-in/magic-link', { email: ADA, ...RECOVER }, { 'accept-language': 'it-IT' });
    await settleBackground();
    expect(mail.sent[0]?.subject).toBe('Il tuo link per rientrare in Saldo test');
  });

  it('refuses a garbled token with the error redirect', async () => {
    const opened = await get(
      `${BASE}/magic-link/verify?token=garbled&callbackURL=%2F&errorCallbackURL=%2Frecover%3Ferror%3Dlink`,
    );
    expect(opened.status).toBe(302);
    expect(location(opened).searchParams.get('error')).toBe('INVALID_TOKEN');
    expect(await hasSessionCookie(opened)).toBe(false);
  });

  it('refuses an expired token with the error redirect', async () => {
    await account(ADA);
    await askForRecovery(ADA);
    await harness.db.update(verification).set({ expiresAt: new Date(Date.now() - 1000) });
    const opened = await get(verifyUrl(linkIn(mail.sent[0])));
    expect(location(opened).searchParams.get('error')).toBe('INVALID_TOKEN');
    expect(await hasSessionCookie(opened)).toBe(false);
  });
});

describe('email verification', () => {
  const ask = async (email: string, headers: Record<string, string> = {}) => {
    const response = await post(
      '/send-verification-email',
      { email, callbackURL: '/email-verified' },
      headers,
    );
    await settleBackground();
    return response;
  };

  it('mails an unverified account a link that verifies it and signs nobody in', async () => {
    await account(ADA, { verified: false });
    const asked = await ask(ADA);
    expect(asked.status).toBe(200);
    expect(await asked.json()).toEqual({ status: true });
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0]?.to).toBe(ADA);

    const opened = await get(linkIn(mail.sent[0]));
    expect(opened.status).toBe(302);
    expect(location(opened).pathname).toBe('/email-verified');
    expect(await hasSessionCookie(opened)).toBe(false);
    const [row] = await harness.db.select().from(user).where(eq(user.email, ADA));
    expect(row?.emailVerified).toBe(true);
    expect(await harness.db.select().from(session)).toHaveLength(0);
  });

  it('answers a stranger the same for unknown, verified and unverified, and mails only the last', async () => {
    await account(ADA, { verified: false });
    await account('bob@example.com', { verified: true });
    const answers = [];
    for (const email of ['nobody@example.com', 'bob@example.com', ADA]) {
      const response = await ask(email);
      answers.push([response.status, await response.json()]);
    }
    expect(answers).toEqual([
      [200, { status: true }],
      [200, { status: true }],
      [200, { status: true }],
    ]);
    expect(mail.sent.map((m) => m.to)).toEqual([ADA]);
  });

  it('cannot be used to flood an address: the throttle holds repeats', async () => {
    await account(ADA, { verified: false });
    for (let i = 0; i < 4; i += 1) await ask(ADA);
    expect(mail.sent).toHaveLength(1);
  });

  it('never mails a synthetic address', async () => {
    await account('abc@passkey.saldo.invalid', { verified: false });
    const response = await ask('abc@passkey.saldo.invalid');
    expect(response.status).toBe(200);
    expect(mail.sent).toEqual([]);
  });

  it('mails nothing when the server has no SMTP', async () => {
    await harness.reset();
    await account(ADA, { verified: false });
    await ask(ADA);
    expect(mail.sent).toEqual([]);
  });

  it('will not mail an address other than the signed-in account’s', async () => {
    const signedIn = await createTestSession(harness.db);
    await harness.db.update(user).set({ email: ADA }).where(eq(user.id, signedIn.userId));
    await account('victim@example.com', { verified: false });
    const response = await ask('victim@example.com', {
      cookie: await sessionCookie(signedIn.token),
      origin: 'http://localhost:3000',
    });
    expect(response.status).toBe(400);
    expect(mail.sent).toEqual([]);
  });

  it('refuses a garbled token with an error in the callback', async () => {
    const opened = await get(`${BASE}/verify-email?token=garbled&callbackURL=%2Femail-verified`);
    expect(opened.status).toBe(302);
    expect(location(opened).pathname).toBe('/email-verified');
    expect(location(opened).searchParams.get('error')).not.toBeNull();
    expect(await hasSessionCookie(opened)).toBe(false);
  });

  it('refuses an expired token with an error in the callback, and leaves the address unverified', async () => {
    await account(ADA, { verified: false });
    const { secret } = await auth().$context;
    const token = await createEmailVerificationToken(secret, ADA, undefined, -60);
    const opened = await get(`${BASE}/verify-email?token=${token}&callbackURL=%2Femail-verified`);
    expect(location(opened).searchParams.get('error')).not.toBeNull();
    const [row] = await harness.db.select().from(user).where(eq(user.email, ADA));
    expect(row?.emailVerified).toBe(false);
  });
});

describe('abusing the new endpoints', () => {
  const OFF_SITE = [
    'https://evil.example.org/x',
    '//evil.example.org/x',
    'http://localhost:3000.evil.example.org/',
  ];

  it.each(OFF_SITE)(
    'refuses %s as the callback of a recovery request, before anything is minted',
    async (url) => {
      await account(ADA);
      for (const field of ['callbackURL', 'errorCallbackURL', 'newUserCallbackURL']) {
        const response = await post('/sign-in/magic-link', {
          email: ADA,
          ...RECOVER,
          [field]: url,
        });
        expect(response.status, field).toBe(403);
      }
      await settleBackground();
      expect(mail.sent).toEqual([]);
      expect(await harness.db.select().from(verification)).toHaveLength(0);
    },
  );

  it.each(OFF_SITE)('refuses %s as the callback of a verification request', async (url) => {
    await account(ADA, { verified: false });
    const response = await post('/send-verification-email', { email: ADA, callbackURL: url });
    await settleBackground();
    expect(response.status).toBe(403);
    expect(mail.sent).toEqual([]);
  });

  it.each(OFF_SITE)('will not follow a hand-made link to %s', async (url) => {
    const encoded = encodeURIComponent(url);
    for (const path of [
      `/magic-link/verify?token=x&callbackURL=${encoded}`,
      `/magic-link/verify?token=x&errorCallbackURL=${encoded}`,
      `/verify-email?token=x&callbackURL=${encoded}`,
    ]) {
      const response = await get(`${BASE}${path}`);
      expect(response.status, path).toBe(403);
      expect(response.headers.get('location'), path).toBeNull();
    }
  });

  // `saldo://*` is a trusted origin for the phone's own flows, so the library lets these through; the
  // Expo plugin would then append the session cookie to the redirect. No mail flow may name one.
  const APP_SCHEME = ['saldo://steal', 'saldo:///steal?x=1'];

  it.each(APP_SCHEME)(
    'refuses %s as a callback of a recovery or verification request',
    async (url) => {
      await account(ADA);
      for (const field of ['callbackURL', 'errorCallbackURL', 'newUserCallbackURL']) {
        const response = await post('/sign-in/magic-link', {
          email: ADA,
          ...RECOVER,
          [field]: url,
        });
        expect(response.status, field).toBe(403);
      }
      const verification_ = await post('/send-verification-email', {
        email: ADA,
        callbackURL: url,
      });
      expect(verification_.status).toBe(403);
      await settleBackground();
      expect(mail.sent).toEqual([]);
      expect(await harness.db.select().from(verification)).toHaveLength(0);
    },
  );

  it.each(APP_SCHEME)(
    'will not follow a hand-made link to %s, nor hand it the cookie',
    async (url) => {
      const id = await account(ADA);
      await askForRecovery(ADA);
      const token = new URL(linkIn(mail.sent[0])).searchParams.get('token') ?? '';
      const encoded = encodeURIComponent(url);
      for (const path of [
        `/magic-link/verify?token=${token}&callbackURL=${encoded}`,
        `/magic-link/verify?token=${token}&errorCallbackURL=${encoded}`,
        `/verify-email?token=x&callbackURL=${encoded}`,
      ]) {
        const response = await get(`${BASE}${path}`);
        expect(response.status, path).toBe(403);
        expect(response.headers.get('location') ?? '', path).not.toContain('cookie=');
        expect(await hasSessionCookie(response), path).toBe(false);
      }
      // Refused before the token was spent: the honest link still works.
      expect(await harness.db.select().from(session).where(eq(session.userId, id))).toHaveLength(0);
      const honest = await get(verifyUrl(linkIn(mail.sent[0])));
      expect(honest.headers.get('location') ?? '').not.toContain('cookie=');
      expect(await hasSessionCookie(honest)).toBe(true);
    },
  );
});
