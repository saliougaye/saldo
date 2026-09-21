import { describe, expect, it } from 'vitest';
import { groupCurrencies } from './currencyPicker';
import { COMMON_CURRENCY_CODES, CURRENCY_CODES, type CurrencyCode } from './money';

const NAMES: Partial<Record<CurrencyCode, string>> = {
  CHF: 'Franco svizzero',
  EUR: 'Euro',
  JPY: 'Yen giapponese',
  XAF: 'Franco CFA BEAC',
  BAM: 'Marco convertibile della Bosnia-Herzegovina',
};
const nameOf = (code: CurrencyCode) => NAMES[code] ?? code;

describe('groupCurrencies', () => {
  it('lists the common four first, then every other currency alphabetically', () => {
    const { common, others } = groupCurrencies('', nameOf);
    expect(common).toEqual([...COMMON_CURRENCY_CODES]);
    expect(others).toEqual(
      CURRENCY_CODES.filter((code) => !(COMMON_CURRENCY_CODES as readonly string[]).includes(code)),
    );
    expect(common.length + others.length).toBe(CURRENCY_CODES.length);
  });

  it('treats a blank search as no search', () => {
    expect(groupCurrencies('   ', nameOf)).toEqual(groupCurrencies('', nameOf));
  });

  it('matches the code, ignoring case', () => {
    expect(groupCurrencies('jpy', nameOf)).toEqual({ common: [], others: ['JPY'] });
  });

  it('matches the name, ignoring case and accents', () => {
    expect(groupCurrencies('FRANCO', nameOf)).toEqual({ common: ['CHF'], others: ['XAF'] });
    expect(groupCurrencies('bosnià', nameOf)).toEqual({ common: [], others: ['BAM'] });
  });

  it('matches the symbol', () => {
    expect(groupCurrencies('€', nameOf).common).toEqual(['EUR']);
  });

  it('returns two empty groups when nothing matches', () => {
    expect(groupCurrencies('zzzz', nameOf)).toEqual({ common: [], others: [] });
  });
});
