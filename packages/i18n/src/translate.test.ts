import { describe, expect, it } from 'vitest';
import type { AppLocale } from './format';
import { catalogs } from './index';
import { it as italian } from './locales/it';
import { interpolate, makeTranslator, plural, type Translate } from './translate';

describe('interpolate', () => {
  it('fills every {{name}} it is given', () => {
    expect(interpolate('Passo {{step}} di {{total}}', { step: 2, total: 3 })).toBe('Passo 2 di 3');
  });

  it('leaves a variable it was not given as it stands', () => {
    expect(interpolate('Saldo {{version}}')).toBe('Saldo {{version}}');
  });
});

describe('makeTranslator', () => {
  const t = makeTranslator(italian);

  it('reads a dotted path out of the catalog', () => {
    expect(t('common.continue')).toBe('Continua');
  });

  it('interpolates the variables of the string it found', () => {
    expect(t('common.stepOf', { step: 1, total: 3 })).toBe('Passo 1 di 3');
  });

  it('answers with the key when there is no such string', () => {
    expect(t('common.thereIsNoSuchKey')).toBe('common.thereIsNoSuchKey');
    expect(t('nowhere.near.anything')).toBe('nowhere.near.anything');
  });

  it('answers with the key when the path stops on a section', () => {
    expect(t('common')).toBe('common');
  });
});

describe('plural', () => {
  /** Answers with the key it was asked for, so the test reads which form was chosen. */
  const echo: Translate = (key, vars) => `${key}:${vars?.count ?? ''}`;

  // [locale, count, form]: CLDR's cardinal rules, read through the two forms the catalogs write.
  const cases: [AppLocale, number, 'one' | 'other'][] = [
    ['it', 0, 'other'],
    ['it', 1, 'one'],
    ['it', 2, 'other'],
    ['en', 0, 'other'],
    ['en', 1, 'one'],
    ['en', 2, 'other'],
    ['de', 0, 'other'],
    ['de', 1, 'one'],
    ['de', 2, 'other'],
    ['sv', 0, 'other'],
    ['sv', 1, 'one'],
    ['sv', 2, 'other'],
    ['es', 0, 'other'],
    ['es', 1, 'one'],
    ['es', 2, 'other'],
    // The two a `count === 1` test gets wrong: zero is singular here.
    ['fr', 0, 'one'],
    ['fr', 1, 'one'],
    ['fr', 2, 'other'],
    ['pt', 0, 'one'],
    ['pt', 1, 'one'],
    ['pt', 2, 'other'],
    // `many` (round millions in the Romance languages) has no key of its own: it reads as `_other`.
    ['fr', 1_000_000, 'other'],
    ['it', 1_000_000, 'other'],
    ['es', 1_000_000, 'other'],
    ['pt', 1_000_000, 'other'],
  ];

  it.each(cases)('%s at %i takes _%s', (locale, count, form) => {
    expect(plural(echo, locale, 'home.upcomingCount', count)).toBe(
      `home.upcomingCount_${form}:${count}`,
    );
  });

  it('passes the count and the other variables to the string it chose', () => {
    const t = makeTranslator(catalogs.fr);
    expect(plural(t, 'fr', 'home.upcomingCount', 0)).toBe('0 opération');
    expect(plural(t, 'fr', 'home.upcomingCount', 3)).toBe('3 opérations');
    expect(
      plural(makeTranslator(catalogs.en), 'en', 'goals.lastPeriod', 1, { amount: '€5.00' }),
    ).toBe('<b>€5.00 to go in 1 day</b>.');
  });
});
