/**
 * What `/recover` shows before any request is made. `errorCallbackURL` sends the browser to
 * `/recover?error=<code>`, the code being Better Auth's own (`INVALID_TOKEN`, …: it overwrites any
 * `error` we put on the URL), so any non-empty `error` means the link did not work.
 */
export type RecoverState = 'unavailable' | 'form' | 'expiredLink';

export function recoverState(input: {
  mailEnabled: boolean;
  error: string | undefined;
}): RecoverState {
  if (!input.mailEnabled) return 'unavailable';
  return input.error === undefined || input.error === '' ? 'form' : 'expiredLink';
}

/**
 * What the form says once the request is back. It is the **same** sentence whatever the address
 * was and whatever the endpoint answered — a 404, a 500 or a dropped connection included — so the
 * page cannot be used to learn which addresses have an account. Only a rate limit, which depends
 * on the caller and not on the address, is told apart.
 */
export type RecoverAnswer = 'sent' | 'rateLimited';

export function recoverAnswer(failure: { status?: number } | null): RecoverAnswer {
  return failure?.status === 429 ? 'rateLimited' : 'sent';
}

/** Where the recovery mail points: a page of ours that asks before it signs anybody in. */
export const RECOVERY_CONFIRM_PATH = '/recover/confirm';
/** Where a recovery link lands once it has signed the browser in, and where a dead one sends it. */
export const RECOVERED_PATH = '/profile/passkeys?recovered';
/** Better Auth sets `?error=<its code>` on this itself, so the query is left to it. */
export const RECOVERY_ERROR_PATH = '/recover';

/**
 * What the confirm page's button opens. `/magic-link/verify` is a GET that spends the token and sets
 * the session, so it is opened only by a person pressing a button (a mail scanner or a cross-site
 * request that merely loads the page never reaches it), and with our callbacks, never the caller's.
 */
export function recoveryVerifyPath(token: string): string {
  const query = new URLSearchParams({
    token,
    callbackURL: RECOVERED_PATH,
    errorCallbackURL: RECOVERY_ERROR_PATH,
  });
  return `/api/auth/magic-link/verify?${query.toString()}`;
}
