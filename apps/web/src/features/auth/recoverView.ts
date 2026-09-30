/** What `/recover` shows before any request is made. `?error=link` is where `errorCallbackURL` sends the browser. */
export type RecoverState = 'unavailable' | 'form' | 'expiredLink';

export function recoverState(input: {
  mailEnabled: boolean;
  error: string | undefined;
}): RecoverState {
  if (!input.mailEnabled) return 'unavailable';
  return input.error === 'link' ? 'expiredLink' : 'form';
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
