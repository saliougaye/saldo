import { describe, expect, it } from 'vitest';
import { pressAmountKey } from './amountKeypad';

describe('pressAmountKey', () => {
  it('appends digits', () => {
    expect(pressAmountKey('', '1', 2)).toBe('1');
    expect(pressAmountKey('1', '2', 2)).toBe('12');
  });

  it('replaces a lone zero rather than growing it', () => {
    expect(pressAmountKey('0', '5', 2)).toBe('5');
    expect(pressAmountKey('0.', '5', 2)).toBe('0.5');
  });

  it('stops at the currency scale: 6 + 2 for EUR, 8 + 0 for JPY', () => {
    expect(pressAmountKey('123456', '7', 2)).toBe('123456');
    expect(pressAmountKey('12345678', '9', 0)).toBe('12345678');
    expect(pressAmountKey('1.23', '4', 2)).toBe('1.23');
    expect(pressAmountKey('1.2', '3', 2)).toBe('1.23');
  });

  it('adds one separator only, and none at all for a 0-decimal currency', () => {
    expect(pressAmountKey('12', 'separator', 2)).toBe('12.');
    expect(pressAmountKey('12.3', 'separator', 2)).toBe('12.3');
    expect(pressAmountKey('', 'separator', 2)).toBe('0.');
    expect(pressAmountKey('12', 'separator', 0)).toBe('12');
  });

  it('deletes the last character, separator included', () => {
    expect(pressAmountKey('12.5', 'delete', 2)).toBe('12.');
    expect(pressAmountKey('12.', 'delete', 2)).toBe('12');
    expect(pressAmountKey('1', 'delete', 2)).toBe('');
    expect(pressAmountKey('', 'delete', 2)).toBe('');
  });

  it('keeps the sign while digits change, and drops it with the last digit', () => {
    expect(pressAmountKey('-1', '2', 2, { allowNegative: true })).toBe('-12');
    expect(pressAmountKey('-1', 'delete', 2, { allowNegative: true })).toBe('');
    expect(pressAmountKey('-', 'delete', 2, { allowNegative: true })).toBe('');
  });

  it('toggles the sign only where a balance may be negative', () => {
    expect(pressAmountKey('12', 'sign', 2, { allowNegative: true })).toBe('-12');
    expect(pressAmountKey('-12', 'sign', 2, { allowNegative: true })).toBe('12');
    expect(pressAmountKey('', 'sign', 2, { allowNegative: true })).toBe('-');
    expect(pressAmountKey('12', 'sign', 2)).toBe('12');
  });

  it('types a sign-first balance: −, then the digits', () => {
    const minus = pressAmountKey('', 'sign', 2, { allowNegative: true });
    expect(pressAmountKey(minus, '4', 2, { allowNegative: true })).toBe('-4');
  });
});
