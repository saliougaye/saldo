import type { Account, Category, LocalDate, Settings, Tag, Transaction } from '@saldo/core';
import { SETTINGS_ID } from '@saldo/core';
import { and, asc, desc, eq, gte, isNull, lte } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { db } from './client';
import { toEntity } from './repositories/support';
import { accounts, categories, settings, tags, transactions } from './schema';

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

export function useTags(): Tag[] {
  const { data } = useLiveQuery(
    db.select().from(tags).where(isNull(tags.deletedAt)).orderBy(asc(tags.name)),
  );
  return data.map(toEntity);
}

/** Only the range a screen needs (§7): the selected cycle, plus earlier cycles for baselines. */
export function useTransactionsInRange(start: LocalDate, end: LocalDate): Transaction[] {
  const { data } = useLiveQuery(
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
  return data.map(toEntity);
}
