import type { CurrencyCode } from '@saldo/core';
import { type AppLocale, formatMoneyParts } from '@saldo/i18n';

/**
 * Four dots whatever the amount: a dot per digit would tell the person behind you how many digits
 * the balance has, which is most of what they wanted to know.
 */
export const MASK = '••••';

/** `•••• €` (or `$••••`): the mask with the currency symbol where the locale puts it. */
export function maskedMoney(currency: CurrencyCode, locale: AppLocale): string {
  const parts = formatMoneyParts(0, currency, locale, 'never');
  return parts.symbolPosition === 'prefix' ? `${parts.symbol}${MASK}` : `${MASK} ${parts.symbol}`;
}
