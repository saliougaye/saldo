import { makeTranslator } from '@saldo/i18n/translate';
import { describe, expect, it } from 'vitest';
import { instantFormatter, resolveMessage } from './resolveMessage';

const t = makeTranslator({
  a: {
    plain: 'Ciao {{name}}',
    on: 'il {{date}}',
    n_one: '{{count}} riga',
    n_other: '{{count}} righe',
  },
});

describe('instantFormatter', () => {
  const now = new Date('2026-09-30T12:00:00.000Z');

  it('writes the day the instant falls on in the given zone, not in UTC', () => {
    // 23:30 UTC on the 14th is already the 15th in Rome.
    const long = instantFormatter({ timeZone: 'Europe/Rome', locale: 'it', now, style: 'long' });
    expect(long('2026-01-14T23:30:00.000Z')).toBe('15 gennaio 2026');
    const utc = instantFormatter({ timeZone: 'UTC', locale: 'it', now, style: 'long' });
    expect(utc('2026-01-14T23:30:00.000Z')).toBe('14 gennaio 2026');
  });

  it('drops the year in the short style when it is this year', () => {
    const short = instantFormatter({ timeZone: 'Europe/Rome', locale: 'it', now, style: 'short' });
    expect(short('2026-09-25T09:00:00.000Z')).toBe('25 set');
    expect(short('2025-09-25T09:00:00.000Z')).toBe('25 settembre 2025');
  });

  it('falls back to UTC for a zone Intl does not know, and hands back what it cannot read', () => {
    const odd = instantFormatter({ timeZone: 'Nowhere/Land', locale: 'en', now, style: 'long' });
    expect(odd('2026-09-25T09:00:00.000Z')).toBe('September 25, 2026');
    expect(odd('not a date')).toBe('not a date');
  });
});

describe('resolveMessage', () => {
  const deps = { t, locale: 'it' as const, formatDate: (iso: string) => `<${iso}>` };

  it('returns a literal untouched', () => {
    expect(resolveMessage({ text: 'a@b.c' }, deps)).toBe('a@b.c');
  });

  it('interpolates a key with its variables', () => {
    expect(resolveMessage({ key: 'a.plain', vars: { name: 'Awa' } }, deps)).toBe('Ciao Awa');
  });

  it('formats the variables named in dateVars and only those', () => {
    expect(
      resolveMessage({ key: 'a.on', vars: { date: '2026-09-01' }, dateVars: ['date'] }, deps),
    ).toBe('il <2026-09-01>');
  });

  it('picks the plural form from count', () => {
    expect(resolveMessage({ key: 'a.n', count: 1 }, deps)).toBe('1 riga');
    expect(resolveMessage({ key: 'a.n', count: 1204 }, deps)).toBe('1204 righe');
  });
});
