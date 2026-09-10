import { describe, expect, it } from 'vitest';
import {
  type AmountKey,
  amountBufferToMinor,
  COMMON_CURRENCY_CODES,
  CURRENCY_CODES,
  CURRENCY_TABLE,
  getCurrency,
  type MinorDigits,
  maxIntegerDigits,
  minorToAmountBuffer,
  parseDecimalAmount,
  pressAmountKey,
} from './money';

function typeKeys(keys: AmountKey[], minorDigits: MinorDigits = 2): string {
  return keys.reduce((buffer, key) => pressAmountKey(buffer, key, minorDigits), '');
}

describe('currencies', () => {
  it('covers every currency CLDR can format', () => {
    expect(CURRENCY_CODES.length).toBeGreaterThan(150);
    expect(new Set(CURRENCY_CODES).size).toBe(CURRENCY_CODES.length);
    expect([...CURRENCY_CODES]).toEqual([...CURRENCY_CODES].sort());
    expect(Object.keys(CURRENCY_TABLE)).toEqual([...CURRENCY_CODES]);
  });

  it('exposes symbol and minor digits per currency', () => {
    expect(getCurrency('EUR')).toEqual({ code: 'EUR', symbol: '€', minorDigits: 2 });
    expect(getCurrency('CHF').symbol).toBe('CHF');
    expect(getCurrency('JPY')).toEqual({ code: 'JPY', symbol: '¥', minorDigits: 0 });
    expect(getCurrency('KWD').minorDigits).toBe(3);
  });

  it('only uses minor digits the money maths supports', () => {
    for (const code of CURRENCY_CODES) {
      expect([0, 2, 3]).toContain(getCurrency(code).minorDigits);
      expect(getCurrency(code).symbol.length).toBeGreaterThan(0);
    }
  });

  it('lists the currencies shown first in the picker', () => {
    expect(COMMON_CURRENCY_CODES).toEqual(['EUR', 'USD', 'GBP', 'CHF']);
    for (const code of COMMON_CURRENCY_CODES) expect(CURRENCY_CODES).toContain(code);
  });
});

describe('maxIntegerDigits', () => {
  it('keeps eight significant digits whatever the minor unit', () => {
    expect(maxIntegerDigits(2)).toBe(6);
    expect(maxIntegerDigits(0)).toBe(8);
    expect(maxIntegerDigits(3)).toBe(5);
  });
});

describe('pressAmountKey', () => {
  it('types integers and decimals', () => {
    expect(typeKeys(['1', '2', 'decimal', '5'])).toBe('12.5');
  });

  it('ignores a decimal separator on an empty buffer or a second one', () => {
    expect(typeKeys(['decimal'])).toBe('');
    expect(typeKeys(['1', 'decimal', 'decimal', '2'])).toBe('1.2');
  });

  it('limits decimals to the currency minor digits', () => {
    expect(typeKeys(['1', 'decimal', '2', '3', '4'])).toBe('1.23');
    expect(typeKeys(['1', 'decimal', '2', '3', '4'], 3)).toBe('1.234');
  });

  it('has no fractional part for zero decimal currencies', () => {
    expect(typeKeys(['1', '2', 'decimal', '5'], 0)).toBe('125');
    expect(typeKeys(['1', 'decimal'], 0)).toBe('1');
  });

  it('limits the integer part to six digits', () => {
    expect(typeKeys(['1', '2', '3', '4', '5', '6', '7'])).toBe('123456');
    expect(typeKeys(['1', '2', '3', '4', '5', '6', '7', '8', '9'], 0)).toBe('12345678');
    expect(typeKeys(['1', '2', '3', '4', '5', '6'], 3)).toBe('12345');
  });

  it('replaces a single leading zero', () => {
    expect(typeKeys(['0', '5'])).toBe('5');
    expect(typeKeys(['0', 'decimal', '5'])).toBe('0.5');
  });

  it('deletes the last character', () => {
    expect(typeKeys(['1', '2', 'del'])).toBe('1');
    expect(typeKeys(['del'])).toBe('');
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

  it('converts minor units back to the shortest buffer', () => {
    expect(minorToAmountBuffer(1200, 2)).toBe('12');
    expect(minorToAmountBuffer(1250, 2)).toBe('12.5');
    expect(minorToAmountBuffer(1205, 2)).toBe('12.05');
    expect(minorToAmountBuffer(-41235, 2)).toBe('412.35');
    expect(minorToAmountBuffer(1200, 0)).toBe('1200');
    expect(minorToAmountBuffer(1500, 3)).toBe('1.5');
    expect(minorToAmountBuffer(1050, 3)).toBe('1.05');
    expect(minorToAmountBuffer(1005, 3)).toBe('1.005');
  });

  it('round-trips every supported scale', () => {
    for (const minorDigits of [0, 2, 3] as const) {
      for (const minor of [0, 1, 5, 99, 100, 1005, 123456]) {
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
