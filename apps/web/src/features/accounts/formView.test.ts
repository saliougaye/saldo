import { ACCOUNT_TYPES, accountSchema, emptyAccountForm, emptyGoalForm } from '@saldo/core';
import { describe, expect, it } from 'vitest';
import { ACCOUNT, ACCOUNT_2, account, dataWith, tx } from '../test/fixtures';
import { accountFormView, balanceToSend, goalFormView } from './formView';

const TODAY = '2026-09-20';
const base = { today: TODAY, currency: 'EUR' } as const;

const MAIN = accountSchema.parse({ ...ACCOUNT, openingBalance: 100000 });
const CARD = account({ id: 'card', name: 'Carta', type: 'credit_card', sortOrder: 2 });
const POCKET = account({
  id: 'p1',
  name: 'Vacanze',
  type: 'pocket',
  includeInSpendable: false,
  parentAccountId: MAIN.id,
  goalTarget: 100000,
  goalStartDate: '2026-01-01',
  goalDeadline: '2027-06-01',
  sortOrder: 3,
});
const CLOSED_POCKET = account({ ...POCKET, id: 'p2', archivedAt: '2026-08-01T00:00:00.000Z' });
const ARCHIVED = account({ id: 'old', name: 'Vecchio', archivedAt: '2026-05-01T00:00:00.000Z' });

const data = dataWith([tx({ id: 't1', amount: 1000, date: '2026-09-10' })], {
  accounts: [MAIN, ACCOUNT_2, CARD],
});

describe('accountFormView', () => {
  it('a new account starts empty and offers every type', () => {
    const view = accountFormView({ ...base, data, mode: 'new', id: null });
    expect(view?.mode).toBe('new');
    expect(view?.id).toBeNull();
    expect(view?.initial).toEqual(emptyAccountForm());
    expect(view?.types).toEqual(ACCOUNT_TYPES);
    expect(view?.paymentAccounts.map((a) => a.id)).toEqual(['a1', 'a2']);
    expect(view?.minorDigits).toBe(2);
    expect(view?.name).toBe('');
  });

  it('an edit shows the current balance, not the opening one', () => {
    const view = accountFormView({ ...base, data, mode: 'edit', id: 'a1' });
    expect(view?.initial.buffer).toBe('990');
    expect(view?.initial.name).toBe('Conto');
    expect(view?.name).toBe('Conto');
    expect(view?.id).toBe('a1');
  });

  it('a card is never offered itself as the account that pays it', () => {
    const view = accountFormView({ ...base, data, mode: 'edit', id: 'card' });
    expect(view?.paymentAccounts.map((a) => a.id)).toEqual(['a1', 'a2']);
    const own = accountFormView({ ...base, data, mode: 'edit', id: 'a1' });
    expect(own?.paymentAccounts.map((a) => a.id)).toEqual(['a2']);
  });

  it('narrows the types of an account that holds a goal', () => {
    const withGoal = { ...data, accounts: [...data.accounts, POCKET] };
    const view = accountFormView({ ...base, data: withGoal, mode: 'edit', id: 'a1' });
    expect(view?.types).not.toContain('credit_card');
    expect(view?.types).toContain('checking');
    const other = accountFormView({ ...base, data: withGoal, mode: 'edit', id: 'a2' });
    expect(other?.types).toEqual(ACCOUNT_TYPES);
  });

  it('is null for a pocket, an archived account or an unknown id', () => {
    const all = { ...data, accounts: [...data.accounts, POCKET, ARCHIVED] };
    for (const id of ['p1', 'old', 'nope']) {
      expect(accountFormView({ ...base, data: all, mode: 'edit', id })).toBeNull();
    }
  });
});

describe('goalFormView', () => {
  const all = { ...data, accounts: [MAIN, ACCOUNT_2, CARD, ARCHIVED, POCKET, CLOSED_POCKET] };

  it('a new form offers as parents only live cash, checking, debit and savings accounts', () => {
    const view = goalFormView({ ...base, data: all, mode: 'new', id: null });
    expect(view?.initial).toEqual(emptyGoalForm());
    expect(view?.parents.map((p) => p.id)).toEqual(['a1', 'a2']);
    expect(view?.parents[1]).toEqual({ id: 'a2', name: 'Risparmi', icon: 'piggy', colorIndex: 3 });
    expect(view?.today).toBe(TODAY);
    expect(view?.minorDigits).toBe(2);
  });

  it('an edit is filled from the pocket, with its parent', () => {
    const view = goalFormView({ ...base, data: all, mode: 'edit', id: 'p1' });
    expect(view?.id).toBe('p1');
    expect(view?.initial.parentAccountId).toBe('a1');
    expect(view?.initial.name).toBe('Vacanze');
    expect(view?.initial.deadline).toBe('2027-06-01');
  });

  it('is null for a plain account, a closed goal or an unknown id', () => {
    for (const id of ['a1', 'p2', 'nope']) {
      expect(goalFormView({ ...base, data: all, mode: 'edit', id })).toBeNull();
    }
  });
});

describe('balanceToSend', () => {
  it('sends null when the balance was left as loaded, so the server keeps the opening balance', () => {
    // A phone transaction after the page loaded must not be cancelled by a rename (§17.4.2).
    expect(balanceToSend('990', '990')).toBeNull();
  });
  it('sends the typed balance when the user changed it', () => {
    expect(balanceToSend('990', '1000')).toBe('1000');
    expect(balanceToSend('', '25.5')).toBe('25.5');
  });
});
