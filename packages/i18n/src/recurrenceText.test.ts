import { describe, expect, it } from 'vitest';
import { catalogs } from './index';
import { cadenceLabel, endLabel } from './recurrenceText';
import { makeTranslator } from './translate';

const itT = makeTranslator(catalogs.it);
const enT = makeTranslator(catalogs.en);

describe('cadenceLabel', () => {
  it('names the cadence and its anchor', () => {
    expect(cadenceLabel({ frequency: 'monthly', interval: 1 }, '2026-09-18', itT, 'it')).toBe(
      'Ogni mese, il 18',
    );
    expect(cadenceLabel({ frequency: 'monthly', interval: 3 }, '2026-09-18', enT, 'en')).toBe(
      'Every 3 months, on the 18',
    );
    expect(cadenceLabel({ frequency: 'weekly', interval: 2 }, '2026-09-18', itT, 'it')).toBe(
      'Ogni 2 settimane, il venerdì',
    );
    expect(cadenceLabel({ frequency: 'yearly', interval: 1 }, '2026-09-18', itT, 'it')).toBe(
      'Ogni anno, il 18 settembre',
    );
    expect(cadenceLabel({ frequency: 'daily', interval: 1 }, '2026-09-18', itT, 'it')).toBe(
      'Ogni giorno',
    );
  });
});

describe('endLabel', () => {
  it('says how the series ends', () => {
    expect(endLabel(null, itT, 'it')).toBe('senza fine');
    expect(endLabel('2026-12-18', itT, 'it')).toBe('fino al 18 dic');
  });
});
