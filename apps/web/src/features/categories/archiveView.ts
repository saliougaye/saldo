import { type Category, movableTargets, rollUpCategoryUsage, type UserData } from '@saldo/core';

export interface ArchiveCategoryView {
  id: string;
  name: string;
  /** The category's version as loaded: archiving a category a phone changed since is a `conflict`. */
  updatedAt: string;
  /** The count the list shows for it, children folded in — the phone's sheet reads the same. */
  uses: number;
}

export interface ArchiveTarget {
  id: string;
  name: string;
  icon: string;
  colorIndex: number;
}

/** What the archive dialog asks about a live category; null for any other id. */
export function archiveCategoryView(data: UserData, id: string): ArchiveCategoryView | null {
  const category = data.categories.find((row) => row.id === id && row.archivedAt === null);
  if (category === undefined) return null;
  const direct = new Map<string, number>();
  for (const row of data.transactions) {
    if (row.deletedAt !== null || row.categoryId === null) continue;
    direct.set(row.categoryId, (direct.get(row.categoryId) ?? 0) + 1);
  }
  return {
    id: category.id,
    name: category.name,
    updatedAt: category.updatedAt,
    uses: rollUpCategoryUsage(data.categories, direct).get(category.id) ?? 0,
  };
}

/**
 * Where the transactions of category `id` can move (§5.11): live, same direction, not itself nor
 * its children. The archive dialog calls it on the page's categories (`sharedProps`).
 */
export function archiveTargets(categories: readonly Category[], id: string): ArchiveTarget[] {
  const category = categories.find((row) => row.id === id);
  if (category === undefined) return [];
  return movableTargets(categories, category).map((row) => ({
    id: row.id,
    name: row.name,
    icon: row.icon,
    colorIndex: row.colorIndex,
  }));
}
