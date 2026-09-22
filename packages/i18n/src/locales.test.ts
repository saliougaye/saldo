import { describe, expect, it as test } from 'vitest';
import { SUPPORTED_LOCALES } from './format';
import { catalogs, resources } from './index';
import { it } from './locales/it';

/** Every leaf of a catalog, keyed by its dotted path. */
function leaves(value: object, prefix = ''): Map<string, unknown> {
  const out = new Map<string, unknown>();
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === 'object' && child !== null) {
      for (const [path, leaf] of leaves(child, `${prefix}${key}.`)) out.set(path, leaf);
    } else {
      out.set(`${prefix}${key}`, child);
    }
  }
  return out;
}

const variables = (text: string) => [...text.matchAll(/{{(\w+)}}/g)].map((m) => m[1]).sort();

const source = leaves(it);
const translations = SUPPORTED_LOCALES.filter((locale) => locale !== 'it');

describe('message catalogs', () => {
  test('cover every supported locale', () => {
    expect(Object.keys(catalogs).sort()).toEqual([...SUPPORTED_LOCALES].sort());
    expect(translations.length).toBeGreaterThan(0);
  });

  test.each(translations)('%s has the key structure of it', (locale) => {
    expect([...leaves(catalogs[locale]).keys()].sort()).toEqual([...source.keys()].sort());
  });

  test.each(SUPPORTED_LOCALES)('%s contains only non-empty strings', (locale) => {
    for (const [path, value] of leaves(catalogs[locale])) {
      expect(typeof value, path).toBe('string');
      expect(String(value).trim().length, path).toBeGreaterThan(0);
    }
  });

  test.each(translations)('%s keeps the interpolation variables of it', (locale) => {
    const target = leaves(catalogs[locale]);
    for (const [path, text] of source) {
      expect(variables(String(target.get(path) ?? '')), `${locale} ${path}`).toEqual(
        variables(String(text)),
      );
    }
  });

  test('are exposed as i18next resources, with the _many plural filled in', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const translation: object = resources[locale].translation;
      const flat = leaves(translation);
      expect(flat.get('home.upcomingCount_many'), locale).toBe(
        flat.get('home.upcomingCount_other'),
      );
    }
  });
});
