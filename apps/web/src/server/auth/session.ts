import { auth } from './auth';

export interface AuthenticatedUser {
  id: string;
  displayName: string;
  /** Synthetic (`@passkey.saldo.invalid`) for an account created before D32; see `email.ts`. */
  email: string;
  emailVerified: boolean;
  /**
   * `ADMIN_ROLE`, `MEMBER_ROLE`, or null for an account older than roles. Read with the session, so
   * it is good for a page render only: a Server Action and an admin route call `isAdmin` again.
   */
  role: string | null;
}

/**
 * The one place a session is read. The `bearer` plugin lets `getSession` take the token out of the
 * Authorization header, and a browser's cookie arrives in the same headers — so the phone's bearer
 * and the web's cookie session are literally one call (§17.1.4).
 *
 * The revocation check is ours and is deliberately not left to the library: better-auth only tests
 * the ban flag when a session is **created**, so a live token would otherwise survive until its
 * session row happened to be deleted. §10 promises a revoked account stops at once, and that promise
 * is kept here rather than by remembering to delete rows everywhere else.
 *
 * `banned` and `role` come from the admin plugin, on the user row that `getSession` reads with the
 * session: no second query, and no older answer. That holds only while `getSession` reads the
 * database on every call. A `session.cookieCache` (or a `secondaryStorage`) in `auth.ts` would let
 * `banned` arrive late: with one, read the flag from the database here again. In `session.test.ts`,
 * «reads the database on every call» fails when either one appears; the ban tests with live
 * session rows prove the check below.
 */
export async function authenticate(headers: Headers): Promise<AuthenticatedUser | null> {
  const session = await auth().api.getSession({ headers });
  if (session === null) return null;
  if (session.user.banned === true) return null;
  return {
    id: session.user.id,
    displayName: session.user.name,
    email: session.user.email,
    emailVerified: session.user.emailVerified,
    role: session.user.role ?? null,
  };
}
