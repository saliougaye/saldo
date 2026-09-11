import type { Category } from './entities';

/**
 * Reading and reordering the category tree (§5.11).
 *
 * The tree is two levels deep and every screen that draws it needs the same three answers: which
 * parents belong to a direction, which children hang off a parent, and how many transactions each
 * row stands for. They live here so the admin list, the picker sheet and the category detail agree
 * — they used to each filter and sort the array themselves, with different indentation, different
 * ordering and two different counts.
 */

const byDisplayOrder = (a: Category, b: Category): number =>
  a.sortOrder === b.sortOrder ? a.name.localeCompare(b.name) : a.sortOrder - b.sortOrder;

/** Live top-level categories of one direction, in display order. */
export function topLevelCategories(
  categories: readonly Category[],
  direction: Category['direction'],
): Category[] {
  return categories
    .filter(
      (category) =>
        category.direction === direction &&
        category.parentId === null &&
        category.archivedAt === null,
    )
    .sort(byDisplayOrder);
}

/** Live children of one parent, in display order. */
export function childCategories(categories: readonly Category[], parentId: string): Category[] {
  return categories
    .filter((category) => category.parentId === parentId && category.archivedAt === null)
    .sort(byDisplayOrder);
}

/**
 * Usage counts with every child folded into its parent (§5.4).
 *
 * A parent id stands for itself and its children everywhere else in the app — budgets, the category
 * detail, the statistics split — so the admin list must not show "0 entries" on a parent whose
 * children carry all the spending. Children keep their own direct count.
 *
 * Archived children still count: archiving a category does not delete the transactions that point
 * at it, and the parent is what the user would have to open to find them.
 */
export function rollUpCategoryUsage(
  categories: readonly Category[],
  direct: ReadonlyMap<string, number>,
): Map<string, number> {
  const rolled = new Map<string, number>();
  for (const category of categories) {
    rolled.set(category.id, direct.get(category.id) ?? 0);
  }
  for (const category of categories) {
    if (category.parentId === null) continue;
    const own = direct.get(category.id) ?? 0;
    if (own === 0) continue;
    rolled.set(category.parentId, (rolled.get(category.parentId) ?? 0) + own);
  }
  return rolled;
}

/**
 * The `sortOrder` writes that move one row a single place inside its sibling group (§5.11).
 *
 * `siblings` arrives in the order it is displayed; the move is refused at either end and for an id
 * that is not in the group, both of which return no writes at all. The whole group is renumbered
 * rather than two values swapped, because seeds and CSV imports write `sortOrder` from their own
 * counters and duplicates do reach this list — swapping two equal numbers would look like nothing
 * happened.
 */
export function reorderSiblings(
  siblings: readonly Category[],
  id: string,
  direction: -1 | 1,
): { id: string; sortOrder: number }[] {
  const from = siblings.findIndex((category) => category.id === id);
  if (from === -1) return [];
  const to = from + direction;
  if (to < 0 || to >= siblings.length) return [];
  const next = [...siblings];
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return [];
  next.splice(to, 0, moved);
  return next.map((category, index) => ({ id: category.id, sortOrder: index }));
}
