import type { CurrencyCode } from '@saldo/core';
import { CURRENCY_NAMES } from './currencyNames.generated';
import type { AppLocale } from './format';

/** Typed here so a locale or a code missing from the generated table fails `tsc`, not a screen. */
const NAMES: Record<AppLocale, Record<CurrencyCode, string>> = CURRENCY_NAMES;

/** "Franco svizzero", "Swiss franc": the currency's name in the app's language (§6.25). */
export function currencyName(code: CurrencyCode, locale: AppLocale): string {
  return NAMES[locale][code];
}
