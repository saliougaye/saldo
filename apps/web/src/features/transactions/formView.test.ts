import {
  accountBalances,
  categorySchema,
  emptyForm,
  emptyUserData,
  formFromTransaction,
  type Tag,
  tagSchema,
  topCategories,
} from '@saldo/core';
import { describe, expect, it } from 'vitest';
import {
  ACCOUNT,
  ACCOUNT_2,
  account,
  CATEGORY,
  CATEGORY_2,
  CATEGORY_CHILD,
  dataWith,
  RECURRENCE,
  TAG,
  tx,
} from '../test/fixtures';
import { accountsFor, formView } from './formView';

const TODAY = '2026-09-20';

const POCKET = account({
  id: 'p1',
  name: 'Vacanze',
  type: 'pocket',
  includeInSpendable: false,
  parentAccountId: ACCOUNT.id,
  goalTarget: 100000,
  goalStartDate: '2026-01-01',
  sortOrder: 2,
});

const ARCHIVED = account({
  id: 'a3',
  name: 'Vecchio',
  archivedAt: '2026-05-01T00:00:00.000Z',
  sortOrder: 3,
});

const INCOME = categorySchema.parse({
  ...CATEGORY,
  id: 'i1',
  name: 'Stipendio',
  direction: 'income',
});
const ARCHIVED_CATEGORY = categorySchema.parse({
  ...CATEGORY_2,
  id: 'c9',
  name: 'Vecchia',
  archivedAt: '2026-05-01T00:00:00.000Z',
});

function tag(id: string, name: string): Tag {
  return tagSchema.parse({ ...TAG, id, name });
}

describe('formView', () => {
  it('starts a new transaction on the first account that is neither a pocket nor archived', () => {
    const data = dataWith([], { accounts: [ARCHIVED, POCKET, ACCOUNT, ACCOUNT_2] });
    const view = formView({ data, today: TODAY, currency: 'EUR', mode: 'new', id: null });
    expect(view?.id).toBeNull();
    expect(view?.mode).toBe('new');
    expect(view?.recurring).toBe(false);
    expect(view?.minorDigits).toBe(2);
    expect(view?.initial).toEqual(emptyForm(TODAY, ACCOUNT.id));
  });

  it('fills an edit from the transaction, and says when it is an occurrence', () => {
    const row = tx({ id: 't1', amount: 1234, date: '2026-09-10', recurrenceId: RECURRENCE.id });
    const data = dataWith([row], { recurrences: [RECURRENCE] });
    const view = formView({ data, today: TODAY, currency: 'EUR', mode: 'edit', id: 't1' });
    expect(view?.id).toBe('t1');
    expect(view?.initial).toEqual(formFromTransaction(row, 2));
    expect(view?.recurring).toBe(true);
  });

  it('is not an occurrence when the row has no recurrence', () => {
    const data = dataWith([tx({ id: 't1', amount: 100, date: '2026-09-10' })]);
    const view = formView({ data, today: TODAY, currency: 'EUR', mode: 'edit', id: 't1' });
    expect(view?.recurring).toBe(false);
  });

  it('is null when editing an id the account does not have', () => {
    expect(
      formView({ data: emptyUserData(), today: TODAY, currency: 'EUR', mode: 'edit', id: 'nope' }),
    ).toBeNull();
  });

  it('lists the accounts in the chips’ order, pockets flagged, balances without the edited row', () => {
    const edited = tx({ id: 't1', amount: 500, date: '2026-09-10' });
    const other = tx({ id: 't2', amount: 200, date: '2026-09-11' });
    const data = dataWith([edited, other], { accounts: [ACCOUNT, ACCOUNT_2, POCKET, ARCHIVED] });
    const view = formView({ data, today: TODAY, currency: 'EUR', mode: 'edit', id: 't1' });
    const balances = accountBalances(data.accounts, [other], TODAY);
    expect(view?.accounts.map((a) => [a.id, a.pocket, a.archived, a.balance])).toEqual([
      [ACCOUNT.id, false, false, balances.get(ACCOUNT.id)],
      [POCKET.id, true, false, balances.get(POCKET.id)],
      [ACCOUNT_2.id, false, false, balances.get(ACCOUNT_2.id)],
    ]);
    expect(view?.accounts[0]?.balance).toBe(-200);
    expect(view?.accounts[1]?.goalTarget).toBe(100000);
    expect(view?.accounts[0]?.goalTarget).toBeNull();
  });

  it('carries the balance with the edited row too, the `now` of the transfer preview', () => {
    const edited = tx({ id: 't1', amount: 500, date: '2026-09-10' });
    const other = tx({ id: 't2', amount: 200, date: '2026-09-11' });
    const data = dataWith([edited, other], { accounts: [ACCOUNT] });
    const view = formView({ data, today: TODAY, currency: 'EUR', mode: 'edit', id: 't1' });
    expect(view?.accounts[0]?.balanceNow).toBe(-700);
    expect(view?.accounts[0]?.balance).toBe(-200);
    const fresh = formView({ data, today: TODAY, currency: 'EUR', mode: 'new', id: null });
    expect(fresh?.accounts[0]?.balanceNow).toBe(-700);
    expect(fresh?.accounts[0]?.balance).toBe(-700);
  });

  it('keeps an archived account the edited row uses, flagged archived', () => {
    const edited = tx({ id: 't1', amount: 500, date: '2026-09-10', accountId: ARCHIVED.id });
    const data = dataWith([edited], { accounts: [ACCOUNT, ARCHIVED] });
    const view = formView({ data, today: TODAY, currency: 'EUR', mode: 'edit', id: 't1' });
    expect(view?.accounts.map((a) => [a.id, a.archived])).toEqual([
      [ACCOUNT.id, false],
      [ARCHIVED.id, true],
    ]);
  });

  it('keeps an archived destination the edited transfer uses', () => {
    const edited = tx({
      id: 't1',
      amount: 500,
      date: '2026-09-10',
      kind: 'transfer',
      categoryId: null,
      toAccountId: ARCHIVED.id,
    });
    const data = dataWith([edited], { accounts: [ACCOUNT, ARCHIVED] });
    const view = formView({ data, today: TODAY, currency: 'EUR', mode: 'edit', id: 't1' });
    expect(view?.accounts.map((a) => a.id)).toEqual([ACCOUNT.id, ARCHIVED.id]);
  });

  it('ranks the tiles as the phone does, for expense and for income', () => {
    const txs = [
      tx({ id: 't1', amount: 100, date: '2026-09-10', categoryId: CATEGORY_2.id }),
      tx({ id: 't2', amount: 100, date: '2026-09-11', categoryId: CATEGORY_2.id }),
      tx({ id: 't3', amount: 100, date: '2026-09-12', kind: 'income', categoryId: INCOME.id }),
    ];
    const categories = [CATEGORY, CATEGORY_2, INCOME];
    const data = dataWith(txs, { categories });
    const view = formView({ data, today: TODAY, currency: 'EUR', mode: 'new', id: null });
    const ids = (kind: 'expense' | 'income') =>
      topCategories(categories, txs, kind, { today: TODAY }).map((c) => c.id);
    expect(view?.top.expense).toEqual(ids('expense'));
    expect(view?.top.expense[0]).toBe(CATEGORY_2.id);
    expect(view?.top.income).toEqual(ids('income'));
  });

  it('lists live categories, each parent followed by its children', () => {
    const data = dataWith([], {
      categories: [CATEGORY_2, CATEGORY_CHILD, INCOME, ARCHIVED_CATEGORY, CATEGORY],
    });
    const view = formView({ data, today: TODAY, currency: 'EUR', mode: 'new', id: null });
    expect(view?.categories.map((c) => [c.id, c.direction, c.child])).toEqual([
      [CATEGORY.id, 'expense', false],
      [CATEGORY_CHILD.id, 'expense', true],
      [CATEGORY_2.id, 'expense', false],
      [INCOME.id, 'income', false],
    ]);
  });

  it('keeps the archived category the edited row uses, flagged archived, after the live ones', () => {
    const edited = tx({
      id: 't1',
      amount: 500,
      date: '2026-09-10',
      categoryId: ARCHIVED_CATEGORY.id,
    });
    const data = dataWith([edited], { categories: [CATEGORY, ARCHIVED_CATEGORY, INCOME] });
    const view = formView({ data, today: TODAY, currency: 'EUR', mode: 'edit', id: 't1' });
    expect(view?.categories.map((c) => [c.id, c.archived])).toEqual([
      [CATEGORY.id, false],
      [ARCHIVED_CATEGORY.id, true],
      [INCOME.id, false],
    ]);
    const fresh = formView({ data, today: TODAY, currency: 'EUR', mode: 'new', id: null });
    expect(fresh?.categories.map((c) => c.id)).not.toContain(ARCHIVED_CATEGORY.id);
  });

  it('orders the tags by usage, most used first', () => {
    const tags = [tag('g1', 'Alfa'), tag('g2', 'Beta'), tag('g3', 'Gamma')];
    const data = dataWith(
      [
        tx({ id: 't1', amount: 100, date: '2026-09-10', tagIds: ['g3', 'g2'] }),
        tx({ id: 't2', amount: 100, date: '2026-09-11', tagIds: ['g3'] }),
      ],
      { tags },
    );
    const view = formView({ data, today: TODAY, currency: 'EUR', mode: 'new', id: null });
    expect(view?.tags).toEqual([
      { id: 'g3', name: 'Gamma' },
      { id: 'g2', name: 'Beta' },
      { id: 'g1', name: 'Alfa' },
    ]);
  });
});

describe('accountsFor', () => {
  const data = dataWith([], { accounts: [ACCOUNT, ACCOUNT_2, POCKET] });

  it('offers pockets for a transfer only (§5.14)', () => {
    const view = formView({ data, today: TODAY, currency: 'EUR', mode: 'new', id: null });
    if (view === null) throw new Error('no view');
    expect(accountsFor(view, 'transfer').map((a) => a.id)).toEqual([
      ACCOUNT.id,
      POCKET.id,
      ACCOUNT_2.id,
    ]);
    expect(accountsFor(view, 'expense').map((a) => a.id)).toEqual([ACCOUNT.id, ACCOUNT_2.id]);
    expect(accountsFor(view, 'income').map((a) => a.id)).toEqual([ACCOUNT.id, ACCOUNT_2.id]);
  });

  it('keeps the pocket an edited expense already sits on (the close-goal expense)', () => {
    const edited = tx({ id: 't1', amount: 500, date: '2026-09-10', accountId: POCKET.id });
    const withRow = dataWith([edited], { accounts: [ACCOUNT, ACCOUNT_2, POCKET] });
    const view = formView({ data: withRow, today: TODAY, currency: 'EUR', mode: 'edit', id: 't1' });
    if (view === null) throw new Error('no view');
    expect(accountsFor(view, 'expense').map((a) => a.id)).toEqual([
      ACCOUNT.id,
      POCKET.id,
      ACCOUNT_2.id,
    ]);
  });
});
