import { describe, expect, it } from 'vitest';
import { canSave, emptyForm, missingForSave, type TransactionFormValues } from './transactionForm';

const TODAY = '2026-04-18';

const valid: TransactionFormValues = {
  ...emptyForm(TODAY, 'acc-1'),
  buffer: '45',
  categoryId: 'cat-1',
};

describe('canSave', () => {
  it('reads the amount at the currency scale', () => {
    // "0.5" is 50 cents at scale 2 but rounds to nothing at scale 0.
    expect(canSave({ ...valid, buffer: '0.5' }, 2)).toBe(true);
    expect(canSave({ ...valid, buffer: '0.5' }, 0)).toBe(false);
  });
});

describe('missingForSave', () => {
  const base = emptyForm(TODAY, 'acc-1');

  it('blocks a transfer the source account cannot cover, last of all', () => {
    const transfer = {
      ...base,
      kind: 'transfer' as const,
      buffer: '12',
      accountId: 'acc-1',
      toAccountId: 'acc-2',
    };
    expect(missingForSave(transfer, 2, true)).toBe('insufficientFunds');
    expect(canSave(transfer, 2, true)).toBe(false);
    // Still last: a form that is not a valid transfer yet names the field, not the funds.
    expect(missingForSave({ ...transfer, toAccountId: null }, 2, true)).toBe('destination');
    expect(missingForSave({ ...transfer, buffer: '' }, 2, true)).toBe('amount');
  });
});
