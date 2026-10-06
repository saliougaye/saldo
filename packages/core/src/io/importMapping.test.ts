import { describe, expect, it } from 'vitest';
import { mappingFor } from './importMapping';

describe('mappingFor', () => {
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
});
