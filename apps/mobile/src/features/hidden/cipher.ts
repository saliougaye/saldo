import type { CurrencyCode } from '@saldo/core';
import { type AppLocale, formatMoneyParts } from '@saldo/i18n';

/**
 * Timing of the "Cipher" motion chosen from the 2026-09-22 mockup: the digits are scrambled for
 * `steps × stepMs`, then the dots settle over them in a `fadeMs` crossfade. On reveal the digits
 * arrive scrambled and settle to the real value right to left, one every `settleMs`.
 *
 * Slower than the rest of the app's motion on purpose: the scramble *is* the message, and it needs
 * to be read. Reduce Motion skips it and crossfades in `reducedMs`.
 */
export const CIPHER = {
  steps: 4,
  stepMs: 60,
  fadeMs: 160,
  settleMs: 30,
  reducedMs: 120,
} as const;

/**
 * Four dots whatever the amount: a dot per digit would tell the person behind you how many digits
 * the balance has, which is most of what they wanted to know.
 */
export const MASK = '••••';

export type Rng = () => number;

const DIGIT = /[0-9]/;

function randomDigit(rng: Rng): string {
  return String(Math.min(9, Math.floor(rng() * 10)));
}

/** Every digit replaced by a random one; signs, separators and symbols stay where they are. */
export function scrambleDigits(text: string, rng: Rng = Math.random): string {
  return [...text].map((ch) => (DIGIT.test(ch) ? randomDigit(rng) : ch)).join('');
}

/** How many `0-9` glyphs `text` contains. */
export function digitCount(text: string): number {
  return [...text].filter((ch) => DIGIT.test(ch)).length;
}

/**
 * The last `settledFromRight` digits are the real ones, every digit before them is still scrambled.
 * `settledFromRight >= digitCount(text)` returns `text` unchanged.
 */
export function settleDigits(text: string, settledFromRight: number, rng: Rng = Math.random): string {
  const total = digitCount(text);
  const scrambled = Math.max(0, total - settledFromRight);
  let seen = 0;
  return [...text]
    .map((ch) => {
      if (!DIGIT.test(ch)) return ch;
      seen += 1;
      return seen <= scrambled ? randomDigit(rng) : ch;
    })
    .join('');
}

/** `•••• €` (or `$••••`): the mask with the currency symbol where the locale puts it. */
export function maskedMoney(currency: CurrencyCode, locale: AppLocale): string {
  const parts = formatMoneyParts(0, currency, locale, 'never');
  return parts.symbolPosition === 'prefix' ? `${parts.symbol}${MASK}` : `${MASK} ${parts.symbol}`;
}
