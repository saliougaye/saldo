import { describe, expect, it } from 'vitest';
import { type Account, accountSchema, recurrenceSchema, transactionSchema } from './entities';
import {
  canRestoreGoal,
  newGoalFields,
  newGoalTransferFields,
  planCloseGoal,
  restoreGoalFields,
} from './goalPlans';

const STAMPS = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
};

const account = (patch: Record<string, unknown> = {}) =>
  accountSchema.parse({
    id: 'a1',
    ...STAMPS,
    name: 'Conto',
    type: 'checking',
    institution: null,
    openingBalance: 1000,
    includeInSpendable: true,
    colorIndex: 0,
    icon: 'landmark',
    creditCloseDay: null,
    creditChargeDay: null,
    creditPaymentAccountId: null,
    archivedAt: null,
    sortOrder: 0,
    ...patch,
  });

const pocket = (id: string, parent: string, patch: Record<string, unknown> = {}): Account =>
  account({
    id,
    type: 'pocket',
    includeInSpendable: false,
    openingBalance: 0,
    parentAccountId: parent,
    goalTarget: 100000,
    goalStartDate: '2026-01-01',
    ...patch,
  });

const tx = (id: string, patch: Record<string, unknown>) =>
  transactionSchema.parse({
    id,
    ...STAMPS,
    kind: 'expense',
    amount: 100,
    date: '2026-09-01',
    accountId: 'main',
    toAccountId: null,
    categoryId: null,
    description: '',
    note: null,
    tagIds: [],
    excludeFromTotals: false,
    recurrenceId: null,
    ...patch,
  });

const recurrence = (
  id: string,
  template: { accountId: string; toAccountId: string },
  startDate: string,
) =>
  recurrenceSchema.parse({
    id,
    ...STAMPS,
    frequency: 'monthly',
    interval: 1,
    startDate,
    endDate: null,
    template: {
      kind: 'transfer',
      amount: 100,
      categoryId: null,
      description: '',
      tagIds: [],
      excludeFromTotals: false,
      ...template,
    },
  });

describe('newGoalFields', () => {
  const input = {
    name: 'Vacanza',
    icon: 'target',
    colorIndex: 5,
    parentAccountId: 'main',
    goalTarget: 100000,
    goalDeadline: '2027-06-01',
    alreadySaved: 0,
    today: '2026-09-30',
    sortOrder: 3,
  };

  it('is an empty, unspendable pocket that starts today', () => {
    expect(newGoalFields(input)).toMatchObject({
      type: 'pocket',
      openingBalance: 0,
      includeInSpendable: false,
      parentAccountId: 'main',
      goalTarget: 100000,
      goalDeadline: '2027-06-01',
      goalStartDate: '2026-09-30',
      sortOrder: 3,
      archivedAt: null,
      institution: null,
    });
  });

  it('moves what is already aside by a transfer, never an opening balance', () => {
    expect(newGoalTransferFields({ ...input, alreadySaved: 0 }, 'g1')).toBeNull();
    expect(newGoalTransferFields({ ...input, alreadySaved: 2500 }, 'g1')).toMatchObject({
      kind: 'transfer',
      amount: 2500,
      date: '2026-09-30',
      accountId: 'main',
      toAccountId: 'g1',
      categoryId: null,
      description: 'Vacanza',
    });
  });
});

describe('planCloseGoal', () => {
  it('returns a positive balance to the parent, tomorrow’s rows are dropped', () => {
    const plan = planCloseGoal({
      pocket: pocket('g1', 'main'),
      transactions: [
        tx('t1', {
          kind: 'transfer',
          amount: 5000,
          date: '2026-09-01',
          accountId: 'main',
          toAccountId: 'g1',
        }),
        tx('t2', {
          kind: 'transfer',
          amount: 900,
          date: '2026-10-05',
          accountId: 'main',
          toAccountId: 'g1',
        }),
      ],
      recurrences: [],
      today: '2026-09-30',
    });
    expect(plan.tombstoneTransactionIds).toEqual(['t2']);
    expect(plan.settlement).toMatchObject({ amount: 5000, accountId: 'g1', toAccountId: 'main' });
  });

  it('tops up a pocket that spent more than it held from the parent', () => {
    const plan = planCloseGoal({
      pocket: pocket('g1', 'main'),
      transactions: [
        tx('t1', {
          kind: 'expense',
          amount: 700,
          date: '2026-09-02',
          accountId: 'g1',
          toAccountId: null,
          categoryId: 'c1',
        }),
      ],
      recurrences: [],
      today: '2026-09-30',
    });
    expect(plan.settlement).toMatchObject({ amount: 700, accountId: 'main', toAccountId: 'g1' });
  });

  it('writes no settlement for an empty pocket', () => {
    expect(
      planCloseGoal({
        pocket: pocket('g1', 'main'),
        transactions: [],
        recurrences: [],
        today: '2026-09-30',
      }).settlement,
    ).toBeNull();
  });

  it('stops a recurrence that touches the pocket and drops its future occurrences', () => {
    const rec = recurrence('r1', { accountId: 'main', toAccountId: 'g1' }, '2026-01-01');
    const plan = planCloseGoal({
      pocket: pocket('g1', 'main'),
      transactions: [
        tx('o1', {
          kind: 'transfer',
          amount: 100,
          date: '2026-09-01',
          accountId: 'main',
          toAccountId: 'g1',
          recurrenceId: 'r1',
        }),
        tx('o2', {
          kind: 'transfer',
          amount: 100,
          date: '2026-10-01',
          accountId: 'main',
          toAccountId: 'g1',
          recurrenceId: 'r1',
        }),
      ],
      recurrences: [rec],
      today: '2026-09-30',
    });
    expect(plan.tombstoneTransactionIds).toEqual(['o2']);
    expect(plan.recurrenceEdits).toEqual([{ id: 'r1', endDate: '2026-09-30', delete: false }]);
    // o1 (100) is the only row left, so 100 goes back to the parent.
    expect(plan.settlement).toMatchObject({ amount: 100, accountId: 'g1', toAccountId: 'main' });
  });

  it('deletes a recurrence that never started', () => {
    const rec = recurrence('r1', { accountId: 'main', toAccountId: 'g1' }, '2026-11-01');
    const plan = planCloseGoal({
      pocket: pocket('g1', 'main'),
      transactions: [],
      recurrences: [rec],
      today: '2026-09-30',
    });
    expect(plan.recurrenceEdits).toEqual([{ id: 'r1', endDate: null, delete: true }]);
  });
});

describe('restore', () => {
  it('reopens empty from today and drops a deadline that has passed', () => {
    const past = pocket('g1', 'main', {
      archivedAt: '2026-08-01T00:00:00.000Z',
      goalDeadline: '2026-08-15',
    });
    expect(restoreGoalFields(past, '2026-09-30')).toEqual({
      archivedAt: null,
      goalStartDate: '2026-09-30',
      goalDeadline: null,
    });
    const future = pocket('g1', 'main', {
      archivedAt: '2026-08-01T00:00:00.000Z',
      goalDeadline: '2027-01-01',
    });
    expect(restoreGoalFields(future, '2026-09-30').goalDeadline).toBe('2027-01-01');
  });

  it('stays closed while its parent is archived', () => {
    const parent = account({ id: 'main', archivedAt: '2026-09-01T00:00:00.000Z' });
    expect(canRestoreGoal(pocket('g1', 'main'), [parent])).toBe(false);
    expect(canRestoreGoal(pocket('g1', 'main'), [account({ id: 'main' })])).toBe(true);
    expect(canRestoreGoal(pocket('g1', 'gone'), [account({ id: 'main' })])).toBe(false);
  });
});
