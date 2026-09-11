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

/**
 * Normalises whatever the device's numeric keyboard produced into an amount buffer (§5.1).
 *
 * The buffer always uses `.` as its decimal separator, but the system keypad emits `.` or `,`
 * depending on the device locale, so both are accepted. Anything else is dropped rather than
 * rejected: a keyboard can deliver a paste, a minus sign or a second separator, and refusing the
 * whole edit would leave the field stuck.
 *
 * Limits mirror the old on-screen keypad: `maxIntegerDigits(minorDigits)` before the separator,
 * `minorDigits` after it, and no separator at all for a currency without a minor unit.
 */
export function sanitizeAmountInput(text: string, minorDigits: MinorDigits): string {
  const digitsAndSeparators = text.replace(/[^0-9.,]/g, '').replace(/,/g, '.');
  const [rawInteger = '', ...rest] = digitsAndSeparators.split('.');
  // Only the first separator counts; later ones join the fraction.
  const rawFraction = rest.join('');

  let integer = rawInteger.replace(/^0+(?=\d)/, '').slice(0, maxIntegerDigits(minorDigits));
  if (integer.length === 0 && rawInteger.length > 0) integer = '0';

  if (minorDigits === 0 || rest.length === 0) return integer;
  return `${integer.length === 0 ? '0' : integer}.${rawFraction.slice(0, minorDigits)}`;
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
 * `12345` → `123.45`: always `minorDigits` decimals, a `.` separator, no grouping and no symbol.
 * This is the machine-readable form of §11.2, the one a spreadsheet and a re-import both accept —
 * unlike `minorToAmountBuffer`, which drops trailing zeros because a keypad buffer must.
 */
export function formatMinorUnits(minor: MinorUnits, minorDigits: MinorDigits): string {
  const scale = 10 ** minorDigits;
  const negative = minor < 0;
  const abs = Math.abs(Math.trunc(minor));
  const integer = Math.floor(abs / scale);
  const body =
    minorDigits === 0
      ? String(integer)
      : `${integer}.${String(abs % scale).padStart(minorDigits, '0')}`;
  return negative ? `-${body}` : body;
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
