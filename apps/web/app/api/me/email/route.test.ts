import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { resetEmailChangeLimitForTests } from '../../../../src/server/auth/emailChange';
import { settleBackground } from '../../../../src/server/background';
import { emailChanges, user } from '../../../../src/server/db/schema';
import { mailThrottle } from '../../../../src/server/mail/throttle';
import { changeTokenIn, sessionWithEmail } from '../../../../src/server/test/emailChange';
import { createTestDatabase, type TestDatabase } from '../../../../src/server/test/harness';
import { catchMail, enableMail, stopCatchingMail } from '../../../../src/server/test/mail';
import { createTestSession } from '../../../../src/server/test/session';
import { POST as confirm } from '../../email-change/confirm/route';
import { DELETE, POST } from './route';

let harness: TestDatabase;

beforeAll(async () => {
  harness = await createTestDatabase();
});

afterEach(async () => {
  await harness.reset();
  resetEmailChangeLimitForTests();
});

afterAll(async () => {
  stopCatchingMail();
  await harness.close();
});

function request(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/me/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('POST /api/me/email', () => {
  it('stores the address, lowercased, over a synthetic one', async () => {
    const session = await createTestSession(harness.db, 'Ada');
    const response = await POST(
      request({ email: '  Ada@Example.COM ' }, { authorization: session.bearer }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ email: 'ada@example.com', emailVerified: false });
    const [row] = await harness.db.select().from(user).where(eq(user.id, session.userId));
    expect(row?.email).toBe('ada@example.com');
    expect(row?.emailVerified).toBe(false);
  });

  it('refuses an address another account has', async () => {
    await harness.db
      .insert(user)
      .values({ id: 'other', name: 'Other', email: 'ada@example.com', emailVerified: false });
    const session = await createTestSession(harness.db, 'Ada');
    const response = await POST(
      request({ email: 'ADA@example.com' }, { authorization: session.bearer }),
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: 'email_taken' } });
  });

  it('will not replace an address that is already real', async () => {
    const session = await createTestSession(harness.db, 'Ada');
    await harness.db
      .update(user)
      .set({ email: 'ada@example.com' })
      .where(eq(user.id, session.userId));
    const response = await POST(
      request({ email: 'somebody.else@example.com' }, { authorization: session.bearer }),
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: 'email_already_set' } });
  });

  describe('the verification link', () => {
    it('is mailed to the new address when the server has SMTP', async () => {
      const mail = catchMail();
      await enableMail(harness.db);
      const session = await createTestSession(harness.db, 'Ada');
      const response = await POST(
        request({ email: 'Ada@Example.com' }, { authorization: session.bearer }),
      );
      await settleBackground();
      expect(response.status).toBe(200);
      expect(mail.sent).toHaveLength(1);
      expect(mail.sent[0]?.to).toBe('ada@example.com');
      const link = mail.sent[0]?.text.split('\n').find((line) => line.startsWith('http'));
      expect(link).toContain('/api/auth/verify-email?token=');
      expect(link).toContain('callbackURL=%2Femail-verified');
    });
  });
});

describe('changing a real address', () => {
  const OLD = 'ada@old.example';
  const NEW = 'ada@new.example';

  async function ask(bearer: string, email: string): Promise<Response> {
    const response = await POST(request({ email }, { authorization: bearer }));
    await settleBackground();
    return response;
  }

  async function spend(token: string): Promise<number> {
    const response = await confirm(
      new Request('http://localhost/api/email-change/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
      }),
    );
    return response.status;
  }

  async function emailOf(userId: string) {
    const [row] = await harness.db.select().from(user).where(eq(user.id, userId));
    return { email: row?.email, verified: row?.emailVerified };
  }

  it('is refused when the server has no SMTP, as before', async () => {
    const mail = catchMail();
    const account = await sessionWithEmail(harness.db, OLD);
    const response = await ask(account.bearer, NEW);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: 'email_already_set' } });
    expect(mail.sent).toHaveLength(0);
  });

  it('mails the new address and leaves the account as it was until the link is used', async () => {
    const mail = catchMail();
    await enableMail(harness.db);
    const account = await sessionWithEmail(harness.db, OLD);
    const response = await ask(account.bearer, ' Ada@New.example ');
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ pending: { email: NEW } });
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0]?.to).toBe(NEW);
    const link = mail.sent[0]?.text.split('\n').find((line) => line.startsWith('http'));
    expect(link).toContain('/email-change?token=');
    // The old address stays, verified, until the link is opened.
    expect(await emailOf(account.userId)).toEqual({ email: OLD, verified: true });
    expect(await spend(changeTokenIn(mail.sent[0]))).toBe(200);
    expect(await emailOf(account.userId)).toEqual({ email: NEW, verified: true });
  });

  it('refuses the address the account already has, and one that is not an address', async () => {
    catchMail();
    await enableMail(harness.db);
    const account = await sessionWithEmail(harness.db, OLD);
    const same = await ask(account.bearer, 'ADA@old.example');
    expect(same.status).toBe(400);
    expect(await same.json()).toMatchObject({ error: { code: 'email_unchanged' } });
    const bad = await ask(account.bearer, 'not an address');
    expect(bad.status).toBe(400);
    expect(await bad.json()).toMatchObject({ error: { code: 'invalid_email' } });
  });

  it('answers the same, and mails nobody, when another account has the address', async () => {
    const mail = catchMail();
    await enableMail(harness.db);
    await harness.db
      .insert(user)
      .values({ id: 'other', name: 'Other', email: 'bob@new.example', emailVerified: true });
    const account = await sessionWithEmail(harness.db, OLD);
    const free = await ask(account.bearer, NEW);
    mail.sent.length = 0;
    mailThrottleReset();
    const taken = await ask(account.bearer, 'bob@new.example');
    expect(taken.status).toBe(free.status);
    expect(Object.keys(await taken.json())).toEqual(Object.keys(await free.json()));
    expect(mail.sent).toHaveLength(0);
    expect(await emailOf(account.userId)).toEqual({ email: OLD, verified: true });
    expect(await emailOf('other')).toEqual({ email: 'bob@new.example', verified: true });
  });

  it('kills the earlier link when a new address is asked for', async () => {
    const mail = catchMail();
    await enableMail(harness.db);
    const account = await sessionWithEmail(harness.db, OLD);
    await ask(account.bearer, NEW);
    const first = changeTokenIn(mail.sent[0]);
    mailThrottleReset();
    await ask(account.bearer, 'ada@third.example');
    expect(await spend(first)).toBe(410);
    expect(await spend(changeTokenIn(mail.sent[1]))).toBe(200);
    expect((await emailOf(account.userId)).email).toBe('ada@third.example');
  });

  it('can be cancelled, and the link dies with it', async () => {
    const mail = catchMail();
    await enableMail(harness.db);
    const account = await sessionWithEmail(harness.db, OLD);
    await ask(account.bearer, NEW);
    const cancel = () =>
      DELETE(
        new Request('http://localhost/api/me/email', {
          method: 'DELETE',
          headers: { authorization: account.bearer },
        }),
      );
    expect((await cancel()).status).toBe(204);
    expect((await cancel()).status).toBe(204);
    expect(await spend(changeTokenIn(mail.sent[0]))).toBe(410);
    expect(await harness.db.select().from(emailChanges)).toHaveLength(0);
    expect((await emailOf(account.userId)).email).toBe(OLD);
  });

  it('needs a signed-in account', async () => {
    const anonymous = await POST(request({ email: NEW }));
    expect(anonymous.status).toBe(401);
  });

  it('limits an account to ten requests an hour', async () => {
    catchMail();
    await enableMail(harness.db);
    const account = await sessionWithEmail(harness.db, OLD);
    for (let i = 0; i < 10; i++) {
      expect((await ask(account.bearer, `try${i}@new.example`)).status).toBe(202);
    }
    const eleventh = await ask(account.bearer, 'try10@new.example');
    expect(eleventh.status).toBe(429);
    expect(await eleventh.json()).toMatchObject({ error: { code: 'rate_limited' } });
  });
});

const mailThrottleReset = () => mailThrottle.reset();
