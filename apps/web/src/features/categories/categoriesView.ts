import {
  type Category,
  childCategories,
  rollUpCategoryUsage,
  topLevelCategories,
  type UserData,
} from '@saldo/core';

export interface CategoryRowView {
  id: string;
  name: string;
  icon: string;
  colorIndex: number;
  /** Transactions that use it, its children's folded in (§5.4). */
  uses: number;
  /** 0 for a top-level row, 1 for a child (indented). */
  depth: 0 | 1;
  /** The up/down buttons are disabled at either end of the sibling group (§5.11). */
  canMoveUp: boolean;
  canMoveDown: boolean;
}

export interface CategorySectionView {
  direction: Category['direction'];
  rows: CategoryRowView[];
}

export interface ArchivedCategoryRow {
  id: string;
  name: string;
  icon: string;
  colorIndex: number;
  /** The parent's name, when it has one. */
  parentName: string | null;
  /** A child whose parent is still archived stays refused by the server (`parentInvalid`). */
  parentArchived: boolean;
}

export interface CategoriesView {
  sections: CategorySectionView[];
  archived: ArchivedCategoryRow[];
  /**
   * The transactions that use each category, its children's folded in: the count of a row, and
   * also of a live child whose parent is archived, which has no row but has an edit form.
   */
  usage: ReadonlyMap<string, number>;
}

/**
 * Profilo → Categorie (§5.11): Uscite then Entrate, each top-level category followed by its
 * children, with the usage the phone's list shows (`rollUpCategoryUsage` over live transactions).
 */
export function categoriesView(data: UserData): CategoriesView {
  const direct = new Map<string, number>();
  for (const row of data.transactions) {
    if (row.deletedAt !== null || row.categoryId === null) continue;
    direct.set(row.categoryId, (direct.get(row.categoryId) ?? 0) + 1);
  }
  const usage = rollUpCategoryUsage(data.categories, direct);

  const rowFor = (
    category: Category,
    depth: 0 | 1,
    index: number,
    count: number,
  ): CategoryRowView => ({
    id: category.id,
    name: category.name,
    icon: category.icon,
    colorIndex: category.colorIndex,
    uses: usage.get(category.id) ?? 0,
    depth,
    canMoveUp: index > 0,
    canMoveDown: index < count - 1,
  });

  const sections = (['expense', 'income'] as const).map((direction): CategorySectionView => {
    const parents = topLevelCategories(data.categories, direction);
    return {
      direction,
      rows: parents.flatMap((parent, index) => {
        const children = childCategories(data.categories, parent.id);
        return [
          rowFor(parent, 0, index, parents.length),
          ...children.map((child, i) => rowFor(child, 1, i, children.length)),
        ];
      }),
    };
  });

  const archived = data.categories
    .filter((category) => category.archivedAt !== null)
    .sort((a, b) => (b.archivedAt ?? '').localeCompare(a.archivedAt ?? ''))
    .map((category): ArchivedCategoryRow => {
      const parent =
        category.parentId === null
          ? undefined
          : data.categories.find((row) => row.id === category.parentId);
      return {
        id: category.id,
        name: category.name,
        icon: category.icon,
        colorIndex: category.colorIndex,
        parentName: parent?.name ?? null,
        parentArchived: parent !== undefined && parent.archivedAt !== null,
      };
    });

  return { sections, archived, usage };
}
