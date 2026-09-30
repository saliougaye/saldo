import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { catalogs } from '@saldo/i18n';
import { describe, expect, it } from 'vitest';

/**
 * The translator answers a missing key with the key itself, and the parity test only compares the
 * catalogs with each other, so a key that sits one level too high in every locale ships as raw text
 * (`web.auth.recoverTitle` on a page). This reads every literal key the web's code asks for and checks
 * it is a string in the Italian catalog. Keys built at run time (template literals, variables) are
 * not visible to it.
 */
const ROOT = resolve(import.meta.dirname, '../..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/** `t('a.b')`, `x.t("a.b")`, and `plural(t, locale, 'a.b', …)`, whose key gains `_one`/`_other`. */
const CALLS = [
  { pattern: /(?<![\w$])(?:[\w$]+\.)?t\(\s*(['"])([\w.]+)\1/g, suffixes: [''] },
  {
    pattern: /(?<![\w$])plural\(\s*[\w$.]+,\s*[\w$.]+,\s*(['"])([\w.]+)\1/g,
    suffixes: ['_one', '_other'],
  },
];

function resolves(key: string): boolean {
  let node: unknown = catalogs.it;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null || !(part in node)) return false;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string';
}

describe('literal translation keys in the web app', () => {
  const found: { file: string; key: string }[] = [];
  for (const file of [...sourceFiles(join(ROOT, 'app')), ...sourceFiles(join(ROOT, 'src'))]) {
    const text = readFileSync(file, 'utf8');
    for (const { pattern, suffixes } of CALLS) {
      for (const match of text.matchAll(pattern)) {
        const key = match[2];
        if (key === undefined || !key.includes('.')) continue;
        for (const suffix of suffixes)
          found.push({ file: file.slice(ROOT.length + 1), key: key + suffix });
      }
    }
  }

  it('finds the calls it is meant to check', () => {
    expect(found.length).toBeGreaterThan(300);
  });

  it('resolves every one of them to a string in the Italian catalog', () => {
    const missing = found
      .filter(({ key }) => !resolves(key))
      .map(({ file, key }) => `${file}: ${key}`);
    expect(missing).toEqual([]);
  });
});
