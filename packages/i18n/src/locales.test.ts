import { describe, expect, it as test } from 'vitest';
import { resources } from './index';
import { en } from './locales/en';
import { it } from './locales/it';

function keyPaths(value: object, prefix = ''): string[] {
  return Object.entries(value)
    .flatMap(([key, child]) =>
      typeof child === 'object' && child !== null
        ? keyPaths(child, `${prefix}${key}.`)
        : [`${prefix}${key}`],
    )
    .sort();
}

function leaves(value: object): unknown[] {
  return Object.values(value).flatMap((child) =>
    typeof child === 'object' && child !== null ? leaves(child) : [child],
  );
}

describe('message catalogs', () => {
  test('have identical key structure in it and en', () => {
    expect(keyPaths(en)).toEqual(keyPaths(it));
  });

  test('contain only non-empty strings', () => {
    for (const value of [...leaves(it), ...leaves(en)]) {
      expect(typeof value).toBe('string');
      expect((value as string).length).toBeGreaterThan(0);
    }
  });

  test('keep interpolation variables consistent between languages', () => {
    const variables = (text: string) => [...text.matchAll(/{{(\w+)}}/g)].map((m) => m[1]).sort();
    const itLeaves = leaves(it) as string[];
    const enLeaves = leaves(en) as string[];
    itLeaves.forEach((text, index) => {
      expect(variables(enLeaves[index] ?? ''), text).toEqual(variables(text));
    });
  });

  test('are exposed as i18next resources', () => {
    expect(resources.it.translation).toBe(it);
    expect(resources.en.translation).toBe(en);
  });
});
