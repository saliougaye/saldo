import { describe, expect, it } from 'vitest';
import { amountQuery, rankSearch, SEARCH_SCORE, textScore } from './search';

describe('textScore', () => {
  it('ranks the five text rules from the whole title down to scattered words', () => {
    expect(textScore('Grocery run', 'Grocery run')).toBe(SEARCH_SCORE.exact);
    expect(textScore('groc', 'Grocery run')).toBe(SEARCH_SCORE.prefix);
    expect(textScore('run gro', 'Grocery run')).toBe(SEARCH_SCORE.wordPrefix);
    expect(textScore('cery r', 'Grocery run')).toBe(SEARCH_SCORE.contains);
    expect(textScore('run ocer', 'Grocery run')).toBe(SEARCH_SCORE.allWords);
    expect(textScore('bakery', 'Grocery run')).toBeNull();
  });

  it('ignores case, accents and extra spaces', () => {
    expect(textScore('  CAFFE  ', 'Caffè')).toBe(SEARCH_SCORE.exact);
    expect(textScore('cafe', 'Café de Flore')).toBe(SEARCH_SCORE.prefix);
  });

  it('matches nothing with an empty query', () => {
    expect(textScore('   ', 'Anything')).toBeNull();
  });
});

describe('amountQuery', () => {
  it('reads a whole number as every amount with that whole part', () => {
    expect(amountQuery('12', 2)).toEqual({ min: 1200, max: 1299, exact: 1200 });
  });

  it('reads one or two digits after a separator as decimals, either separator', () => {
    expect(amountQuery('12,50', 2)).toEqual({ min: 1250, max: 1250, exact: 1250 });
    expect(amountQuery('12.5', 2)).toEqual({ min: 1250, max: 1250, exact: 1250 });
    expect(amountQuery('€ 12,50', 2)).toEqual({ min: 1250, max: 1250, exact: 1250 });
  });

  it('reads three digits after a separator as thousands in a two-decimal currency', () => {
    expect(amountQuery('1.234', 2)).toEqual({ min: 123400, max: 123499, exact: 123400 });
    expect(amountQuery('1.234,56', 2)).toEqual({ min: 123456, max: 123456, exact: 123456 });
  });

  it('follows the decimals of the currency', () => {
    expect(amountQuery('1.234', 3)).toEqual({ min: 1234, max: 1234, exact: 1234 });
    expect(amountQuery('1.5', 0)).toEqual({ min: 15, max: 15, exact: 15 });
  });

  it('is not an amount with letters, other symbols, or no digit', () => {
    expect(amountQuery('coop 12', 2)).toBeNull();
    expect(amountQuery('12/10', 2)).toBeNull();
    expect(amountQuery('€', 2)).toBeNull();
  });
});

describe('rankSearch', () => {
  const entries = [
    { value: 'a', text: 'Coop supermarket', amount: 4210, date: '2026-10-01' },
    { value: 'b', text: 'Coop', amount: 1200, date: '2026-09-01' },
    { value: 'c', text: 'Bakery', amount: 1250, date: '2026-10-20' },
    { value: 'd', text: 'Coop', amount: 900, date: '2026-10-15' },
  ];

  it('puts the higher score first, then the newer date', () => {
    expect(rankSearch('coop', entries)).toEqual(['d', 'b', 'a']);
  });

  it('matches an amount on transactions, the exact amount before the whole-number range', () => {
    expect(rankSearch('12', entries, { minorDigits: 2 })).toEqual(['b', 'c']);
    expect(rankSearch('12,5', entries, { minorDigits: 2 })).toEqual(['c']);
  });

  it('keeps the input order for entries with no date', () => {
    const named = [
      { value: 'x', text: 'Savings' },
      { value: 'y', text: 'Savings' },
    ];
    expect(rankSearch('sav', named)).toEqual(['x', 'y']);
  });

  it('stops at the limit and returns nothing for an empty query', () => {
    expect(rankSearch('coop', entries, { limit: 2 })).toEqual(['d', 'b']);
    expect(rankSearch('  ', entries)).toEqual([]);
  });
});
