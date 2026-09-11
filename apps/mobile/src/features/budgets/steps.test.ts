import { emptyBudgetForm } from './budgetFormValues';
import { BUDGET_STEPS, budgetStepReady } from './steps';

const values = emptyBudgetForm();

describe('budgetStepReady', () => {
  it('holds the first step until something is being budgeted', () => {
    expect(budgetStepReady('categories', values, 2)).toBe(false);
    expect(budgetStepReady('categories', { ...values, categoryIds: ['c1'] }, 2)).toBe(true);
  });

  it('holds the amount step until there is an amount', () => {
    const chosen = { ...values, categoryIds: ['c1'] };
    expect(budgetStepReady('amount', chosen, 2)).toBe(false);
    expect(budgetStepReady('amount', { ...chosen, buffer: '0' }, 2)).toBe(false);
    expect(budgetStepReady('amount', { ...chosen, buffer: '250' }, 2)).toBe(true);
  });

  it('checks both again before creating, so going back cannot leave a hole', () => {
    expect(budgetStepReady('details', { ...values, buffer: '250' }, 2)).toBe(false);
    expect(budgetStepReady('details', { ...values, categoryIds: ['c1'] }, 2)).toBe(false);
    expect(budgetStepReady('details', { ...values, categoryIds: ['c1'], buffer: '250' }, 2)).toBe(
      true,
    );
  });

  it('respects the currency scale: 0 minor digits means the buffer is whole units', () => {
    const chosen = { ...values, categoryIds: ['c1'], buffer: '1' };
    expect(budgetStepReady('amount', chosen, 0)).toBe(true);
  });

  it('runs the steps in the order the form shows them', () => {
    expect(BUDGET_STEPS).toEqual(['categories', 'amount', 'details']);
  });
});
