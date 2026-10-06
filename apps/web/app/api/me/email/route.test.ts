import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { settleBackground } from '../../../../src/server/background';
import { user } from '../../../../src/server/db/schema';
import { createTestDatabase, type TestDatabase } from '../../../../src/server/test/harness';
import { catchMail, enableMail, stopCatchingMail } from '../../../../src/server/test/mail';
import { createTestSession } from '../../../../src/server/test/session';
import { POST } from './route';

let harness: TestDatabase;

beforeAll(async () => {
  harness = await createTestDatabase();
});

afterEach(async () => {
  await harness.reset();
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
