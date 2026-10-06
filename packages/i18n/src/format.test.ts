import { describe, expect, it } from 'vitest';
import { formatMajor, formatMoney, formatMoneyParts } from './format';

describe('formatMoney', () => {
  it('formats Italian amounts with suffix symbol', () => {
    expect(formatMoney(184260, 'EUR', 'it')).toBe('1.842,60 €');
    expect(formatMoney(-41235, 'EUR', 'it')).toBe('−412,35 €');
    expect(formatMoney(231000, 'EUR', 'it', 'always')).toBe('+2.310,00 €');
    expect(formatMoney(-500, 'EUR', 'it', 'never')).toBe('5,00 €');
  });

  it('formats English amounts with prefix symbol', () => {
    expect(formatMoney(184260, 'EUR', 'en')).toBe('€1,842.60');
    expect(formatMoney(5, 'USD', 'en')).toBe('$0.05');
    expect(formatMoney(120000, 'CHF', 'en')).toBe('CHF 1,200.00');
  });

  it('omits the fraction for currencies without a minor unit', () => {
    expect(formatMoney(1200, 'JPY', 'it')).toBe('1.200 ¥');
    expect(formatMoney(1200, 'JPY', 'en')).toBe('¥1,200');
    expect(formatMoney(1200500, 'KWD', 'en')).toBe('KWD 1,200.500');
  });

  it('exposes parts for split rendering', () => {
    expect(formatMoneyParts(1234567890, 'GBP', 'it')).toEqual({
      sign: '',
      integer: '12.345.678',
      decimalSeparator: ',',
      fraction: '90',
      symbol: '£',
      symbolPosition: 'suffix',
    });
  });
});

describe('formatMajor', () => {
  it('drops the sign on request', () => {
    expect(formatMajor(-19_349, 'EUR', 'en', 'never')).toBe('193');
    expect(formatMajor(32_500, 'EUR', 'en', 'negative')).toBe('325');
    expect(formatMajor(-32_500, 'EUR', 'en', 'negative')).toBe('−325');
  });

  it('rounds to whole units and groups thousands', () => {
    expect(formatMajor(32_500, 'EUR', 'it')).toBe('+325');
    expect(formatMajor(-19_349, 'EUR', 'en')).toBe('−193');
    expect(formatMajor(123_456_78, 'EUR', 'it')).toBe('+123.457');
    expect(formatMajor(123_456_78, 'EUR', 'en')).toBe('+123,457');
  });

  it('respects the currency scale', () => {
    expect(formatMajor(325, 'JPY', 'en')).toBe('+325');
    expect(formatMajor(325_000, 'BHD', 'en')).toBe('+325');
  });

  it('has no sign at zero', () => {
    expect(formatMajor(0, 'EUR', 'it')).toBe('0');
    expect(formatMajor(-4, 'EUR', 'it')).toBe('0');
  });
});

describe('formatMoney in the new locales', () => {
  const NNBSP = ' ';
  const NBSP = ' ';

  it('separates thousands the way each locale does', () => {
    expect(formatMoney(184260, 'EUR', 'fr')).toBe(`1${NNBSP}842,60 €`);
    expect(formatMoney(184260, 'EUR', 'de')).toBe('1.842,60 €');
    expect(formatMoney(184260, 'EUR', 'sv')).toBe(`1${NBSP}842,60 €`);
    expect(formatMoney(-1234567, 'SEK', 'sv')).toBe(`−12${NBSP}345,67 kr`);
  });

  it('leaves four digits ungrouped in Spanish and Portuguese', () => {
    expect(formatMoney(184260, 'EUR', 'es')).toBe('1842,60 €');
    expect(formatMoney(1234560, 'EUR', 'es')).toBe('12.345,60 €');
    expect(formatMoney(184260, 'EUR', 'pt')).toBe('1842,60 €');
    expect(formatMoney(1234560, 'EUR', 'pt')).toBe(`12${NBSP}345,60 €`);
    expect(formatMajor(184260, 'EUR', 'es')).toBe('+1843');
    expect(formatMajor(1234560, 'EUR', 'es')).toBe('+12.346');
  });
});
