import { describe, expect, it } from 'vitest';
import { normalizeText } from '../filters';
import { transactionFingerprint } from './fingerprint';

describe('normalizeText', () => {
  it('lowercases, strips accents and collapses whitespace', () => {
    expect(normalizeText('  Caffè   Corretto ')).toBe('caffe corretto');
    expect(normalizeText('PERÒ\tcosì\nfan tutte')).toBe('pero cosi fan tutte');
  });
});

describe('transactionFingerprint', () => {
  const base: Parameters<typeof transactionFingerprint>[0] = {
    date: '2026-08-12',
    amount: 500,
    kind: 'expense',
    description: 'Aperitivo',
    accountName: 'Banca',
  };

  it('ignores casing and spacing in the text it joins', () => {
    expect(transactionFingerprint(base)).toBe(
      transactionFingerprint({ ...base, description: '  aperitivo ', accountName: 'BANCA' }),
    );
  });

  it('separates rows that differ in date, amount, kind or account', () => {
    const of = (patch: Partial<typeof base>) => transactionFingerprint({ ...base, ...patch });
    const all = new Set([
      of({}),
      of({ date: '2026-08-13' }),
      of({ amount: 501 }),
      of({ kind: 'income' }),
      of({ accountName: 'Contanti' }),
      of({ description: 'Altro' }),
    ]);
    expect(all.size).toBe(6);
  });
});
