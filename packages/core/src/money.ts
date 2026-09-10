import { CURRENCY_CODES, CURRENCY_TABLE } from './currencies.generated';

export { CURRENCY_CODES, CURRENCY_TABLE };

/** Amounts are always integer minor units of the app currency (cents, fils, or whole yen). */
export type MinorUnits = number;

export type CurrencyCode = (typeof CURRENCY_CODES)[number];

/** Decimal places a currency's minor unit uses. CLDR only produces these three. */
export type MinorDigits = 0 | 2 | 3;

export interface Currency {
  code: CurrencyCode;
  symbol: string;
  minorDigits: MinorDigits;
}

/** Shown at the top of the currency picker before the full alphabetical list. */
export const COMMON_CURRENCY_CODES = ['EUR', 'USD', 'GBP', 'CHF'] as const;

export function getCurrency(code: CurrencyCode): Currency {
  return CURRENCY_TABLE[code];
}

/** Digits the keypad accepts in total, split between the integer and fractional part. */
export const MAX_AMOUNT_SIGNIFICANT_DIGITS = 8;

/** Integer digits the keypad accepts: 6 for a 2-decimal currency, 8 for yen, 5 for dinar. */
export function maxIntegerDigits(minorDigits: MinorDigits): number {
  return MAX_AMOUNT_SIGNIFICANT_DIGITS - minorDigits;
}

export type AmountKey =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | 'decimal'
  | 'del';

/**
 * Keypad reducer. The buffer uses `.` as decimal separator regardless of locale;
 * the UI shows `,` or `.` on the key. Currencies without a minor unit ignore the key.
 */
export function pressAmountKey(buffer: string, key: AmountKey, minorDigits: MinorDigits): string {
  if (key === 'del') return buffer.slice(0, -1);
  if (key === 'decimal') {
    if (minorDigits === 0) return buffer;
    return buffer.length > 0 && !buffer.includes('.') ? `${buffer}.` : buffer;
  }
  const [integerPart = '', decimalPart] = buffer.split('.');
  if (decimalPart !== undefined) return decimalPart.length >= minorDigits ? buffer : buffer + key;
  if (integerPart === '0') return key;
  if (integerPart.length >= maxIntegerDigits(minorDigits)) return buffer;
  return buffer + key;
}

export function amountBufferToMinor(buffer: string, minorDigits: MinorDigits): MinorUnits {
  if (buffer.length === 0) return 0;
  const [integerPart = '', decimalPart = ''] = buffer.split('.');
  const fraction = decimalPart.padEnd(minorDigits, '0').slice(0, minorDigits);
  return Number(integerPart || '0') * 10 ** minorDigits + Number(fraction || '0');
}

export function minorToAmountBuffer(minor: MinorUnits, minorDigits: MinorDigits): string {
  const scale = 10 ** minorDigits;
  const abs = Math.abs(Math.trunc(minor));
  const integer = Math.floor(abs / scale);
  const fraction = abs % scale;
  if (fraction === 0) return String(integer);
  return `${integer}.${String(fraction).padStart(minorDigits, '0').replace(/0+$/, '')}`;
}

/**
 * Parses a human-entered or CSV amount such as `1.842,60 €`, `-1,234.56` or `¥1,200`.
 * Everything that is not a digit, sign or separator is dropped, so any currency symbol
 * or code may surround the number. Rounds half up to the currency scale.
 * Returns null when the input is not a number.
 */
export function parseDecimalAmount(
  input: string,
  decimalSeparator: '.' | ',',
  minorDigits: MinorDigits,
): MinorUnits | null {
  const thousandsSeparator = decimalSeparator === ',' ? '.' : ',';
  let normalized = input
    .trim()
    .replace(/\u2212/g, '-')
    .replace(/[^\d+\-.,]/g, '');
  normalized = normalized.split(thousandsSeparator).join('');
  if (decimalSeparator === ',') normalized = normalized.replace(',', '.');
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(normalized);
  if (!match) return null;
  const fraction = (match[3] ?? '').padEnd(minorDigits + 1, '0');
  const roundUp = Number(fraction[minorDigits] ?? '0') >= 5 ? 1 : 0;
  const value =
    Number(match[2]) * 10 ** minorDigits + Number(fraction.slice(0, minorDigits) || '0') + roundUp;
  if (value === 0) return 0;
  return match[1] === '-' ? -value : value;
}
