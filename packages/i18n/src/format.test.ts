import { describe, expect, it } from 'vitest';
import {
  firstWeekdayFor,
  formatCycleRange,
  formatDayMonth,
  formatDayMonthLong,
  formatLongDate,
  formatMajor,
  formatMoney,
  formatMoneyParts,
  formatMonthYear,
  formatPeriodTick,
  formatSignedPercent,
  formatWeekday,
  i18nextLanguage,
  matchLocale,
  resolveLocale,
  weekdayLabels,
} from './format';

describe('resolveLocale', () => {
  it('uses the explicit preference or the first device language', () => {
    expect(resolveLocale('en', ['it-IT'])).toBe('en');
    expect(resolveLocale('system', ['it-IT', 'en-US'])).toBe('it');
    expect(resolveLocale('system', ['fr-FR'])).toBe('fr');
    expect(resolveLocale('system', ['nl-NL'])).toBe('en');
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

describe('formatWeekday / formatDayMonthLong', () => {
  it('names the weekday in full', () => {
    expect(formatWeekday('2026-09-18', 'it')).toBe('venerdì');
    expect(formatWeekday('2026-09-18', 'en')).toBe('Friday');
    expect(formatWeekday('2026-09-20', 'it')).toBe('domenica');
  });

  it('writes day and long month without the year', () => {
    expect(formatDayMonthLong('2026-09-18', 'it')).toBe('18 settembre');
    expect(formatDayMonthLong('2026-09-18', 'en')).toBe('September 18');
  });
});
describe('resolveLocale / matchLocale', () => {
  it('maps a regional tag to its base language', () => {
    expect(resolveLocale('system', ['pt-BR'])).toBe('pt');
    expect(resolveLocale('system', ['pt-PT'])).toBe('pt');
    expect(resolveLocale('system', ['es-MX'])).toBe('es');
    expect(resolveLocale('system', ['de-AT'])).toBe('de');
    expect(resolveLocale('system', ['fr-CA'])).toBe('fr');
    expect(resolveLocale('system', ['sv-FI'])).toBe('sv');
    expect(resolveLocale('system', ['zh-Hans-CN'])).toBe('en');
  });

  it('takes the first device language it supports', () => {
    expect(resolveLocale('system', ['nl-NL', 'de-DE'])).toBe('de');
    expect(resolveLocale('system', ['en-GB', 'it-IT'])).toBe('en');
    expect(resolveLocale('sv', ['de-DE'])).toBe('sv');
  });

  it('reads underscores and case as Android and iOS report them', () => {
    expect(matchLocale('pt_BR')).toBe('pt');
    expect(matchLocale('DE')).toBe('de');
    expect(matchLocale('nb-NO')).toBeUndefined();
  });

  it('hands i18next the Portuguese of Portugal, for its plural rules', () => {
    expect(i18nextLanguage('pt')).toBe('pt-PT');
    expect(i18nextLanguage('de')).toBe('de');
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

  it('puts the symbol after the amount', () => {
    expect(formatMoneyParts(500, 'USD', 'de').symbolPosition).toBe('suffix');
    expect(formatMoney(500, 'USD', 'fr', 'always')).toBe('+5,00 $');
  });
});

describe('dates in the new locales', () => {
  it('formats day and month', () => {
    expect(formatDayMonth('2026-04-18', 'fr')).toBe('18 avr.');
    expect(formatDayMonth('2026-04-18', 'de')).toBe('18. Apr.');
    expect(formatDayMonth('2026-04-18', 'sv')).toBe('18 apr.');
    expect(formatDayMonth('2026-04-18', 'es')).toBe('18 abr');
    expect(formatDayMonth('2026-04-18', 'pt')).toBe('18 abr.');
  });

  it('formats long dates', () => {
    expect(formatLongDate('2026-04-18', 'fr')).toBe('18 avril 2026');
    expect(formatLongDate('2026-04-18', 'de')).toBe('18. April 2026');
    expect(formatLongDate('2026-04-18', 'sv')).toBe('18 april 2026');
    expect(formatLongDate('2026-04-18', 'es')).toBe('18 de abril de 2026');
    expect(formatLongDate('2026-04-18', 'pt')).toBe('18 de abril de 2026');
  });

  it('writes day and long month, and the month over the grid', () => {
    expect(formatDayMonthLong('2026-09-18', 'de')).toBe('18. September');
    expect(formatDayMonthLong('2026-09-18', 'es')).toBe('18 de septiembre');
    expect(formatMonthYear({ year: 2026, month: 4 }, 'pt')).toBe('abril de 2026');
    expect(formatMonthYear({ year: 2026, month: 4 }, 'fr')).toBe('avril 2026');
  });

  it('names the year in a range the same way', () => {
    const range = { start: '2025-12-27', end: '2026-01-26' };
    expect(formatCycleRange(range, 'de', '2026-09-11')).toBe('27. Dez. 2025 – 26. Jan.');
    expect(formatCycleRange(range, 'fr', '2026-09-11')).toBe('27 déc. 2025 – 26 janv.');
  });

  it('ticks German months with the stand-alone forms', () => {
    expect(formatPeriodTick('2026-03-01', 'month', 'de')).toBe('Mär');
    expect(formatDayMonth('2026-03-18', 'de')).toBe('18. März');
    expect(formatPeriodTick('2026-09-01', 'month', 'fr')).toBe('sept.');
  });

  it('names weekdays', () => {
    expect(formatWeekday('2026-09-18', 'fr')).toBe('vendredi');
    expect(formatWeekday('2026-09-18', 'de')).toBe('Freitag');
    expect(formatWeekday('2026-09-18', 'sv')).toBe('fredag');
    expect(formatWeekday('2026-09-18', 'es')).toBe('viernes');
    expect(formatWeekday('2026-09-18', 'pt')).toBe('sexta-feira');
  });

  it('starts the grid where each locale does', () => {
    expect(firstWeekdayFor('fr')).toBe('monday');
    expect(firstWeekdayFor('de')).toBe('monday');
    expect(firstWeekdayFor('sv')).toBe('monday');
    expect(firstWeekdayFor('es')).toBe('monday');
    expect(firstWeekdayFor('pt')).toBe('sunday');
    expect(weekdayLabels('es', 'monday')).toEqual(['L', 'M', 'X', 'J', 'V', 'S', 'D']);
    expect(weekdayLabels('sv', 'monday')).toEqual(['M', 'T', 'O', 'T', 'F', 'L', 'S']);
    expect(weekdayLabels('pt', 'sunday')).toEqual(['D', 'S', 'T', 'Q', 'Q', 'S', 'S']);
  });
});
