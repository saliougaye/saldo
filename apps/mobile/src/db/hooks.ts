import type { Account, Budget, Category, LocalDate, Settings, Tag, Transaction } from '@saldo/core';
import { SETTINGS_ID } from '@saldo/core';
import { and, asc, desc, eq, gte, isNull, lte } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { db } from './client';
import type { LocalAttachment } from './repositories/attachments';
import { toEntity } from './repositories/support';
import { accounts, attachments, budgets, categories, settings, tags, transactions } from './schema';

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

export function useAccounts(): Account[] {
  const { data } = useLiveQuery(
    db
      .select()
      .from(accounts)
      .where(isNull(accounts.deletedAt))
      .orderBy(asc(accounts.sortOrder), asc(accounts.name)),
  );
  return data.map(toEntity);
}

export function useCategories(): Category[] {
  const { data } = useLiveQuery(
    db
      .select()
      .from(categories)
      .where(isNull(categories.deletedAt))
      .orderBy(asc(categories.sortOrder), asc(categories.name)),
  );
  return data.map(toEntity);
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

export function useTags(): Tag[] {
  const { data } = useLiveQuery(
    db.select().from(tags).where(isNull(tags.deletedAt)).orderBy(asc(tags.name)),
  );
  return data.map(toEntity);
}

export function useBudgets(): Budget[] {
  const { data } = useLiveQuery(
    db
      .select()
      .from(budgets)
      .where(isNull(budgets.deletedAt))
      .orderBy(asc(budgets.sortOrder), asc(budgets.name)),
  );
  return data.map(toEntity);
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

export function useTransactionsInRange(start: LocalDate, end: LocalDate): Transaction[] {
  return useTransactionsInRangeQuery(start, end).rows;
}
