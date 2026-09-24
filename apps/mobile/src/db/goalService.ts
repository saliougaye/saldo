import { type Account, accountBalances, type LocalDate } from '@saldo/core';
import type { Repositories } from './repositories';
import type { RepositoryDatabase } from './repositories/support';

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
 * Closes a goal (§5.14): whatever the pocket still holds goes back to the parent, then the pocket
 * is archived. An archived pocket always has a zero balance, so archiving never hides money from
 * the totals. The expense «Registra la spesa» records is saved before this runs.
 */
export function closeGoal(
  db: RepositoryDatabase,
  repos: Repositories,
  goalId: string,
  today: LocalDate,
  nowIso: string,
): void {
  db.transaction(() => {
    const pocket = repos.accounts.byId(goalId);
    if (pocket === null || pocket.type !== 'pocket' || pocket.parentAccountId == null) {
      throw new Error(`No open goal ${goalId}`);
    }
    const balance = accountBalances([pocket], repos.transactions.list(), today).get(goalId) ?? 0;
    if (balance > 0) {
      repos.transactions.create({
        kind: 'transfer',
        amount: balance,
        date: today,
        accountId: goalId,
        toAccountId: pocket.parentAccountId,
        categoryId: null,
        description: pocket.name,
        note: null,
        tagIds: [],
        excludeFromTotals: false,
        recurrenceId: null,
      });
    }
    repos.accounts.update(goalId, { archivedAt: nowIso });
  });
}
