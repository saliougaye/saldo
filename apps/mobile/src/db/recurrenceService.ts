import type { LocalDate } from '@saldo/core';
import {
  materializeOccurrences,
  occurrenceId,
  planRecurrenceEdit,
  type Recurrence,
  type RecurrenceEditScope,
  recurrenceHorizonEnd,
  type Transaction,
} from '@saldo/core';
import { eq } from 'drizzle-orm';
import type { Repositories } from './repositories';
import type { RepositoryDatabase } from './repositories/support';
import { transactions } from './schema';

/**
 * Ids of every occurrence row of a recurrence, **including tombstones** — the materialiser needs
 * them so a deleted occurrence is not recreated (§5.9).
 */
function existingOccurrenceIds(db: RepositoryDatabase, recurrenceId: string): Set<string> {
  return new Set(
    db
      .select({ id: transactions.id })
      .from(transactions)
      .where(eq(transactions.recurrenceId, recurrenceId))
      .all()
      .map((row) => row.id),
  );
}

/**
 * Runs the materialiser for every live recurrence (§5.9): on app start, on foreground, after a
 * sync pull and after any recurrence write. Returns how many occurrences it created.
 */
export function runMaterialiser(
  db: RepositoryDatabase,
  repos: Repositories,
  today: LocalDate,
  cycleStartDay: number,
): number {
  const horizonEnd = recurrenceHorizonEnd(today, cycleStartDay);
  let created = 0;
  for (const recurrence of repos.recurrences.list()) {
    const existing = existingOccurrenceIds(db, recurrence.id);
    for (const occurrence of materializeOccurrences(recurrence, existing, horizonEnd)) {
      repos.transactions.create(occurrence);
      created += 1;
    }
  }
  return created;
}

/** Fields the sheet can change on an occurrence or a template. */
export type RecurrenceEditValues = Pick<
  Transaction,
  | 'kind'
  | 'amount'
  | 'accountId'
  | 'toAccountId'
  | 'categoryId'
  | 'description'
  | 'tagIds'
  | 'excludeFromTotals'
>;

export interface ApplyRecurrenceEditInput {
  recurrence: Recurrence;
  occurrence: Transaction;
  values: RecurrenceEditValues;
  /** Only "only this" can move a single occurrence to another date. */
  date: LocalDate;
  today: LocalDate;
  cycleStartDay: number;
}

/**
 * Applies the plan of §5.9 for the scope the user picked. Every branch touches several rows, so it
 * runs inside one transaction (§7): a half-applied scope edit would leave duplicate occurrences.
 */
export function applyRecurrenceEdit(
  db: RepositoryDatabase,
  repos: Repositories,
  scope: RecurrenceEditScope,
  input: ApplyRecurrenceEditInput,
): void {
  const { recurrence, occurrence, values, date, today, cycleStartDay } = input;
  const occurrences = repos.transactions
    .list()
    .filter((tx) => tx.recurrenceId === recurrence.id)
    .map((tx) => ({ id: tx.id, date: tx.date }));

  const plan = planRecurrenceEdit(scope, {
    recurrence,
    occurrenceDate: occurrence.date,
    occurrences,
    today,
  });

  db.transaction(() => {
    for (const id of plan.updateOccurrenceIds) {
      const existing = repos.transactions.byId(id);
      if (existing === null) continue;
      repos.transactions.update(id, {
        ...values,
        // "Only this" may move the row; "all" keeps each occurrence on its own date (§5.9).
        date: plan.scope === 'only-this' ? date : existing.date,
      });
    }
    for (const id of plan.tombstoneOccurrenceIds) repos.transactions.remove(id);

    if (plan.updateTemplate) {
      repos.recurrences.update(recurrence.id, { template: values });
    }
    if (plan.endCurrentRecurrenceOn !== null) {
      repos.recurrences.update(recurrence.id, { endDate: plan.endCurrentRecurrenceOn });
    }
    if (plan.startNewRecurrenceOn !== null) {
      const created = repos.recurrences.create({
        frequency: 'monthly',
        startDate: plan.startNewRecurrenceOn,
        endDate: null,
        template: values,
      });
      // Materialise the new series immediately so the list does not show a gap.
      const horizonEnd = recurrenceHorizonEnd(today, cycleStartDay);
      for (const created2 of materializeOccurrences(created, new Set(), horizonEnd)) {
        repos.transactions.create(created2);
      }
    }
  });
}

/** Creates a recurrence from a transaction the user toggled "Ripeti" on (§5.9). */
export function startRecurrence(
  db: RepositoryDatabase,
  repos: Repositories,
  transaction: Transaction,
  today: LocalDate,
  cycleStartDay: number,
): Recurrence {
  return db.transaction(() =>
    startRecurrenceInTransaction(db, repos, transaction, today, cycleStartDay),
  );
}

function startRecurrenceInTransaction(
  db: RepositoryDatabase,
  repos: Repositories,
  transaction: Transaction,
  today: LocalDate,
  cycleStartDay: number,
): Recurrence {
  const recurrence = repos.recurrences.create({
    frequency: 'monthly',
    startDate: transaction.date,
    endDate: null,
    template: {
      kind: transaction.kind,
      amount: transaction.amount,
      accountId: transaction.accountId,
      toAccountId: transaction.toAccountId,
      categoryId: transaction.categoryId,
      description: transaction.description,
      tagIds: transaction.tagIds,
      excludeFromTotals: transaction.excludeFromTotals,
    },
  });
  // The transaction the user just saved becomes the first occurrence, keeping its own id out of
  // the way: the deterministic id is what other devices will converge on (D21).
  repos.transactions.remove(transaction.id);
  const firstId = occurrenceId(recurrence.id, transaction.date);
  repos.transactions.create({
    ...transaction,
    id: firstId,
    recurrenceId: recurrence.id,
  });
  runMaterialiser(db, repos, today, cycleStartDay);
  return recurrence;
}
