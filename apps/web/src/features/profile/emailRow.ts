import { isSyntheticEmail } from '../../server/auth/email';

/**
 * Profilo → Account's email row (§17.1.4):
 * - `verified`: the address is confirmed;
 * - `canVerify`: a real, unconfirmed address and the server can mail — the button is offered;
 * - `mailOff`: a real, unconfirmed address and the server sends no mail — it stays so;
 * - `synthetic`: there is no address to confirm (an account from before D32).
 */
export type EmailRowState = 'verified' | 'canVerify' | 'mailOff' | 'synthetic';

export function emailRowState(input: {
  email: string;
  emailVerified: boolean;
  mailEnabled: boolean;
}): EmailRowState {
  if (isSyntheticEmail(input.email)) return 'synthetic';
  if (input.emailVerified) return 'verified';
  return input.mailEnabled ? 'canVerify' : 'mailOff';
}
