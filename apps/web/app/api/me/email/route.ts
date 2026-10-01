import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { auth } from '../../../../src/server/auth/auth';
import {
  emailIsTaken,
  isSyntheticEmail,
  MAX_EMAIL_LENGTH,
  normaliseEmail,
} from '../../../../src/server/auth/email';
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
 * It only ever fills an empty seat: replacing a real address means proving the new one belongs to the
 * person. With SMTP that is buildable, and is a follow-up (`TODO.md`); until then the answer to
 * "change my email" is 409.
 */
export function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const account = await requireUser(request);
    const body = await readJson(request, schema);
    const email = normaliseEmail(body.email);
    if (email === null) {
      throw new ApiError(400, 'invalid_email', 'That is not an email address');
    }
    if (!isSyntheticEmail(account.email)) {
      throw new ApiError(409, 'email_already_set', 'This account already has an email address');
    }
    const db = getDb();
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
