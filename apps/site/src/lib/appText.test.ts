import { catalogs } from '@saldo/i18n';
import { describe, expect, it } from 'vitest';
import { SITE_LOCALES } from '../content/index';
import { APP_COUNT_KEYS, APP_KEYS } from './appText';

function lookup(catalog: object, key: string): unknown {
  let node: unknown = catalog;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null || !(part in node)) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

/**
 * Spec 0.8a §12: the phone screens on the site read these keys. When one leaves a catalog, the
 * site would show the key itself; this test fails first.
 */
describe('app strings on the site', () => {
  it.each(SITE_LOCALES)('%s has every key the screens read', (locale) => {
    for (const key of APP_KEYS) {
      const value = lookup(catalogs[locale], key);
      expect(typeof value, key).toBe('string');
      expect(String(value).trim().length, key).toBeGreaterThan(0);
    }
  });

  it.each(SITE_LOCALES)('%s has both forms of every counted key', (locale) => {
    for (const key of APP_COUNT_KEYS) {
      for (const form of ['one', 'other']) {
        expect(typeof lookup(catalogs[locale], `${key}_${form}`), `${key}_${form}`).toBe('string');
      }
    }
  });
});
