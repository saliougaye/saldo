import { describe, expect, it } from 'vitest';
import { detectPreset, mappingFor, SALDO_HEADERS, SPENDEE_HEADERS } from './importMapping';

const spendee = [
  'Date',
  'Wallet',
  'Type',
  'Category name',
  'Amount',
  'Currency',
  'Note',
  'Labels',
  'Author',
];

describe('detectPreset', () => {
  it('knows a Spendee export by its header', () => {
    expect(detectPreset(spendee)).toBe('spendee');
    expect(SPENDEE_HEADERS).toHaveLength(9);
  });

  it('knows our own export', () => {
    expect(detectPreset(SALDO_HEADERS)).toBe('saldo');
  });

  it('falls back to generic for anything else', () => {
    expect(detectPreset(['Data', 'Importo', 'Descrizione'])).toBe('generic');
    expect(detectPreset([])).toBe('generic');
  });
});

describe('mappingFor', () => {
  it('points the Spendee fields at the columns this file actually has', () => {
    const mapping = mappingFor(spendee, 'spendee');
    expect(mapping.columns.date).toBe(0);
    expect(mapping.columns.account).toBe(1); // Wallet, by default
    expect(mapping.columns.type).toBe(2);
    expect(mapping.columns.category).toBe(3);
    expect(mapping.columns.amount).toBe(4);
    expect(mapping.columns.currency).toBe(5);
    expect(mapping.columns.description).toBe(6); // Note
    expect(mapping.columns.tags).toBe(7); // Labels
    expect(mapping.tagSeparator).toBe(',');
  });

  it('survives reordered columns', () => {
    const reordered = [
      'Amount',
      'Date',
      'Wallet',
      'Type',
      'Category name',
      'Currency',
      'Note',
      'Labels',
      'Author',
    ];
    const mapping = mappingFor(reordered, 'spendee');
    expect(mapping.columns.amount).toBe(0);
    expect(mapping.columns.date).toBe(1);
  });

  it('maps our own export onto itself', () => {
    const mapping = mappingFor(SALDO_HEADERS, 'saldo');
    expect(mapping.columns.date).toBe(0);
    expect(mapping.columns.type).toBe(1);
    expect(mapping.columns.amount).toBe(2);
    expect(mapping.tagSeparator).toBe('|');
  });

  it('gives a generic file nothing but defaults to edit', () => {
    const mapping = mappingFor(['Data', 'Importo'], 'generic');
    expect(mapping.columns.date).toBeNull();
    expect(mapping.signConvention).toBe('negative-is-expense');
  });
});
