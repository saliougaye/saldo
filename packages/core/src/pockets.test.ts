import { describe, expect, it } from 'vitest';
import {
  accountChoices,
  bankBalance,
  canArchiveAccount,
  isPocket,
  pocketParentCandidates,
  pocketsOf,
} from './pockets';

type Row = {
  id: string;
  type: 'cash' | 'checking' | 'credit_card' | 'savings' | 'investment' | 'pocket';
  archivedAt: string | null;
  parentAccountId?: string | null;
};

const ROWS: Row[] = [
  { id: 'checking', type: 'checking', archivedAt: null },
  { id: 'car', type: 'pocket', archivedAt: null, parentAccountId: 'checking' },
  { id: 'card', type: 'credit_card', archivedAt: null },
  { id: 'deposit', type: 'savings', archivedAt: null },
  { id: 'trip', type: 'pocket', archivedAt: null, parentAccountId: 'deposit' },
  { id: 'sofa', type: 'pocket', archivedAt: '2026-09-01T10:00:00.000Z', parentAccountId: 'deposit' },
  { id: 'degiro', type: 'investment', archivedAt: null },
];

describe('pockets', () => {
  it('knows a pocket by its type', () => {
    expect(isPocket({ type: 'pocket' })).toBe(true);
    expect(isPocket({ type: 'savings' })).toBe(false);
  });

  it('lists the live pockets of a parent', () => {
    expect(pocketsOf(ROWS, 'deposit').map((row) => row.id)).toEqual(['trip']);
  });

  it('reads a parent like the bank: its own balance plus its live pockets', () => {
    const balances = new Map([
      ['checking', 207_989],
      ['car', 500_000],
      ['deposit', 0],
      ['trip', 298_000],
      ['sofa', 0],
    ]);
    expect(bankBalance(ROWS, balances, 'checking')).toBe(707_989);
    expect(bankBalance(ROWS, balances, 'deposit')).toBe(298_000);
    expect(bankBalance(ROWS, balances, 'card')).toBe(0);
  });

  it('offers cash, current, debit and savings accounts as parents, never cards, investments or pockets', () => {
    expect(pocketParentCandidates(ROWS).map((row) => row.id)).toEqual(['checking', 'deposit']);
  });

  it('refuses to archive an account that still holds open goals', () => {
    expect(canArchiveAccount(ROWS, 'checking')).toBe(false);
    expect(canArchiveAccount(ROWS, 'card')).toBe(true);
  });
});

describe('accountChoices', () => {
  it('leaves pockets out of an expense', () => {
    expect(
      accountChoices(ROWS, { includePockets: false, keepId: null }).map((row) => row.id),
    ).toEqual(['checking', 'card', 'deposit', 'degiro']);
  });

  it('puts each pocket right after its parent for a transfer', () => {
    expect(
      accountChoices(ROWS, { includePockets: true, keepId: null }).map((row) => row.id),
    ).toEqual(['checking', 'car', 'card', 'deposit', 'trip', 'sofa', 'degiro']);
  });

  it('keeps a pocket that is already selected, such as the expense a closing goal records', () => {
    expect(
      accountChoices(ROWS, { includePockets: false, keepId: 'car' }).map((row) => row.id),
    ).toEqual(['checking', 'car', 'card', 'deposit', 'degiro']);
  });
});
