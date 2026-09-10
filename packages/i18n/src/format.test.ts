import { describe, expect, it } from 'vitest';
import {
  formatCycleRange,
  formatDayMonth,
  formatLongDate,
  formatMoney,
  formatMoneyParts,
  formatSignedPercent,
  resolveLocale,
} from './format';

describe('resolveLocale', () => {
  it('uses the explicit preference or the first device language', () => {
    expect(resolveLocale('en', ['it-IT'])).toBe('en');
    expect(resolveLocale('system', ['it-IT', 'en-US'])).toBe('it');
    expect(resolveLocale('system', ['fr-FR'])).toBe('en');
    expect(resolveLocale('system', [])).toBe('en');
  });
});

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

describe('dates', () => {
  it('formats day and month', () => {
    expect(formatDayMonth('2026-04-18', 'it')).toBe('18 apr');
    expect(formatDayMonth('2026-04-18', 'en')).toBe('Apr 18');
  });

  it('formats long dates', () => {
    expect(formatLongDate('2026-04-18', 'it')).toBe('18 aprile 2026');
    expect(formatLongDate('2026-04-18', 'en')).toBe('April 18, 2026');
  });

  it('formats cycle ranges with an en dash', () => {
    const range = { start: '2026-03-27', end: '2026-04-26' };
    expect(formatCycleRange(range, 'it')).toBe('27 mar – 26 apr');
    expect(formatCycleRange(range, 'en')).toBe('Mar 27 – Apr 26');
  });
});

describe('formatSignedPercent', () => {
  it('adds sign and rounds', () => {
    expect(formatSignedPercent(12)).toBe('+12%');
    expect(formatSignedPercent(-7.4)).toBe('−7%');
    expect(formatSignedPercent(0.2)).toBe('0%');
  });
});
