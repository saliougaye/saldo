import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { auth } from '../../../../src/server/auth/auth';
import {
  emailIsTaken,
  isSyntheticEmail,
  MAX_EMAIL_LENGTH,
  normaliseEmail,
} from '../../../../src/server/auth/email';
import { cancelEmailChange, startEmailChange } from '../../../../src/server/auth/emailChange';
import { requestVerification } from '../../../../src/server/auth/mailCallbacks';
import { getDb } from '../../../../src/server/db/client';
import { user } from '../../../../src/server/db/schema';
import { ApiError, handle } from '../../../../src/server/http/errors';
import { readJson } from '../../../../src/server/http/json';
import { requireUser } from '../../../../src/server/http/requireUser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ email: z.string().max(MAX_EMAIL_LENGTH) });

/**
 * D32: every account carries an email. An account created before that has the synthetic address of
 * §9.1, and this is how it gets a real one — from the phone's onboarding or its server screen
 * (§17.1.4), and later from Profile on the web.
 *
 * Filling an empty seat needs no proof. Replacing a real address does: with SMTP the new one is mailed
 * a link and the address changes when the link is used (`auth/emailChange.ts`); without SMTP the answer
 * to "change my email" stays 409. Starting that change needs a session that a passkey ceremony created
 * in the last 5 minutes (`auth/freshSession.ts`): an older one gets `403 reauth_required`. Filling a
 * synthetic address has no such rule, because there is no real address to protect yet.
 */
export function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const account = await requireUser(request);
    const body = await readJson(request, schema);
    const email = normaliseEmail(body.email);
    if (email === null) {
      throw new ApiError(400, 'invalid_email', 'That is not an email address');
    }
    const db = getDb();
    if (!isSyntheticEmail(account.email)) {
      // A real address is replaced only with proof that the new one is read by the person, which is a
      // mailed link, so a server without SMTP cannot do it.
      const result = await startEmailChange(db, {
        userId: account.id,
        currentEmail: account.email,
        newEmail: email,
        acceptLanguage: request.headers.get('accept-language'),
        sessionCreatedAt: account.sessionCreatedAt,
        now: new Date(),
      });
      if (!result.ok) {
        if (result.reason === 'mail_off') {
          throw new ApiError(409, 'email_already_set', 'This account already has an email address');
        }
        if (result.reason === 'reauth') {
          throw new ApiError(
            403,
            'reauth_required',
            'Sign in with your passkey again to change the email address',
          );
        }
        if (result.reason === 'unchanged') {
          throw new ApiError(400, 'email_unchanged', 'That is already the address of this account');
        }
        throw new ApiError(429, 'rate_limited', 'Too many requests: try again later');
      }
      // Not 200 and not an `email`: nothing has changed yet. The same answer whether or not another
      // account has the address.
      return Response.json({ pending: result.pending }, { status: 202 });
    }
    if (await emailIsTaken(db, email, account.id)) {
      throw new ApiError(409, 'email_taken', 'That email already has an account');
    }
    // `emailVerified` stays false: nothing has proved the mailbox is theirs. The column is the
    // record of that, not a formality; the link sent below is what flips it.
    await db.update(user).set({ email, emailVerified: false }).where(eq(user.id, account.id));
    // Best effort, in the background, and only when the server has SMTP: the answer is the same
    // either way and a mail that fails does not undo the address.
    const { secret, baseURL } = await auth().$context;
    requestVerification(db, {
      userId: account.id,
      secret,
      baseURL,
      acceptLanguage: request.headers.get('accept-language'),
    });
    return Response.json({ email, emailVerified: false });
  });
}

/** Withdraws a pending change: its link stops working. Nothing pending is not an error. */
export function DELETE(request: Request): Promise<Response> {
  return handle(async () => {
    const account = await requireUser(request);
    await cancelEmailChange(getDb(), account.id);
    return new Response(null, { status: 204 });
  });
}
