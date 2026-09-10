import type { Category, Tag } from '@saldo/core';
import { eq } from 'drizzle-orm';
import type { Repositories } from './repositories';
import type { RepositoryDatabase } from './repositories/support';
import { transactions } from './schema';

/**
 * Category and tag maintenance (§5.10, §5.11). Each operation rewrites several tables, so it runs
 * inside one transaction: a half-applied merge would leave transactions pointing at a tombstoned
 * row.
 */

export interface ArchiveCategoryInput {
  categoryId: string;
  /** Optional target for the affected transactions and budgets (§5.11). */
  moveToCategoryId?: string | null;
  nowIso: string;
}

/**
 * Archives a category, optionally moving its transactions first (§5.11). Categories are never
 * deleted: a transaction without a category could not satisfy `transactionSchema`.
 *
 * Moving rewrites `categoryId` on the affected transactions **and** the `categoryIds` of every
 * budget, so a budget does not silently start measuring nothing.
 */
export function archiveCategory(
  db: RepositoryDatabase,
  repos: Repositories,
  input: ArchiveCategoryInput,
): void {
  const { categoryId, moveToCategoryId, nowIso } = input;
  db.transaction(() => {
    if (moveToCategoryId !== undefined && moveToCategoryId !== null) {
      const affected = db
        .select({ id: transactions.id })
        .from(transactions)
        .where(eq(transactions.categoryId, categoryId))
        .all();
      for (const row of affected) {
        repos.transactions.update(row.id, { categoryId: moveToCategoryId });
      }
      for (const budget of repos.budgets.list()) {
        if (!budget.categoryIds.includes(categoryId)) continue;
        const next = [
          ...new Set(budget.categoryIds.map((id) => (id === categoryId ? moveToCategoryId : id))),
        ];
        repos.budgets.update(budget.id, { categoryIds: next });
      }
    }
    // Children follow their parent, otherwise they would dangle under an archived category.
    for (const child of repos.categories.list()) {
      if (child.parentId === categoryId) repos.categories.update(child.id, { archivedAt: nowIso });
    }
    repos.categories.update(categoryId, { archivedAt: nowIso });
  });
}

export function restoreCategory(repos: Repositories, categoryId: string): Category {
  return repos.categories.update(categoryId, { archivedAt: null });
}

/** How many live transactions use a category, for the archive sheet's copy (§5.11). */
export function categoryUsage(db: RepositoryDatabase, categoryId: string): number {
  return db
    .select({ id: transactions.id })
    .from(transactions)
    .where(eq(transactions.categoryId, categoryId))
    .all().length;
}

/**
 * Merges `sourceId` into `targetId` (§5.10): every transaction carrying the source gets the target
 * instead, de-duplicated, and the source is tombstoned.
 */
export function mergeTags(
  db: RepositoryDatabase,
  repos: Repositories,
  sourceId: string,
  targetId: string,
): void {
  if (sourceId === targetId) return;
  db.transaction(() => {
    for (const tx of repos.transactions.list()) {
      if (!tx.tagIds.includes(sourceId)) continue;
      const next = [...new Set(tx.tagIds.map((id) => (id === sourceId ? targetId : id)))];
      repos.transactions.update(tx.id, { tagIds: next });
    }
    repos.tags.remove(sourceId);
  });
}

/** Deletes a tag (§5.10): the id leaves every transaction, then the tag is tombstoned. */
export function deleteTag(db: RepositoryDatabase, repos: Repositories, tagId: string): void {
  db.transaction(() => {
    for (const tx of repos.transactions.list()) {
      if (!tx.tagIds.includes(tagId)) continue;
      repos.transactions.update(tx.id, { tagIds: tx.tagIds.filter((id) => id !== tagId) });
    }
    repos.tags.remove(tagId);
  });
}

export function renameTag(repos: Repositories, tagId: string, name: string): Tag {
  return repos.tags.rename(tagId, name);
}

/** Usage counts per tag id, for the admin list and the filter sheet ordering (§5.10). */
export function tagUsage(repos: Repositories): Map<string, number> {
  const usage = new Map<string, number>();
  for (const tx of repos.transactions.list()) {
    for (const id of tx.tagIds) usage.set(id, (usage.get(id) ?? 0) + 1);
  }
  return usage;
}

/** Archives an account; its transactions stay, as they still describe money that moved. */
export function archiveAccount(repos: Repositories, accountId: string, nowIso: string): void {
  repos.accounts.update(accountId, { archivedAt: nowIso });
}

export function restoreAccount(repos: Repositories, accountId: string): void {
  repos.accounts.update(accountId, { archivedAt: null });
}

/** Reorders siblings within one group (§5.11): only `sortOrder` changes. */
export function reorderCategories(
  db: RepositoryDatabase,
  repos: Repositories,
  orderedIds: readonly string[],
): void {
  db.transaction(() => {
    orderedIds.forEach((id, index) => {
      repos.categories.update(id, { sortOrder: index });
    });
  });
}
