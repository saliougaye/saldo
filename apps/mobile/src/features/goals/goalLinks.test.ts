import { settlementForm } from '../accounts/settlement';
import { goalExpenseForm, goalExpenseParams, goalTransferParams } from './goalLinks';

describe('goal links', () => {
  it('opens a transfer from the parent into the goal, amount left to the user', () => {
    const form = settlementForm(goalTransferParams('checking', 'car', 'Macchina'), '2026-09-24', 2);
    expect(form?.values).toMatchObject({
      kind: 'transfer',
      accountId: 'checking',
      toAccountId: 'car',
      buffer: '',
      description: 'Macchina',
      date: '2026-09-24',
    });
    expect(form?.shortcuts).toEqual([]);
  });

  it('opens the closing expense from the goal, for its whole balance', () => {
    const form = goalExpenseForm(goalExpenseParams('car', 1_200_000, 'Macchina'), '2026-09-24', 2);
    expect(form?.closeGoalId).toBe('car');
    expect(form?.values).toMatchObject({
      kind: 'expense',
      accountId: 'car',
      buffer: '12000',
      description: 'Macchina',
      categoryId: null,
    });
  });

  it('is no closing expense without its goal', () => {
    expect(goalExpenseForm({}, '2026-09-24', 2)).toBeNull();
  });
});
