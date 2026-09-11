import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { it as italian } from '@saldo/i18n';

/**
 * Every `t('some.key')` in this app resolves to a string in the catalogue.
 *
 * The parity test in `@saldo/i18n` checks that the two locales hold the *same* keys, which says
 * nothing about whether the app asks for keys that exist: deleting one from both locales keeps
 * them in parity and breaks the screen. That is not hypothetical — it happened, and this is the
 * test that would have caught it.
 */
const ROOTS = [join(__dirname, '..'), join(__dirname, '..', '..', 'app')];
const CALL = /\bt\(\s*'([a-zA-Z0-9_.]+)'/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [path] : [];
  });
}

function lookup(key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        typeof node === 'object' && node !== null
          ? (node as Record<string, unknown>)[part]
          : undefined,
      italian,
    );
}

describe('translation keys', () => {
  const used = new Map<string, string>();
  for (const root of ROOTS) {
    for (const file of sourceFiles(root)) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(CALL)) {
        const key = match[1];
        if (key !== undefined && !used.has(key)) used.set(key, file);
      }
    }
  }

  it('finds the calls to look at', () => {
    // A regex that silently matched nothing would make every assertion below vacuous.
    expect(used.size).toBeGreaterThan(100);
  });

  /** A plural key is asked for as `count`, and i18next picks `count_one` / `count_other`. */
  const defined = (key: string): boolean =>
    typeof lookup(key) === 'string' ||
    (typeof lookup(`${key}_one`) === 'string' && typeof lookup(`${key}_other`) === 'string');

  it('resolves every key the app asks for', () => {
    const missing = [...used.entries()]
      .filter(([key]) => !defined(key))
      .map(([key, file]) => `${key} (${file.split('/apps/mobile/')[1] ?? file})`);
    expect(missing).toEqual([]);
  });

  it('gives every plural key both of its forms', () => {
    const halfPlural = [...used.keys()].filter(
      (key) =>
        typeof lookup(key) !== 'string' &&
        (typeof lookup(`${key}_one`) === 'string') !== (typeof lookup(`${key}_other`) === 'string'),
    );
    expect(halfPlural).toEqual([]);
  });
});
