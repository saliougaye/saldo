import { describe, expect, it } from 'vitest';
import {
  amountBufferToMinor,
  formatMinorUnits,
  minorToAmountBuffer,
  parseDecimalAmount,
  sanitizeAmountInput,
} from './money';

describe('sanitizeAmountInput', () => {
  it('accepts the comma the system keypad emits in a comma locale', () => {
    expect(sanitizeAmountInput('12,5', 2)).toBe('12.5');
    expect(sanitizeAmountInput('1.842,60', 2)).toBe('1.84');
  });

  it('drops anything the keyboard should not have produced', () => {
    expect(sanitizeAmountInput('-12', 2)).toBe('12');
    expect(sanitizeAmountInput('1a2', 2)).toBe('12');
    expect(sanitizeAmountInput('  ', 2)).toBe('');
  });

  it('treats only the first separator as the decimal point', () => {
    expect(sanitizeAmountInput('1.2.3', 2)).toBe('1.23');
  });

  it('limits the decimals to the currency scale', () => {
    expect(sanitizeAmountInput('1.234', 2)).toBe('1.23');
    expect(sanitizeAmountInput('1.234', 3)).toBe('1.234');
    expect(sanitizeAmountInput('1.2345', 3)).toBe('1.234');
  });

  it('has no fractional part for a currency without a minor unit', () => {
    expect(sanitizeAmountInput('12.5', 0)).toBe('12');
    expect(sanitizeAmountInput('12,', 0)).toBe('12');
  });

  it('limits the integer digits to the currency scale', () => {
    expect(sanitizeAmountInput('1234567', 2)).toBe('123456');
    expect(sanitizeAmountInput('123456789', 0)).toBe('12345678');
    expect(sanitizeAmountInput('123456', 3)).toBe('12345');
  });

  it('strips leading zeros but keeps a lone one', () => {
    expect(sanitizeAmountInput('05', 2)).toBe('5');
    expect(sanitizeAmountInput('0', 2)).toBe('0');
    expect(sanitizeAmountInput('0.5', 2)).toBe('0.5');
    expect(sanitizeAmountInput('.5', 2)).toBe('0.5');
  });
});

describe('sanitizeAmountInput with allowNegative', () => {
  it('keeps a minus, typed as a hyphen or as U+2212, wherever the caret put it', () => {
    expect(sanitizeAmountInput('-12', 2, { allowNegative: true })).toBe('-12');
    expect(sanitizeAmountInput('−12,5', 2, { allowNegative: true })).toBe('-12.5');
    expect(sanitizeAmountInput('1−2', 2, { allowNegative: true })).toBe('-12');
  });

  it('keeps a lone minus so the sign can come before the digits', () => {
    expect(sanitizeAmountInput('-', 2, { allowNegative: true })).toBe('-');
    expect(sanitizeAmountInput('-05', 2, { allowNegative: true })).toBe('-5');
    expect(sanitizeAmountInput('-.5', 2, { allowNegative: true })).toBe('-0.5');
  });

  it('still drops the minus by default', () => {
    expect(sanitizeAmountInput('−12', 2)).toBe('12');
  });
});

describe('amountBufferToMinor / minorToAmountBuffer', () => {
  it('converts buffers to minor units', () => {
    expect(amountBufferToMinor('', 2)).toBe(0);
    expect(amountBufferToMinor('12', 2)).toBe(1200);
    expect(amountBufferToMinor('12.', 2)).toBe(1200);
    expect(amountBufferToMinor('12.5', 2)).toBe(1250);
    expect(amountBufferToMinor('0.05', 2)).toBe(5);
    expect(amountBufferToMinor('1200', 0)).toBe(1200);
    expect(amountBufferToMinor('12.5', 3)).toBe(12500);
  });

  it('reads a leading minus, and never produces -0', () => {
    expect(amountBufferToMinor('-12.5', 2)).toBe(-1250);
    expect(Object.is(amountBufferToMinor('-', 2), 0)).toBe(true);
    expect(Object.is(amountBufferToMinor('-0', 2), 0)).toBe(true);
  });

  it('converts minor units back to the shortest buffer', () => {
    expect(minorToAmountBuffer(1200, 2)).toBe('12');
    expect(minorToAmountBuffer(1250, 2)).toBe('12.5');
    expect(minorToAmountBuffer(1205, 2)).toBe('12.05');
    expect(minorToAmountBuffer(-41235, 2)).toBe('-412.35');
    expect(minorToAmountBuffer(1200, 0)).toBe('1200');
    expect(minorToAmountBuffer(1500, 3)).toBe('1.5');
    expect(minorToAmountBuffer(1050, 3)).toBe('1.05');
    expect(minorToAmountBuffer(1005, 3)).toBe('1.005');
  });

  it('round-trips every supported scale', () => {
    for (const minorDigits of [0, 2, 3] as const) {
      for (const minor of [0, 1, 5, 99, 100, 1005, 123456, -1, -1005, -123456]) {
        expect(amountBufferToMinor(minorToAmountBuffer(minor, minorDigits), minorDigits)).toBe(
          minor,
        );
      }
    }
  });
});

describe('parseDecimalAmount', () => {
  it('parses Italian formatted amounts', () => {
    expect(parseDecimalAmount('1.842,60', ',', 2)).toBe(184260);
    expect(parseDecimalAmount('-12,5 €', ',', 2)).toBe(-1250);
    expect(parseDecimalAmount('−412,35 €', ',', 2)).toBe(-41235);
    expect(parseDecimalAmount('2310', ',', 2)).toBe(231000);
  });

  it('parses English formatted amounts', () => {
    expect(parseDecimalAmount('1,234.56', '.', 2)).toBe(123456);
    expect(parseDecimalAmount('CHF 1,200.00', '.', 2)).toBe(120000);
    expect(parseDecimalAmount('+7.5', '.', 2)).toBe(750);
  });

  it('strips any currency symbol or code, not just the common four', () => {
    expect(parseDecimalAmount('¥1,200', '.', 0)).toBe(1200);
    expect(parseDecimalAmount('1 200,50 zł', ',', 2)).toBe(120050);
    expect(parseDecimalAmount("CHF 1'200.00", '.', 2)).toBe(120000);
    expect(parseDecimalAmount('KWD 1,200.500', '.', 3)).toBe(1200500);
  });

  it('rounds half up at the currency scale', () => {
    expect(parseDecimalAmount('10.005', '.', 2)).toBe(1001);
    expect(parseDecimalAmount('10.004', '.', 2)).toBe(1000);
    expect(parseDecimalAmount('10.5', '.', 0)).toBe(11);
    expect(parseDecimalAmount('10.4', '.', 0)).toBe(10);
    expect(parseDecimalAmount('1.2345', '.', 3)).toBe(1235);
  });

  it('returns null for non numbers and 0 for negative zero', () => {
    expect(parseDecimalAmount('abc', '.', 2)).toBeNull();
    expect(parseDecimalAmount('', '.', 2)).toBeNull();
    expect(parseDecimalAmount('1-2', '.', 2)).toBeNull();
    expect(parseDecimalAmount('-0,00', ',', 2)).toBe(0);
  });
});

describe('formatMinorUnits', () => {
  it('keeps every decimal place, with no grouping and no symbol', () => {
    expect(formatMinorUnits(4500, 2)).toBe('45.00');
    expect(formatMinorUnits(123_456_789, 2)).toBe('1234567.89');
    expect(formatMinorUnits(-99, 2)).toBe('-0.99');
    expect(formatMinorUnits(0, 2)).toBe('0.00');
    expect(formatMinorUnits(1200, 0)).toBe('1200');
    expect(formatMinorUnits(1234, 3)).toBe('1.234');
  });
});
