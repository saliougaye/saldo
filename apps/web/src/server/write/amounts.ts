import { amountBufferToMinor, type MinorDigits, sanitizeAmountInput } from '@saldo/core';

/**
 * A balance buffer one the keypad could have typed in this currency, minus sign allowed (a card
 * may be in debt): `sanitizeAmountInput` leaves it as it is and its minor units are a safe integer.
 * An edit may send back the stored value's own buffer untouched (`stored`), which an import or the
 * phone may have written larger than the keypad types.
 */
export function signedBufferOk(buffer: string, minorDigits: MinorDigits, stored?: string): boolean {
  if (stored !== undefined && buffer === stored) return true;
  if (buffer !== sanitizeAmountInput(buffer, minorDigits, { allowNegative: true })) return false;
  return Number.isSafeInteger(amountBufferToMinor(buffer, minorDigits));
}
