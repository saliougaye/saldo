import { describe, expect, it } from 'vitest';
import { moneySchema, toMoney } from './money';

describe('toMoney', () => {
  it('renders the integer as a plain decimal with the currency’s digits', () => {
    expect(toMoney(12345, 'EUR')).toEqual({ minor: 12345, currency: 'EUR', amount: '123.45' });
    expect(toMoney(0, 'EUR').amount).toBe('0.00');
    expect(toMoney(-500, 'EUR').amount).toBe('-5.00');
  });

  it('follows the currency’s minor unit: none for yen, three for dinar', () => {
    expect(toMoney(1200, 'JPY').amount).toBe('1200');
    expect(toMoney(1234, 'KWD').amount).toBe('1.234');
  });

  it('never groups digits nor adds a symbol', () => {
    expect(toMoney(123456789, 'EUR').amount).toBe('1234567.89');
  });

  it('falls back to two decimals for a code this build does not know', () => {
    expect(toMoney(5, 'XYZ')).toEqual({ minor: 5, currency: 'XYZ', amount: '0.05' });
  });

  it('produces what its schema accepts', () => {
    expect(moneySchema.safeParse(toMoney(12345, 'EUR')).success).toBe(true);
  });
});
