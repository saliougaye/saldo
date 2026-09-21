import { CURRENCY_CODES } from '@saldo/core';
import { describe, expect, it as test } from 'vitest';
import { currencyName } from './currencyNames';
import { CURRENCY_NAMES } from './currencyNames.generated';
import { SUPPORTED_LOCALES } from './format';

describe('currencyName', () => {
  test('names every currency the app accepts, in every locale, and nothing else', () => {
    expect(Object.keys(CURRENCY_NAMES).sort()).toEqual([...SUPPORTED_LOCALES].sort());
    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(CURRENCY_NAMES[locale])).toEqual([...CURRENCY_CODES]);
      for (const code of CURRENCY_CODES) expect(currencyName(code, locale).trim()).not.toBe('');
    }
  });

  test('uses the singular name, with only its first letter raised', () => {
    expect(currencyName('CHF', 'it')).toBe('Franco svizzero');
    expect(currencyName('CHF', 'en')).toBe('Swiss franc');
    expect(currencyName('EUR', 'it')).toBe('Euro');
    expect(currencyName('USD', 'en')).toBe('US dollar');
  });
});
