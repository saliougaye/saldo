import {
  type Account,
  accountBalances,
  type LocalDate,
  planStopRecurrence,
  type Transaction,
} from '@saldo/core';
import type { Repositories } from './repositories';
import type { RepositoryDatabase } from './repositories/support';

type TransactionInput = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> & {
  id?: string;
};

export interface NewGoalInput {
  name: string;
  icon: string;
  colorIndex: number;
  parentAccountId: string;
  goalTarget: number;
  goalDeadline: LocalDate | null;
  /** «Già da parte»: moved from the parent on creation, never an opening balance. */
  alreadySaved: number;
  today: LocalDate;
  sortOrder: number;
}

/**
 * Creates a goal (§5.14): an empty, unspendable pocket inside its parent, plus — when something is
 * already aside — the transfer that moves it there. One database transaction: a pocket without its
 * money, or money without its pocket, would both misstate the totals.
 *
 * An opening balance would count the same money twice in Patrimonio complessivo, which is why the
 * money arrives by transfer.
 */
export function createGoal(
  db: RepositoryDatabase,
  repos: Repositories,
  input: NewGoalInput,
): Account {
  return db.transaction(() => {
    const pocket = repos.accounts.create({
      name: input.name,
      type: 'pocket',
      institution: null,
      openingBalance: 0,
      includeInSpendable: false,
      colorIndex: input.colorIndex,
      icon: input.icon,
      creditCloseDay: null,
      creditChargeDay: null,
      creditPaymentAccountId: null,
      archivedAt: null,
      sortOrder: input.sortOrder,
      parentAccountId: input.parentAccountId,
      goalTarget: input.goalTarget,
      goalDeadline: input.goalDeadline,
      goalStartDate: input.today,
    });
    if (input.alreadySaved > 0) {
      repos.transactions.create({
        kind: 'transfer',
        amount: input.alreadySaved,
        date: input.today,
        accountId: input.parentAccountId,
        toAccountId: pocket.id,
        categoryId: null,
        description: input.name,
        note: null,
        tagIds: [],
        excludeFromTotals: false,
        recurrenceId: null,
      });
    }
    return pocket;
  });
}

/**
 * Closing, without a transaction of its own so both close paths can share one (§5.14):
 *
 * 1. recurrences in or out of the pocket stop, and every row dated after today that touches it
 *    goes — an automatic contribution must not keep draining the parent into an archived account;
 * 2. the pocket is brought to exactly zero: what is left returns to the parent, and a pocket that
 *    spent more than it held is topped up from it (the parent paid the difference);
 * 3. the pocket is archived. An archived pocket always has a zero balance, so archiving never
 *    hides money from the totals.
 */
function closeGoalIn(repos: Repositories, goalId: string, today: LocalDate, nowIso: string): void {
  const pocket = repos.accounts.byId(goalId);
  const parentId = pocket?.parentAccountId;
  if (
    pocket == null ||
    pocket.type !== 'pocket' ||
    pocket.archivedAt !== null ||
    parentId == null
  ) {
    throw new Error(`No open goal ${goalId}`);
  }
  const touches = (tx: { accountId: string; toAccountId: string | null }) =>
    tx.accountId === goalId || tx.toAccountId === goalId;

  for (const recurrence of repos.recurrences.list()) {
    if (!touches(recurrence.template)) continue;
    const occurrences = repos.transactions
      .list()
      .filter((tx) => tx.recurrenceId === recurrence.id)
      .map((tx) => ({ id: tx.id, date: tx.date }));
    const plan = planStopRecurrence(recurrence, occurrences, today);
    for (const id of plan.tombstoneOccurrenceIds) repos.transactions.remove(id);
    if (plan.deleteRecurrence) repos.recurrences.remove(recurrence.id);
    else if (plan.endDate !== null)
      repos.recurrences.update(recurrence.id, { endDate: plan.endDate });
  }
  for (const tx of repos.transactions.list()) {
    if (tx.date > today && touches(tx)) repos.transactions.remove(tx.id);
  }

  const balance = accountBalances([pocket], repos.transactions.list(), today).get(goalId) ?? 0;
  if (balance !== 0) {
    repos.transactions.create({
      kind: 'transfer',
      amount: Math.abs(balance),
      date: today,
      accountId: balance > 0 ? goalId : parentId,
      toAccountId: balance > 0 ? parentId : goalId,
      categoryId: null,
      description: pocket.name,
      note: null,
      tagIds: [],
      excludeFromTotals: false,
      recurrenceId: null,
    });
  }
  repos.accounts.update(goalId, { archivedAt: nowIso });
}

/** «Riporta in {conto}» and the close of an empty goal (§6.38), in one database transaction. */
export function closeGoal(
  db: RepositoryDatabase,
  repos: Repositories,
  goalId: string,
  today: LocalDate,
  nowIso: string,
): void {
  db.transaction(() => closeGoalIn(repos, goalId, today, nowIso));
}

export interface CloseWithExpenseInput {
  goalId: string;
  /** The expense as the sheet left it; the account, date and repetition are forced. */
  expense: TransactionInput;
  today: LocalDate;
  nowIso: string;
}

/**
 * «Registra la spesa» (§6.38): the expense and the close in one transaction, so a failure leaves
 * neither. The expense comes out of the pocket, is dated today at the latest (a future date would
 * drain the pocket after it is archived) and never repeats.
 */
export function closeGoalWithExpense(
  db: RepositoryDatabase,
  repos: Repositories,
  input: CloseWithExpenseInput,
): void {
  db.transaction(() => {
    repos.transactions.create({
      ...input.expense,
      kind: 'expense',
      accountId: input.goalId,
      toAccountId: null,
      date: input.expense.date > input.today ? input.today : input.expense.date,
      recurrenceId: null,
    });
    closeGoalIn(repos, input.goalId, input.today, input.nowIso);
  });
}

/**
 * Reopens a closed goal, empty (§5.14): its pace starts again today, and a deadline that has
 * passed is dropped. A goal whose parent is archived stays closed: it would be invisible in Conti
 * and still counted in Patrimonio.
 */
export function restoreGoal(repos: Repositories, goalId: string, today: LocalDate): void {
  const pocket = repos.accounts.byId(goalId);
  if (pocket == null || pocket.type !== 'pocket') throw new Error(`No goal ${goalId}`);
  const parent =
    pocket.parentAccountId == null ? null : repos.accounts.byId(pocket.parentAccountId);
  if (parent == null || parent.archivedAt !== null) {
    throw new Error(`The parent of goal ${goalId} is archived`);
  }
  repos.accounts.update(goalId, {
    archivedAt: null,
    goalStartDate: today,
    goalDeadline:
      pocket.goalDeadline != null && pocket.goalDeadline > today ? pocket.goalDeadline : null,
  });
}
