import { emptyGoalForm } from './goalFormValues';
import { goalStepMissing } from './steps';

const TODAY = '2026-09-24';
const filled = {
  ...emptyGoalForm(),
  name: 'Macchina',
  buffer: '12000',
  deadline: '2027-06-30',
  parentAccountId: 'checking',
};

describe('goalStepMissing', () => {
  it('asks each step for its own answer', () => {
    expect(goalStepMissing('look', emptyGoalForm(), TODAY, 2)).toBe('name');
    expect(goalStepMissing('target', { ...filled, buffer: '' }, TODAY, 2)).toBe('target');
    expect(goalStepMissing('deadline', { ...filled, deadline: '2026-09-01' }, TODAY, 2)).toBe(
      'deadline',
    );
    expect(goalStepMissing('account', { ...filled, parentAccountId: null }, TODAY, 2)).toBe(
      'parent',
    );
  });

  it('lets a goal have no deadline', () => {
    expect(goalStepMissing('deadline', { ...filled, deadline: null }, TODAY, 2)).toBeNull();
  });

  it('checks everything again on the last step and on edit, in the wizard’s order', () => {
    expect(goalStepMissing('account', { ...filled, name: '' }, TODAY, 2)).toBe('name');
    expect(goalStepMissing('edit', { ...filled, parentAccountId: null }, TODAY, 2)).toBeNull();
    expect(goalStepMissing('edit', { ...filled, buffer: '0' }, TODAY, 2)).toBe('target');
    // An expired goal can be renamed without moving its deadline first.
    expect(goalStepMissing('edit', { ...filled, deadline: '2026-09-01' }, TODAY, 2)).toBeNull();
  });
});
