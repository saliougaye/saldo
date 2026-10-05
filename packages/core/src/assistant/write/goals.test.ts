import { describe, expect, it } from 'vitest';
import type { Account } from '../../entities';
import { resolveGoalInput, resolveGoalTransfer } from './goals';

const TODAY = '2026-09-29';

const goal: Account = {
  id: 'goal-1',
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: 'hlc-goal',
  deletedAt: null,
  name: 'Vacanza',
  type: 'pocket',
  institution: null,
  openingBalance: 0,
  includeInSpendable: false,
  colorIndex: 5,
  icon: 'plane',
  creditCloseDay: null,
  creditChargeDay: null,
  creditPaymentAccountId: null,
  archivedAt: null,
  sortOrder: 2,
  parentAccountId: 'acc-main',
  goalTarget: 100000,
  goalDeadline: '2027-06-30',
  goalStartDate: '2026-09-01',
};

describe('resolveGoalInput', () => {
  it('refuses to move a goal to another account or to add savings on an edit', () => {
    expect(
      resolveGoalInput({ id: 'goal-1', updatedAt: 'hlc-goal', parentAccountId: 'acc-x' }, goal, 2)
        .ok,
    ).toBe(false);
    expect(
      resolveGoalInput({ id: 'goal-1', updatedAt: 'hlc-goal', alreadySavedMinor: 100 }, goal, 2).ok,
    ).toBe(false);
  });
});

describe('resolveGoalTransfer', () => {
  it('sets aside from the parent into the goal, named after the goal', () => {
    expect(
      resolveGoalTransfer(
        goal,
        { goalId: 'goal-1', direction: 'set_aside', amountMinor: 5000 },
        TODAY,
        2,
      ),
    ).toEqual({
      ok: true,
      value: {
        id: null,
        kind: 'transfer',
        buffer: '50',
        date: TODAY,
        accountId: 'acc-main',
        toAccountId: 'goal-1',
        categoryId: null,
        description: 'Vacanza',
        tagIds: [],
        excludeFromTotals: false,
      },
    });
  });

  it('withdraws from the goal back to the parent', () => {
    const result = resolveGoalTransfer(
      goal,
      {
        goalId: 'goal-1',
        direction: 'withdraw',
        amountMinor: 3000,
        date: '2026-09-28',
        description: 'Anticipo',
      },
      TODAY,
      2,
    );
    expect(result.ok && result.value).toMatchObject({
      accountId: 'goal-1',
      toAccountId: 'acc-main',
      date: '2026-09-28',
      description: 'Anticipo',
    });
  });

  it('refuses an account that is not an open goal', () => {
    const closed = { ...goal, archivedAt: '2026-09-20T10:00:00.000Z' };
    const plain: Account = { ...goal, type: 'checking', parentAccountId: null };
    const move = { goalId: 'goal-1', direction: 'set_aside', amountMinor: 1 } as const;
    expect(resolveGoalTransfer(closed, move, TODAY, 2).ok).toBe(false);
    expect(resolveGoalTransfer(plain, move, TODAY, 2).ok).toBe(false);
  });
});
