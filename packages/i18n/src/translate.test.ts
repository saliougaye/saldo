import { describe, expect, it } from 'vitest';
import { it as italian } from './locales/it';
import { interpolate, makeTranslator } from './translate';

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
