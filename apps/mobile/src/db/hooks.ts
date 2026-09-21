import type {
  Account,
  Budget,
  Category,
  LocalDate,
  Recurrence,
  Settings,
  Tag,
  Transaction,
} from '@saldo/core';
import { SETTINGS_ID } from '@saldo/core';
import { and, asc, count, desc, eq, gte, isNull, lte } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { db } from './client';
import type { LocalAttachment } from './repositories/attachments';
import { toEntity } from './repositories/support';
import {
  accounts,
  attachments,
  budgets,
  categories,
  recurrences,
  settings,
  tags,
  transactions,
} from './schema';

/**
 * Live reads (§3.3). `useLiveQuery` re-runs whenever `expo-sqlite` reports a change, which is why
 * `enableChangeListener` is on: after a repository write the screen updates with no invalidation.
 * Screens then run `@saldo/core` over these rows inside `useMemo` (§3.2).
 */
export interface SettingsQuery {
  settings: Settings | null;
  /**
   * False until the first query result arrives. `useLiveQuery` starts with an empty array, so a
   * screen that cannot tell "not loaded yet" from "no row" would route as if onboarding had never
   * run — and a `<Redirect>` does not undo itself once taken.
   */
  loaded: boolean;
}

export function useSettingsQuery(): SettingsQuery {
  const { data, updatedAt } = useLiveQuery(
    db.select().from(settings).where(eq(settings.id, SETTINGS_ID)),
  );
  const row = data[0];
  return { settings: row === undefined ? null : toEntity(row), loaded: updatedAt !== undefined };
}

export function useSettings(): Settings | null {
  return useSettingsQuery().settings;
}

export interface AccountsQuery {
  accounts: Account[];
  /**
   * False until the first query result arrives. Same trap as `SettingsQuery.loaded`: a screen that
   * reads an empty list as "no such account" answers before the query has run, and a form seeded
   * from that answer never un-seeds itself.
   */
  loaded: boolean;
}

export function useAccountsQuery(): AccountsQuery {
  const { data, updatedAt } = useLiveQuery(
    db
      .select()
      .from(accounts)
      .where(isNull(accounts.deletedAt))
      .orderBy(asc(accounts.sortOrder), asc(accounts.name)),
  );
  return { accounts: data.map(toEntity), loaded: updatedAt !== undefined };
}

export function useAccounts(): Account[] {
  return useAccountsQuery().accounts;
}

/**
 * A live list plus whether its first answer has arrived. `useLiveQuery` starts with `[]`, so a
 * screen that reads "no rows" before then shows an empty state — or "this was deleted" — for
 * something that exists. Same query, same cost: only `updatedAt` is read as well.
 */
export interface LiveRows<T> {
  rows: T[];
  loaded: boolean;
}

export function useCategoriesQuery(): LiveRows<Category> {
  const { data, updatedAt } = useLiveQuery(
    db
      .select()
      .from(categories)
      .where(isNull(categories.deletedAt))
      .orderBy(asc(categories.sortOrder), asc(categories.name)),
  );
  return { rows: data.map(toEntity), loaded: updatedAt !== undefined };
}

export function useCategories(): Category[] {
  return useCategoriesQuery().rows;
}

/**
 * How many live transactions point at each category, over the whole history (§5.11).
 *
 * Counted in SQL rather than by loading every transaction ever written into JavaScript, and
 * deliberately unbounded in time: a category used only by a scheduled transaction is in use, and a
 * list that said "0 entries" next to an archive sheet saying "1 transaction uses this category"
 * was two answers to one question. Fold the children in with `rollUpCategoryUsage`.
 */
export function useCategoryUsage(): Map<string, number> {
  const { data } = useLiveQuery(
    db
      .select({ categoryId: transactions.categoryId, uses: count() })
      .from(transactions)
      .where(isNull(transactions.deletedAt))
      .groupBy(transactions.categoryId),
  );
  const counts = new Map<string, number>();
  for (const row of data) {
    if (row.categoryId === null) continue;
    counts.set(row.categoryId, row.uses);
  }
  return counts;
}

/** The live attachments of one transaction, oldest first (§10). */
export function useAttachments(transactionId: string): LocalAttachment[] {
  const { data } = useLiveQuery(
    db
      .select()
      .from(attachments)
      .where(and(eq(attachments.transactionId, transactionId), isNull(attachments.deletedAt)))
      .orderBy(asc(attachments.createdAt)),
    [transactionId],
  );
  return data.map(({ localUri, blobState, ...rest }) => ({
    ...toEntity(rest),
    localUri,
    blobState,
  }));
}

/** One attachment, live: the viewer follows its local file appearing or going away. */
export function useAttachment(id: string): LocalAttachment | null {
  const { data } = useLiveQuery(db.select().from(attachments).where(eq(attachments.id, id)), [id]);
  const row = data[0];
  if (row === undefined || row.deletedAt !== null) return null;
  const { localUri, blobState, ...rest } = row;
  return { ...toEntity(rest), localUri, blobState };
}

export function useTagsQuery(): LiveRows<Tag> {
  const { data, updatedAt } = useLiveQuery(
    db.select().from(tags).where(isNull(tags.deletedAt)).orderBy(asc(tags.name)),
  );
  return { rows: data.map(toEntity), loaded: updatedAt !== undefined };
}

export function useTags(): Tag[] {
  return useTagsQuery().rows;
}

export function useBudgetsQuery(): LiveRows<Budget> {
  const { data, updatedAt } = useLiveQuery(
    db
      .select()
      .from(budgets)
      .where(isNull(budgets.deletedAt))
      .orderBy(asc(budgets.sortOrder), asc(budgets.name)),
  );
  return { rows: data.map(toEntity), loaded: updatedAt !== undefined };
}

export function useBudgets(): Budget[] {
  return useBudgetsQuery().rows;
}

export interface TransactionsQuery {
  rows: Transaction[];
  /** False until the first result arrives, so a list can tell "still loading" from "empty". */
  loaded: boolean;
}

/** Only the range a screen needs (§7): the selected cycle, plus earlier cycles for baselines. */
export function useTransactionsInRangeQuery(start: LocalDate, end: LocalDate): TransactionsQuery {
  const { data, updatedAt } = useLiveQuery(
    db
      .select()
      .from(transactions)
      .where(
        and(
          isNull(transactions.deletedAt),
          gte(transactions.date, start),
          lte(transactions.date, end),
        ),
      )
      .orderBy(desc(transactions.date), asc(transactions.createdAt)),
    [start, end],
  );
  return { rows: data.map(toEntity), loaded: updatedAt !== undefined };
}

/**
 * One transaction, live. The detail screen used a plain repository read, so a row edited by a sync
 * while the screen was open kept showing what it said when it opened (§3.3).
 */
export function useTransactionQuery(id: string): {
  transaction: Transaction | null;
  loaded: boolean;
} {
  const { data, updatedAt } = useLiveQuery(
    db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, id), isNull(transactions.deletedAt))),
    [id],
  );
  const row = data[0];
  return {
    transaction: row === undefined ? null : toEntity(row),
    loaded: updatedAt !== undefined,
  };
}

export function useTransaction(id: string): Transaction | null {
  return useTransactionQuery(id).transaction;
}

export function useTransactionsInRange(start: LocalDate, end: LocalDate): Transaction[] {
  return useTransactionsInRangeQuery(start, end).rows;
}

export function useRecurrencesQuery(): LiveRows<Recurrence> {
  const { data, updatedAt } = useLiveQuery(
    db
      .select()
      .from(recurrences)
      .where(isNull(recurrences.deletedAt))
      .orderBy(asc(recurrences.startDate)),
  );
  return { rows: data.map(toEntity), loaded: updatedAt !== undefined };
}

export function useRecurrences(): Recurrence[] {
  return useRecurrencesQuery().rows;
}

export function useRecurrenceQuery(id: string): {
  recurrence: Recurrence | null;
  loaded: boolean;
} {
  const { data, updatedAt } = useLiveQuery(
    db
      .select()
      .from(recurrences)
      .where(and(eq(recurrences.id, id), isNull(recurrences.deletedAt))),
    [id],
  );
  const row = data[0];
  return {
    recurrence: row === undefined ? null : toEntity(row),
    loaded: updatedAt !== undefined,
  };
}

export function useRecurrence(id: string): Recurrence | null {
  return useRecurrenceQuery(id).recurrence;
}

/** Every live occurrence of one recurrence, newest first (§6.34). */
export function useOccurrences(recurrenceId: string): Transaction[] {
  const { data } = useLiveQuery(
    db
      .select()
      .from(transactions)
      .where(and(eq(transactions.recurrenceId, recurrenceId), isNull(transactions.deletedAt)))
      .orderBy(desc(transactions.date)),
    [recurrenceId],
  );
  return data.map(toEntity);
}
