import type { SignedInUser } from '../../auth/session';

/**
 * §9.1's placeholder domain, in the reserved `.invalid` TLD. The web knows it as
 * `SYNTHETIC_EMAIL_DOMAIN`; the phone cannot import from `apps/web`, so the constant is written twice
 * — and changing it would be a server migration anyway, not a rename.
 */
const SYNTHETIC_DOMAIN = 'passkey.saldo.invalid';

/**
 * Whether this account still has no real address (D32). The phone then asks for one, in onboarding and
 * on the server screen, which is how an account created before 0.3b gets one.
 */
export function needsEmail(user: SignedInUser | null): boolean {
  if (user === null) return false;
  const at = user.email.lastIndexOf('@');
  return at !== -1 && user.email.slice(at + 1).toLowerCase() === SYNTHETIC_DOMAIN;
}

/**
 * Enough to know the field is worth sending: `POST /api/me/email` is what actually decides, with the
 * same rule for every client. This only spares the person a round trip.
 */
export function emailLooksValid(input: string): boolean {
  const value = input.trim();
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(value) && value.length <= 254;
}
