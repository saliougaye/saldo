import { accountBalances } from './accounts';
import type { LocalDate } from './dates';
import type { Account, Recurrence, Transaction } from './entities';
import { planStopRecurrence } from './recurrence';

/** A row's fields without what the store adds: id, the three stamps. */
export type AccountFields = Omit<Account, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;
export type TransactionFields = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

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
 * A goal (§5.14) is an empty, unspendable pocket inside its parent. An opening balance would count
 * the same money twice in Patrimonio complessivo, which is why the money arrives by transfer
 * (`newGoalTransferFields`).
 */
export function newGoalFields(input: NewGoalInput): AccountFields {
  return {
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
  };
}

/** The transfer that moves «Già da parte» from the parent into the new pocket, or `null`. */
export function newGoalTransferFields(
  input: NewGoalInput,
  pocketId: string,
): TransactionFields | null {
  if (input.alreadySaved <= 0) return null;
  return {
    kind: 'transfer',
    amount: input.alreadySaved,
    date: input.today,
    accountId: input.parentAccountId,
    toAccountId: pocketId,
    categoryId: null,
    description: input.name,
    note: null,
    tagIds: [],
    excludeFromTotals: false,
    recurrenceId: null,
  };
}

export interface CloseGoalPlan {
  /** Recurrences in or out of the pocket: ended today, or deleted when they never started. */
  recurrenceEdits: { id: string; endDate: LocalDate | null; delete: boolean }[];
  /** Every row dated after today that touches the pocket, occurrences of those recurrences included. */
  tombstoneTransactionIds: string[];
  /** Brings the pocket to exactly zero: what is left goes to the parent; a deficit is topped up from it. */
  settlement: TransactionFields | null;
}

/**
 * Closing (§5.14), as the phone's `closeGoalIn`:
 *
 * 1. recurrences in or out of the pocket stop, and every row dated after today that touches it
 *    goes — an automatic contribution must not keep draining the parent into an archived account;
 * 2. the pocket is brought to exactly zero;
 * 3. the caller archives it. An archived pocket always has a zero balance, so archiving never
 *    hides money from the totals.
 */
export function planCloseGoal(input: {
  pocket: Account;
  transactions: readonly Transaction[];
  recurrences: readonly Recurrence[];
  today: LocalDate;
}): CloseGoalPlan {
  const { pocket, transactions, recurrences, today } = input;
  const parentId = pocket.parentAccountId;
  if (pocket.type !== 'pocket' || pocket.archivedAt !== null || parentId == null) {
    throw new Error(`No open goal ${pocket.id}`);
  }
  const touches = (row: { accountId: string; toAccountId: string | null }) =>
    row.accountId === pocket.id || row.toAccountId === pocket.id;

  const tombstones = new Set<string>();
  const recurrenceEdits: CloseGoalPlan['recurrenceEdits'] = [];
  for (const recurrence of recurrences) {
    if (!touches(recurrence.template)) continue;
    const occurrences = transactions
      .filter((row) => row.recurrenceId === recurrence.id)
      .map((row) => ({ id: row.id, date: row.date }));
    const plan = planStopRecurrence(recurrence, occurrences, today);
    for (const id of plan.tombstoneOccurrenceIds) tombstones.add(id);
    if (plan.deleteRecurrence)
      recurrenceEdits.push({ id: recurrence.id, endDate: null, delete: true });
    else if (plan.endDate !== null) {
      recurrenceEdits.push({ id: recurrence.id, endDate: plan.endDate, delete: false });
    }
  }
  for (const row of transactions) {
    if (row.date > today && touches(row)) tombstones.add(row.id);
  }

  const remaining = transactions.filter((row) => !tombstones.has(row.id));
  const balance = accountBalances([pocket], remaining, today).get(pocket.id) ?? 0;
  const settlement: TransactionFields | null =
    balance === 0
      ? null
      : {
          kind: 'transfer',
          amount: Math.abs(balance),
          date: today,
          accountId: balance > 0 ? pocket.id : parentId,
          toAccountId: balance > 0 ? parentId : pocket.id,
          categoryId: null,
          description: pocket.name,
          note: null,
          tagIds: [],
          excludeFromTotals: false,
          recurrenceId: null,
        };
  return { recurrenceEdits, tombstoneTransactionIds: [...tombstones], settlement };
}

/** A goal whose parent is archived stays closed: it would be invisible in Conti and still counted in Patrimonio. */
export function canRestoreGoal(
  pocket: Pick<Account, 'type' | 'parentAccountId'>,
  accounts: readonly Pick<Account, 'id' | 'archivedAt'>[],
): boolean {
  if (pocket.type !== 'pocket' || pocket.parentAccountId == null) return false;
  const parent = accounts.find((account) => account.id === pocket.parentAccountId);
  return parent !== undefined && parent.archivedAt === null;
}

/** Reopens a closed goal, empty (§5.14): its pace starts again today, a deadline that has passed is dropped. */
export function restoreGoalFields(
  pocket: Pick<Account, 'goalDeadline'>,
  today: LocalDate,
): { archivedAt: null; goalStartDate: LocalDate; goalDeadline: LocalDate | null } {
  return {
    archivedAt: null,
    goalStartDate: today,
    goalDeadline:
      pocket.goalDeadline != null && pocket.goalDeadline > today ? pocket.goalDeadline : null,
  };
}
