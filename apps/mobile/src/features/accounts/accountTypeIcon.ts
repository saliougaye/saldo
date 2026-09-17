import type { AccountType } from '@saldo/core';
import type { IconName } from '@saldo/ui';

/**
 * The glyph an account type is drawn with where no account exists yet to carry its own icon: the
 * onboarding tiles, and the first account that onboarding creates. Both cards share `card`; the
 * type's label is what tells them apart.
 */
export const ACCOUNT_TYPE_ICONS = {
  cash: 'coins',
  checking: 'landmark',
  debit_card: 'card',
  credit_card: 'card',
  savings: 'piggy',
  investment: 'trend',
} as const satisfies Record<AccountType, IconName>;
