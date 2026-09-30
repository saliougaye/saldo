import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = new URL('../..', import.meta.url).pathname;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === 'node_modules' || name.startsWith('.')) return [];
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !name.includes('.test.') ? [path] : [];
  });
}

/**
 * §17.1.7, decision 6 of 0.3e-1: the root of `@saldo/i18n` imports all seven catalogs. A client
 * component that needs a formatter or a translator imports the subpath that carries no catalog.
 */
describe('client components', () => {
  it('never import the root of @saldo/i18n', () => {
    const offenders = [...sources(join(ROOT, 'app')), ...sources(join(ROOT, 'src'))].filter(
      (path) => {
        const text = readFileSync(path, 'utf8');
        return /^['"]use client['"]/m.test(text) && /from '@saldo\/i18n'/.test(text);
      },
    );
    expect(offenders).toEqual([]);
  });

  it('can reach the formatter and the translator without the catalogs', async () => {
    const format = await import('@saldo/i18n/format');
    const translate = await import('@saldo/i18n/translate');
    expect(typeof format.formatMoney).toBe('function');
    expect(typeof translate.makeTranslator).toBe('function');
  });
});
