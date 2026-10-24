/** How long after a passkey ceremony a session may start a change of the email address. */
export const FRESH_SESSION_SECONDS = 300;

/**
 * A session is fresh when a passkey ceremony created it a short time ago. `createdAt` is the right
 * clock: the session slides, so `updatedAt` and `expiresAt` move on every use and say nothing about
 * the ceremony. A `createdAt` in the future is a clock fault and is not fresh.
 */
export function isFreshSession(createdAt: Date, now: Date): boolean {
  const age = now.getTime() - createdAt.getTime();
  return age >= 0 && age <= FRESH_SESSION_SECONDS * 1000;
}
