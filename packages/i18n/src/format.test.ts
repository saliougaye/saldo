import { describe, expect, it } from 'vitest';
import {
  firstWeekdayFor,
  formatCycleRange,
  formatDayMonth,
  formatLongDate,
  formatMajor,
  formatMoney,
  formatMoneyParts,
  formatMonthYear,
  formatPeriodTick,
  formatSignedPercent,
  resolveLocale,
  weekdayLabels,
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

  it('leaves the year out of a range inside the reference year', () => {
    const range = { start: '2026-03-27', end: '2026-04-26' };
    expect(formatCycleRange(range, 'it', '2026-09-11')).toBe('27 mar – 26 apr');
  });

  it('names the year of the end when the range crosses into the next one', () => {
    const range = { start: '2026-12-27', end: '2027-01-26' };
    expect(formatCycleRange(range, 'it', '2026-09-11')).toBe('27 dic – 26 gen 2027');
    expect(formatCycleRange(range, 'en', '2026-09-11')).toBe('Dec 27 – Jan 26, 2027');
  });

  it('names the year of the start when the range began in the previous one', () => {
    const range = { start: '2025-12-27', end: '2026-01-26' };
    expect(formatCycleRange(range, 'it', '2026-09-11')).toBe('27 dic 2025 – 26 gen');
    expect(formatCycleRange(range, 'en', '2026-09-11')).toBe('Dec 27, 2025 – Jan 26');
  });

  it('names the year once for a whole range outside the reference year', () => {
    const range = { start: '2025-03-27', end: '2025-04-26' };
    expect(formatCycleRange(range, 'it', '2026-09-11')).toBe('27 mar – 26 apr 2025');
    expect(formatCycleRange(range, 'en', '2026-09-11')).toBe('Mar 27 – Apr 26, 2025');
  });

  it('names both years when neither is the reference year', () => {
    const range = { start: '2024-12-27', end: '2025-01-26' };
    expect(formatCycleRange(range, 'it', '2026-09-11')).toBe('27 dic 2024 – 26 gen 2025');
  });

  it('labels a chart column by what tells its period apart', () => {
    expect(formatPeriodTick('2025-01-01', 'year', 'it')).toBe('2025');
    expect(formatPeriodTick('2026-01-01', 'month', 'it')).toBe('gen');
    expect(formatPeriodTick('2026-01-01', 'month', 'en')).toBe('Jan');
    expect(formatPeriodTick('2026-12-27', 'cycle', 'it')).toBe('27 dic');
    expect(formatPeriodTick('2026-12-28', 'week', 'en')).toBe('Dec 28');
  });

  it('falls back to the start year when no reference date is given', () => {
    expect(formatCycleRange({ start: '2026-12-27', end: '2027-01-26' }, 'it')).toBe(
      '27 dic – 26 gen 2027',
    );
  });
});

describe('formatSignedPercent', () => {
  it('adds sign and rounds', () => {
    expect(formatSignedPercent(12)).toBe('+12%');
    expect(formatSignedPercent(-7.4)).toBe('−7%');
    expect(formatSignedPercent(0.2)).toBe('0%');
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

describe('calendar labels', () => {
  it('starts the week where the locale does', () => {
    expect(firstWeekdayFor('it')).toBe('monday');
    expect(firstWeekdayFor('en')).toBe('sunday');
  });

  it('rotates the column headings with it', () => {
    expect(weekdayLabels('it', 'monday')).toEqual(['L', 'M', 'M', 'G', 'V', 'S', 'D']);
    expect(weekdayLabels('en', 'sunday')).toEqual(['S', 'M', 'T', 'W', 'T', 'F', 'S']);
  });

  it('names the month over the grid', () => {
    expect(formatMonthYear({ year: 2026, month: 4 }, 'it')).toBe('aprile 2026');
    expect(formatMonthYear({ year: 2026, month: 4 }, 'en')).toBe('April 2026');
  });
});
