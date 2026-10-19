import { z } from 'zod';
import { confirmEmailChange } from '../../../../src/server/auth/emailChange';
import { getDb } from '../../../../src/server/db/client';
import { ApiError, handle } from '../../../../src/server/http/errors';
import { readJson } from '../../../../src/server/http/json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ token: z.string().min(1).max(200) });

/**
 * Spends the link that `POST /api/me/email` mailed to the new address. Public on purpose: the token is
 * the proof (32 random bytes, stored hashed, used once), the person opens it in whatever browser the
 * mail app picks, and nothing here reads or creates a session. Every failure is the same 410.
 */
export function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const { token } = await readJson(request, schema);
    const result = await confirmEmailChange(getDb(), {
      token,
      acceptLanguage: request.headers.get('accept-language'),
      now: new Date(),
    });
    if (!result.ok) throw new ApiError(410, 'link_invalid', 'This link no longer works');
    return Response.json({ status: 'changed' });
  });
}
