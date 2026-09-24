import { archiveAccount } from './adminService';
import { closeGoal, closeGoalWithExpense, createGoal, restoreGoal } from './goalService';
import { changeRecurrenceRule } from './recurrenceService';
import { createRepositories } from './repositories';
import { createTestDatabase } from './testing';

const NOW = '2026-09-24T10:00:00.000Z';
const TODAY = '2026-09-24';

function setup() {
  const db = createTestDatabase();
  const repos = createRepositories(db, () => NOW);
  const checking = repos.accounts.create({
    id: 'checking',
    name: 'Conto corrente',
    type: 'checking',
    institution: null,
    openingBalance: 700_000,
    includeInSpendable: true,
    colorIndex: 0,
    icon: 'landmark',
    creditCloseDay: null,
    creditChargeDay: null,
    creditPaymentAccountId: null,
    archivedAt: null,
    sortOrder: 0,
  });
  return { db, repos, checking };
}

const input = {
  name: 'Macchina',
  icon: 'car',
  colorIndex: 5,
  parentAccountId: 'checking',
  goalTarget: 1_200_000,
  goalDeadline: '2027-06-30',
  alreadySaved: 500_000,
  today: TODAY,
  sortOrder: 1,
};

describe('createGoal', () => {
  it('opens an empty, unspendable pocket and moves what is already aside into it', () => {
    const { db, repos } = setup();
    const pocket = createGoal(db, repos, input);
    expect(pocket).toMatchObject({
      type: 'pocket',
      openingBalance: 0,
      includeInSpendable: false,
      parentAccountId: 'checking',
      goalTarget: 1_200_000,
      goalDeadline: '2027-06-30',
      goalStartDate: TODAY,
    });
    const [transfer] = repos.transactions.list();
    expect(transfer).toMatchObject({
      kind: 'transfer',
      amount: 500_000,
      date: TODAY,
      accountId: 'checking',
      toAccountId: pocket.id,
      description: 'Macchina',
    });
  });

  it('writes no transfer when nothing is aside yet', () => {
    const { db, repos } = setup();
    createGoal(db, repos, { ...input, alreadySaved: 0 });
    expect(repos.transactions.list()).toEqual([]);
  });
});

describe('closeGoal', () => {
  it('returns what is left to the parent, then archives the pocket at zero', () => {
    const { db, repos } = setup();
    const pocket = createGoal(db, repos, input);
    closeGoal(db, repos, pocket.id, TODAY, NOW);
    const back = repos.transactions.list().find((row) => row.accountId === pocket.id);
    expect(back).toMatchObject({
      kind: 'transfer',
      amount: 500_000,
      toAccountId: 'checking',
    });
    expect(repos.accounts.byId(pocket.id)?.archivedAt).toBe(NOW);
  });

  it('only archives a pocket that is already empty', () => {
    const { db, repos } = setup();
    const pocket = createGoal(db, repos, { ...input, alreadySaved: 0 });
    closeGoal(db, repos, pocket.id, TODAY, NOW);
    expect(repos.transactions.list()).toEqual([]);
    expect(repos.accounts.byId(pocket.id)?.archivedAt).toBe(NOW);
  });
});

describe('archiveAccount', () => {
  it('refuses a parent that still holds an open goal', () => {
    const { db, repos } = setup();
    createGoal(db, repos, input);
    expect(() => archiveAccount(repos, 'checking', NOW)).toThrow(/open goals/);
    expect(repos.accounts.byId('checking')?.archivedAt).toBeNull();
  });
});

const expense = (accountId: string, amount: number, date: string) => ({
  kind: 'expense' as const,
  amount,
  date,
  accountId,
  toAccountId: null,
  categoryId: 'cat-car',
  description: 'Auto',
  note: null,
  tagIds: [],
  excludeFromTotals: false,
  recurrenceId: null,
});

const balanceOf = (repos: ReturnType<typeof setup>['repos'], id: string) =>
  repos.transactions
    .list()
    .reduce(
      (sum, tx) =>
        sum +
        (tx.accountId === id ? (tx.kind === 'income' ? tx.amount : -tx.amount) : 0) +
        (tx.kind === 'transfer' && tx.toAccountId === id ? tx.amount : 0),
      0,
    );

describe('closeGoal, whatever the pocket went through', () => {
  it('tops up a pocket that spent more than it held, from the parent, and leaves it at zero', () => {
    const { db, repos } = setup();
    const pocket = createGoal(db, repos, input);
    repos.transactions.create(expense(pocket.id, 600_000, TODAY));
    closeGoal(db, repos, pocket.id, TODAY, NOW);
    expect(balanceOf(repos, pocket.id)).toBe(0);
    expect(
      repos.transactions
        .list()
        .find((row) => row.toAccountId === pocket.id && row.amount === 100_000),
    ).toMatchObject({ kind: 'transfer', accountId: 'checking' });
  });

  it('stops the recurring contributions and drops every row dated after today', () => {
    const { db, repos } = setup();
    const pocket = createGoal(db, repos, input);
    const recurrence = repos.recurrences.create({
      frequency: 'monthly',
      interval: 1,
      startDate: '2026-09-01',
      endDate: null,
      template: {
        kind: 'transfer',
        amount: 70_000,
        accountId: 'checking',
        toAccountId: pocket.id,
        categoryId: null,
        description: 'Accantona',
        tagIds: [],
        excludeFromTotals: false,
      },
    });
    repos.transactions.create({
      kind: 'transfer',
      amount: 70_000,
      date: '2026-10-01',
      accountId: 'checking',
      toAccountId: pocket.id,
      categoryId: null,
      description: 'Accantona',
      note: null,
      tagIds: [],
      excludeFromTotals: false,
      recurrenceId: recurrence.id,
    });
    repos.transactions.create(expense(pocket.id, 10_000, '2026-11-15'));
    closeGoal(db, repos, pocket.id, TODAY, NOW);
    expect(repos.transactions.list().filter((row) => row.date > TODAY)).toEqual([]);
    const after = repos.recurrences.byId(recurrence.id);
    expect(after === null || after.endDate === TODAY || after.deletedAt !== null).toBe(true);
    expect(balanceOf(repos, pocket.id)).toBe(0);
  });

  it('refuses a goal that is already closed', () => {
    const { db, repos } = setup();
    const pocket = createGoal(db, repos, input);
    closeGoal(db, repos, pocket.id, TODAY, NOW);
    expect(() => closeGoal(db, repos, pocket.id, TODAY, NOW)).toThrow(/No open goal/);
  });
});

describe('a closed goal’s recurrence', () => {
  it('cannot be restarted: new transfers would land in an archived pocket', () => {
    const { db, repos } = setup();
    const pocket = createGoal(db, repos, input);
    const recurrence = repos.recurrences.create({
      frequency: 'monthly',
      interval: 1,
      startDate: '2026-09-01',
      endDate: null,
      template: {
        kind: 'transfer',
        amount: 70_000,
        accountId: 'checking',
        toAccountId: pocket.id,
        categoryId: null,
        description: 'Accantona',
        tagIds: [],
        excludeFromTotals: false,
      },
    });
    closeGoal(db, repos, pocket.id, TODAY, NOW);
    const ended = repos.recurrences.byId(recurrence.id) ?? recurrence;
    expect(() =>
      changeRecurrenceRule(
        db,
        repos,
        ended,
        { frequency: 'monthly', interval: 1, endDate: null },
        TODAY,
        { kind: 'month', startDay: 1 },
      ),
    ).toThrow(/closed goal/);
  });
});

describe('closeGoalWithExpense', () => {
  it('records the expense from the pocket, today at the latest and never repeating, then closes', () => {
    const { db, repos } = setup();
    const pocket = createGoal(db, repos, input);
    closeGoalWithExpense(db, repos, {
      goalId: pocket.id,
      expense: { ...expense('checking', 450_000, '2026-12-01') },
      today: TODAY,
      nowIso: NOW,
    });
    const spent = repos.transactions.list().find((row) => row.kind === 'expense');
    expect(spent).toMatchObject({ accountId: pocket.id, date: TODAY, amount: 450_000 });
    expect(balanceOf(repos, pocket.id)).toBe(0);
    expect(repos.accounts.byId(pocket.id)?.archivedAt).toBe(NOW);
  });
});

describe('closeGoalWithExpense keeps the sheet’s id', () => {
  it('so a receipt attached in the sheet belongs to the expense', () => {
    const { db, repos } = setup();
    const pocket = createGoal(db, repos, input);
    closeGoalWithExpense(db, repos, {
      goalId: pocket.id,
      expense: { id: 'tx-sheet', ...expense(pocket.id, 500_000, TODAY) },
      today: TODAY,
      nowIso: NOW,
    });
    expect(repos.transactions.byId('tx-sheet')?.kind).toBe('expense');
  });
});

describe('restoreGoal', () => {
  it('reopens a closed goal from today, dropping a deadline that has passed', () => {
    const { db, repos } = setup();
    const pocket = createGoal(db, repos, { ...input, goalDeadline: '2026-10-15' });
    closeGoal(db, repos, pocket.id, TODAY, NOW);
    restoreGoal(repos, pocket.id, '2026-11-01');
    expect(repos.accounts.byId(pocket.id)).toMatchObject({
      archivedAt: null,
      goalStartDate: '2026-11-01',
      goalDeadline: null,
    });
  });

  it('refuses when the parent account is archived', () => {
    const { db, repos } = setup();
    const pocket = createGoal(db, repos, { ...input, alreadySaved: 0 });
    closeGoal(db, repos, pocket.id, TODAY, NOW);
    repos.accounts.update('checking', { archivedAt: NOW });
    expect(() => restoreGoal(repos, pocket.id, TODAY)).toThrow(/parent/);
  });
});
