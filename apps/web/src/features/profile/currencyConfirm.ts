import { type CurrencyCode, getCurrency } from '@saldo/core';
import { type AppLocale, formatMoney } from '@saldo/i18n/format';
import { interpolate } from '@saldo/i18n/translate';

/** The figure the phone's dialog shows before and after: enough digits for the point to move visibly. */
const SAMPLE_MINOR = 184260;

/**
 * What the «Cambiare valuta?» dialog says (§5.1), as on the phone. Changing the currency reformats
 * and never converts; when the two currencies keep a different number of decimals the point moves,
 * and the copy says so with a number rather than a generic sentence.
 */
export function currencyConfirmBody(input: {
  current: CurrencyCode;
  pending: CurrencyCode;
  locale: AppLocale;
  /** `profile.currencyConfirmBody`, and `profile.currencyConfirmScale` with `{{before}}`/`{{after}}`. */
  strings: { body: string; scale: string };
}): string {
  const { current, pending, locale, strings } = input;
  if (getCurrency(pending).minorDigits === getCurrency(current).minorDigits) return strings.body;
  return interpolate(strings.scale, {
    before: formatMoney(SAMPLE_MINOR, current, locale),
    after: formatMoney(SAMPLE_MINOR, pending, locale),
  });
}
