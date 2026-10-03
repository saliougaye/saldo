import { z } from 'zod';
import {
  CURRENCY_CODES,
  type CurrencyCode,
  formatMinorUnits,
  getCurrency,
  type MinorDigits,
} from '../money';

/**
 * An amount as a tool returns it (§17.4.2): the integer the app stores, its currency, and the same
 * value as a plain decimal the model can read. Arithmetic goes back to `minor`.
 */
export type Money = { minor: number; currency: string; amount: string };

export const moneySchema = z.object({
  minor: z
    .number()
    .int()
    .describe('The amount in integer minor units (cents for EUR). Do arithmetic on this.'),
  currency: z.string().describe('ISO 4217 currency code.'),
  amount: z
    .string()
    .describe('The same amount as a plain decimal string, e.g. "123.45". Read this one.'),
});

/** Two decimals for a code this build does not know: what most currencies use. */
const FALLBACK_MINOR_DIGITS: MinorDigits = 2;

function isCurrencyCode(value: string): value is CurrencyCode {
  return (CURRENCY_CODES as readonly string[]).includes(value);
}

/** `12345, 'EUR'` → `{ minor: 12345, currency: 'EUR', amount: '123.45' }` (`formatMinorUnits`). */
export function toMoney(minor: number, currency: string): Money {
  const digits = isCurrencyCode(currency)
    ? getCurrency(currency).minorDigits
    : FALLBACK_MINOR_DIGITS;
  return { minor, currency, amount: formatMinorUnits(minor, digits) };
}
