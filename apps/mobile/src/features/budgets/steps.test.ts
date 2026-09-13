import { emptyBudgetForm } from './budgetFormValues';
import { BUDGET_STEPS, budgetStepMissing, budgetStepReady } from './steps';

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

describe('budgetStepMissing', () => {
  it('names what the step is waiting for, so the button need not be dumbly grey', () => {
    expect(budgetStepMissing('categories', values, 2)).toBe('categories');
    expect(budgetStepMissing('amount', { ...values, categoryIds: ['c1'] }, 2)).toBe('amount');
  });

  it('names the categories first on the last step, which is the order the form asked in', () => {
    expect(budgetStepMissing('details', { ...values, buffer: '250' }, 2)).toBe('categories');
    expect(budgetStepMissing('details', { ...values, categoryIds: ['c1'] }, 2)).toBe('amount');
  });

  it('says nothing is missing exactly when the step is ready', () => {
    const complete = { ...values, categoryIds: ['c1'], buffer: '250' };
    for (const step of BUDGET_STEPS) {
      expect(budgetStepMissing(step, complete, 2) === null).toBe(
        budgetStepReady(step, complete, 2),
      );
      expect(budgetStepMissing(step, values, 2) === null).toBe(budgetStepReady(step, values, 2));
    }
  });
});
