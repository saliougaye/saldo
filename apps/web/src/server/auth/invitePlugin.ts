import type { BetterAuthPlugin } from 'better-auth';
import { APIError, createAuthEndpoint } from 'better-auth/api';
import { z } from 'zod';
import { getDb } from '../db/client';
import type { RegistrationMode } from '../env';
import { inviteIsUsable } from './invites';
import { registrationRequiresInvite } from './policy';

/** Tighter than the instance's 20/minute: a code is 80 random bits, so guessing is hopeless anyway,
 * and the only reason to call this in a loop is to find out which codes exist. */
const WINDOW_SECONDS = 60;
const MAX_PER_WINDOW = 10;

/** The longest thing worth parsing as a code: 16 symbols, dashes, and a generous margin for spaces. */
const MAX_CODE_LENGTH = 64;

/**
 * `POST /api/auth/invite/check` (§17.1.7, auth pages). It exists so step 2 of `/register` can refuse a
 * bad code **before** the passkey ceremony. It is a convenience and never the gate: `resolveUser`
 * checks the code again and `completeRegistration` is what spends it, so a caller that skips this
 * endpoint gains nothing.
 *
 * It is a Better Auth endpoint rather than a route of our own so that it sits behind the same rate
 * limiter, the same trusted-proxy IP resolution and the same origin handling as `/sign-in*` — one
 * limiter for the instance, not two with different ideas of who the caller is.
 *
 * `mode` is a getter, asked on every call: a mode the admin saves is honoured without rebuilding
 * the instance.
 */
export function invitePlugin(mode: () => Promise<RegistrationMode>) {
  return {
    id: 'saldo-invite',
    endpoints: {
      checkInvite: createAuthEndpoint(
        '/invite/check',
        { method: 'POST', body: z.object({ invite: z.string().max(MAX_CODE_LENGTH) }) },
        async (ctx) => {
          // Nothing to check on a server that does not ask for a code: the form never shows the step.
          if (!registrationRequiresInvite(await mode())) return ctx.json({ valid: true });
          if (!(await inviteIsUsable(getDb(), ctx.body.invite, new Date()))) {
            // One answer for unknown, spent, revoked and expired — the same one `resolveUser` gives.
            throw new APIError('FORBIDDEN', {
              code: 'invalid_invite',
              message: 'That invite code is not valid',
            });
          }
          return ctx.json({ valid: true });
        },
      ),
    },
    rateLimit: [
      {
        pathMatcher: (path: string) => path === '/invite/check',
        window: WINDOW_SECONDS,
        max: MAX_PER_WINDOW,
      },
    ],
  } satisfies BetterAuthPlugin;
}
