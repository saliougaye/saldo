import type { LocalDate } from '@saldo/core';
import {
  materializeOccurrences,
  nextOccurrence,
  occurrenceId,
  type PeriodDef,
  planRecurrenceEdit,
  planStopRecurrence,
  type Recurrence,
  type RecurrenceEditScope,
  type RecurrenceRule,
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
  def: PeriodDef,
): number {
  const horizonEnd = recurrenceHorizonEnd(def, today);
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
  def: PeriodDef;
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
  const { recurrence, occurrence, values, date, today, def } = input;
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
        // The new series keeps the cadence and the end of the one it continues.
        frequency: recurrence.frequency,
        interval: recurrence.interval,
        startDate: plan.startNewRecurrenceOn,
        endDate: recurrence.endDate,
        template: values,
      });
      // Materialise the new series immediately so the list does not show a gap.
      const horizonEnd = recurrenceHorizonEnd(def, today);
      for (const created2 of materializeOccurrences(created, new Set(), horizonEnd)) {
        repos.transactions.create(created2);
      }
    }
  });
}

export interface StartedRecurrence {
  recurrence: Recurrence;
  /** The row that replaced the saved transaction: the callers navigate to it (§5.9). */
  occurrence: Transaction;
}

/** Creates a recurrence from a transaction the user set "Ripeti" on (§5.9). */
export function startRecurrence(
  db: RepositoryDatabase,
  repos: Repositories,
  transaction: Transaction,
  rule: RecurrenceRule,
  today: LocalDate,
  def: PeriodDef,
): StartedRecurrence {
  return db.transaction(() => {
    const recurrence = repos.recurrences.create({
      frequency: rule.frequency,
      interval: rule.interval,
      startDate: transaction.date,
      endDate: rule.endDate,
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
    const occurrence = repos.transactions.create({
      ...transaction,
      id: occurrenceId(recurrence.id, transaction.date),
      recurrenceId: recurrence.id,
    });
    // The receipts belong to the row, not to its id: they follow it onto the occurrence (§10).
    repos.attachments.moveTo(transaction.id, occurrence.id);
    runMaterialiser(db, repos, today, def);
    return { recurrence, occurrence };
  });
}

function occurrencesOf(
  repos: Repositories,
  recurrenceId: string,
): { id: string; date: LocalDate }[] {
  return repos.transactions
    .list()
    .filter((tx) => tx.recurrenceId === recurrenceId)
    .map((tx) => ({ id: tx.id, date: tx.date }));
}

/** "Smetti di ripetere" (§5.9): applies `planStopRecurrence` in one transaction. */
export function stopRecurrence(
  db: RepositoryDatabase,
  repos: Repositories,
  recurrence: Recurrence,
  today: LocalDate,
): void {
  const plan = planStopRecurrence(recurrence, occurrencesOf(repos, recurrence.id), today);
  db.transaction(() => {
    for (const id of plan.tombstoneOccurrenceIds) repos.transactions.remove(id);
    if (plan.deleteRecurrence) repos.recurrences.remove(recurrence.id);
    else if (plan.endDate !== null) {
      repos.recurrences.update(recurrence.id, { endDate: plan.endDate });
    }
  });
}

/**
 * A new rule for an existing recurrence (§6.34). Same cadence: only `endDate` moves, and the rows
 * past the new end go. New cadence: the old series ends today and a new one, same template, starts
 * on the first date the new rule fires after today, anchored on the old `startDate` so the day of
 * month or the weekday is the one the user already knows. Returns the recurrence that carries on,
 * or null when the new rule has already ended.
 */
export function changeRecurrenceRule(
  db: RepositoryDatabase,
  repos: Repositories,
  recurrence: Recurrence,
  rule: RecurrenceRule,
  today: LocalDate,
  def: PeriodDef,
): Recurrence | null {
  const occurrences = occurrencesOf(repos, recurrence.id);
  const sameCadence =
    rule.frequency === recurrence.frequency && rule.interval === recurrence.interval;

  return db.transaction(() => {
    if (sameCadence) {
      for (const row of occurrences) {
        if (row.date > today && rule.endDate !== null && row.date > rule.endDate) {
          repos.transactions.remove(row.id);
        }
      }
      const updated = repos.recurrences.update(recurrence.id, { endDate: rule.endDate });
      runMaterialiser(db, repos, today, def);
      return updated;
    }

    for (const row of occurrences) if (row.date > today) repos.transactions.remove(row.id);
    const hasPast = occurrences.some((row) => row.date <= today);
    if (hasPast) repos.recurrences.update(recurrence.id, { endDate: today });
    else repos.recurrences.remove(recurrence.id);

    const startDate = nextOccurrence({ ...rule, startDate: recurrence.startDate }, today);
    if (startDate === null) return null;
    const created = repos.recurrences.create({
      frequency: rule.frequency,
      interval: rule.interval,
      startDate,
      endDate: rule.endDate,
      template: recurrence.template,
    });
    runMaterialiser(db, repos, today, def);
    return created;
  });
}
