import type { AccountType } from '@saldo/core';
import type { IconName } from './icons';

/**
 * The glyph an account type is drawn with where no account exists yet to carry its own icon: the
 * onboarding tiles, and the first account that onboarding creates — on the phone and on the web.
 * Both cards share `card`; the type's label is what tells them apart.
 */
export const accountTypeIcons = {
  cash: 'coins',
  checking: 'landmark',
  debit_card: 'card',
  credit_card: 'card',
  savings: 'piggy',
  investment: 'trend',
  pocket: 'target',
} as const satisfies Record<AccountType, IconName>;
