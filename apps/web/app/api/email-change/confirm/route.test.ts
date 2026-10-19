import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { resetEmailChangeLimitForTests } from '../../../../src/server/auth/emailChange';
import { settleBackground } from '../../../../src/server/background';
import { emailChanges, session, user } from '../../../../src/server/db/schema';
import { mailThrottle } from '../../../../src/server/mail/throttle';
import { changeTokenIn, sessionWithEmail } from '../../../../src/server/test/emailChange';
import { createTestDatabase, type TestDatabase } from '../../../../src/server/test/harness';
import {
  catchMail,
  enableMail,
  type MailCatcher,
  stopCatchingMail,
} from '../../../../src/server/test/mail';
import { POST as requestChange } from '../../me/email/route';
import { POST } from './route';

let harness: TestDatabase;
let mail: MailCatcher;

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

const OLD = 'ada@old.example';
const NEW = 'ada@new.example';

/** Signs in an account with a real address, asks for a change and returns the token the mail carried. */
async function pendingChange(options: { verified?: boolean } = {}) {
  mail = catchMail();
  await enableMail(harness.db);
  const account = await sessionWithEmail(harness.db, OLD, options);
  const response = await requestChange(
    new Request('http://localhost/api/me/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: account.bearer },
      body: JSON.stringify({ email: NEW }),
    }),
  );
  expect(response.status).toBe(202);
  await settleBackground();
  const token = changeTokenIn(mail.sent[0]);
  mail.sent.length = 0;
  return { account, token };
}

function confirm(body: unknown): Promise<Response> {
  return POST(
    new Request('http://localhost/api/email-change/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

async function emailOf(userId: string) {
  const [row] = await harness.db.select().from(user).where(eq(user.id, userId));
  return { email: row?.email, verified: row?.emailVerified };
}

describe('POST /api/email-change/confirm', () => {
  it('swaps the address when the link is used, and verifies the new one', async () => {
    const { account, token } = await pendingChange();
    const sessionsBefore = await harness.db.select().from(session);
    const response = await confirm({ token });
    await settleBackground();
    expect(response.status).toBe(200);
    expect(await emailOf(account.userId)).toEqual({ email: NEW, verified: true });
    // Opening the link signs nobody in: no cookie, no new session (Better Auth's own flow does both).
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(await harness.db.select().from(session)).toHaveLength(sessionsBefore.length);
  });

  it('tells the old address, without a link and without the full new address', async () => {
    const { token } = await pendingChange();
    await confirm({ token });
    await settleBackground();
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0]?.to).toBe(OLD);
    expect(mail.sent[0]?.text).toContain('a***@new.example');
    expect(mail.sent[0]?.text).not.toContain(NEW);
    expect(mail.sent[0]?.text).not.toContain('http');
  });

  it('does not tell an old address that was never verified', async () => {
    const { token } = await pendingChange({ verified: false });
    expect((await confirm({ token })).status).toBe(200);
    await settleBackground();
    expect(mail.sent).toHaveLength(0);
  });

  it('tells the old address even when its mailbox has used up the throttle', async () => {
    const { token } = await pendingChange();
    for (let i = 5; i > 0; i--) mailThrottle.allow('verification', OLD, Date.now() - i * 61_000);
    expect(mailThrottle.allow('recovery', OLD, Date.now())).toBe(false);
    await confirm({ token });
    await settleBackground();
    expect(mail.sent.map((m) => m.to)).toEqual([OLD]);
  });

  it('keeps the swap when the notice cannot be sent', async () => {
    const { account, token } = await pendingChange();
    mail.failWith(new Error('smtp down'));
    expect((await confirm({ token })).status).toBe(200);
    await settleBackground();
    expect((await emailOf(account.userId)).email).toBe(NEW);
  });

  it('refuses a link that was already used', async () => {
    const { account, token } = await pendingChange();
    expect((await confirm({ token })).status).toBe(200);
    // Regression guard for Better Auth's /change-email: its token is a JWT that can be replayed, and
    // finds the account by the OLD address, so a person who registers that address next gets swapped.
    await harness.db
      .insert(user)
      .values({ id: 'newcomer', name: 'N', email: OLD, emailVerified: true });
    const again = await confirm({ token });
    expect(again.status).toBe(410);
    expect(await emailOf('newcomer')).toEqual({ email: OLD, verified: true });
    expect((await emailOf(account.userId)).email).toBe(NEW);
  });

  it('refuses an expired link', async () => {
    const { account, token } = await pendingChange();
    await harness.db
      .update(emailChanges)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(emailChanges.userId, account.userId));
    expect((await confirm({ token })).status).toBe(410);
    expect((await emailOf(account.userId)).email).toBe(OLD);
  });

  it('refuses an address another account took after the link was sent', async () => {
    const { account, token } = await pendingChange();
    await harness.db
      .insert(user)
      .values({ id: 'other', name: 'Other', email: NEW, emailVerified: true });
    const response = await confirm({ token });
    await settleBackground();
    expect(response.status).toBe(410);
    expect(await emailOf(account.userId)).toEqual({ email: OLD, verified: true });
    expect(mail.sent).toHaveLength(0);
  });

  it('refuses a revoked account', async () => {
    const { account, token } = await pendingChange();
    await harness.db.update(user).set({ banned: true }).where(eq(user.id, account.userId));
    expect((await confirm({ token })).status).toBe(410);
    expect((await emailOf(account.userId)).email).toBe(OLD);
  });

  it('refuses when the account address is no longer the one the request began with', async () => {
    const { account, token } = await pendingChange();
    await harness.db
      .update(user)
      .set({ email: 'changed.by.hand@old.example' })
      .where(eq(user.id, account.userId));
    expect((await confirm({ token })).status).toBe(410);
    expect((await emailOf(account.userId)).email).toBe('changed.by.hand@old.example');
  });

  it.each([['garbled'], ['a'.repeat(64)], ['']])('refuses the token %j', async (token) => {
    const { account } = await pendingChange();
    expect((await confirm({ token })).status).toBe(token === '' ? 400 : 410);
    expect((await emailOf(account.userId)).email).toBe(OLD);
  });

  it('refuses a body without a token', async () => {
    expect((await confirm({})).status).toBe(400);
  });
});
