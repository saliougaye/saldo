import { describe, expect, it } from 'vitest';
import type { Transaction } from '../../entities';
import {
  deleteTransactionTool,
  resolveTransactionInput,
  saveTransactionInput,
  saveTransactionTool,
} from './transactions';

const TODAY = '2026-09-29';

const stored: Transaction = {
  id: 'tx-1',
  createdAt: '2026-09-28T10:00:00.000Z',
  updatedAt: 'hlc-tx-1',
  deletedAt: null,
  kind: 'expense',
  amount: 4820,
  date: '2026-09-28',
  accountId: 'acc-main',
  toAccountId: null,
  categoryId: 'cat-food',
  description: 'Esselunga',
  note: 'kept by the server, not here',
  tagIds: ['tag-1'],
  excludeFromTotals: false,
  recurrenceId: null,
};

describe('saveTransactionInput', () => {
  it('accepts a minimal create and a partial update', () => {
    expect(
      saveTransactionInput.safeParse({
        kind: 'expense',
        amountMinor: 4820,
        accountId: 'acc-main',
        categoryId: 'cat-food',
      }).success,
    ).toBe(true);
    expect(
      saveTransactionInput.safeParse({ id: 'tx-1', updatedAt: 'hlc', categoryId: 'cat-out' })
        .success,
    ).toBe(true);
  });

  it('refuses amounts that are not positive integers, and dates that are not real', () => {
    expect(saveTransactionInput.safeParse({ amountMinor: 0 }).success).toBe(false);
    expect(saveTransactionInput.safeParse({ amountMinor: 48.2 }).success).toBe(false);
    expect(saveTransactionInput.safeParse({ date: '2026-02-30' }).success).toBe(false);
  });
});

describe('resolveTransactionInput — create', () => {
  it('fills the form defaults and turns minor units into the keypad buffer', () => {
    const result = resolveTransactionInput(
      { kind: 'expense', amountMinor: 4820, accountId: 'acc-main', categoryId: 'cat-food' },
      null,
      TODAY,
      2,
    );
    expect(result).toEqual({
      ok: true,
      value: {
        id: null,
        kind: 'expense',
        buffer: '48.2',
        date: TODAY,
        accountId: 'acc-main',
        toAccountId: null,
        categoryId: 'cat-food',
        description: '',
        tagIds: [],
        excludeFromTotals: false,
        expectedUpdatedAt: undefined,
      },
    });
  });

  it('writes a yen amount without decimals', () => {
    const result = resolveTransactionInput(
      { kind: 'income', amountMinor: 1200, accountId: 'acc-main', categoryId: 'cat-pay' },
      null,
      TODAY,
      0,
    );
    expect(result.ok && result.value.buffer).toBe('1200');
  });

  it('needs a kind to create', () => {
    const result = resolveTransactionInput({ amountMinor: 100 }, null, TODAY, 2);
    expect(result).toEqual({ ok: false, message: expect.stringMatching(/kind/) });
  });

  it('refuses a category on a transfer and a destination on an expense', () => {
    expect(
      resolveTransactionInput({ kind: 'transfer', categoryId: 'cat-food' }, null, TODAY, 2).ok,
    ).toBe(false);
    expect(
      resolveTransactionInput({ kind: 'expense', toAccountId: 'acc-savings' }, null, TODAY, 2).ok,
    ).toBe(false);
  });
});

describe('resolveTransactionInput — update', () => {
  it('changes only the given fields and carries the version read', () => {
    const result = resolveTransactionInput(
      { id: 'tx-1', updatedAt: 'hlc-tx-1', amountMinor: 5000 },
      stored,
      TODAY,
      2,
    );
    expect(result).toEqual({
      ok: true,
      value: {
        id: 'tx-1',
        kind: 'expense',
        buffer: '50',
        date: '2026-09-28',
        accountId: 'acc-main',
        toAccountId: null,
        categoryId: 'cat-food',
        description: 'Esselunga',
        tagIds: ['tag-1'],
        excludeFromTotals: false,
        expectedUpdatedAt: 'hlc-tx-1',
      },
    });
  });

  it('switching to a transfer drops the category, as the form does', () => {
    const result = resolveTransactionInput(
      { id: 'tx-1', updatedAt: 'hlc-tx-1', kind: 'transfer', toAccountId: 'acc-savings' },
      stored,
      TODAY,
      2,
    );
    expect(result.ok && result.value).toMatchObject({
      kind: 'transfer',
      categoryId: null,
      toAccountId: 'acc-savings',
    });
  });

  it('needs updatedAt with id', () => {
    expect(resolveTransactionInput({ id: 'tx-1', amountMinor: 1 }, stored, TODAY, 2)).toEqual({
      ok: false,
      message: expect.stringMatching(/updatedAt/),
    });
  });
});

describe('the specs', () => {
  it('are write tools with the agreed annotations', () => {
    expect(saveTransactionTool).toMatchObject({
      name: 'save_transaction',
      scope: 'write',
      annotations: { destructiveHint: false, idempotentHint: false },
    });
    expect(deleteTransactionTool).toMatchObject({
      name: 'delete_transaction',
      scope: 'write',
      annotations: { destructiveHint: true, idempotentHint: true },
    });
  });
});
