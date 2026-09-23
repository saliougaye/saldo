import { type MinorDigits, maxIntegerDigits, toggleAmountBufferSign } from './money';

/** What a keypad can send. Digits are their own characters; the rest are named. */
export type AmountKeypadKey =
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
  | 'separator'
  | 'delete'
  | 'sign';

export interface AmountKeypadOptions {
  /**
   * Only a balance may go below zero (§5.1); elsewhere the sign key is not drawn, and a press that
   * reached this function anyway leaves the buffer alone.
   */
  allowNegative?: boolean;
}

/**
 * One key press against an amount buffer (§5.1). Pure, and the same limits as
 * `sanitizeAmountInput` — but expressed as an edit rather than as a re-parse, because a keypad
 * knows exactly what changed and a re-parse cannot tell `12.` from `12`.
 */
export function pressAmountKey(
  buffer: string,
  key: AmountKeypadKey,
  minorDigits: MinorDigits,
  options: AmountKeypadOptions = {},
): string {
  if (key === 'sign') {
    return options.allowNegative === true ? toggleAmountBufferSign(buffer) : buffer;
  }

  const negative = buffer.startsWith('-');
  const next = editBody(negative ? buffer.slice(1) : buffer, key, minorDigits);
  // A sign with no digits behind it is not a number: deleting the last digit clears the field.
  if (next.length === 0) return '';
  return negative ? `-${next}` : next;
}

function editBody(
  body: string,
  key: Exclude<AmountKeypadKey, 'sign'>,
  minorDigits: MinorDigits,
): string {
  if (key === 'delete') return body.slice(0, -1);
  if (key === 'separator') {
    if (minorDigits === 0 || body.includes('.')) return body;
    return body.length === 0 ? '0.' : `${body}.`;
  }

  const [integer = '', fraction] = body.split('.');
  if (fraction === undefined) {
    // A lone zero is a placeholder, not a digit worth keeping in front of another.
    if (integer === '0') return key;
    return integer.length >= maxIntegerDigits(minorDigits) ? body : `${integer}${key}`;
  }
  return fraction.length >= minorDigits ? body : `${integer}.${fraction}${key}`;
}
