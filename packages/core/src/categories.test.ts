import { describe, expect, it } from 'vitest';
import { reorderSiblings, rollUpCategoryUsage } from './categories';
import type { Category } from './entities';

const category = (patch: Partial<Category> & { id: string }): Category => ({
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  name: patch.id,
  direction: 'expense',
  parentId: null,
  icon: 'cart',
  colorIndex: 0,
  archivedAt: null,
  sortOrder: 0,
  ...patch,
});

const CATEGORIES: Category[] = [
  category({ id: 'food', sortOrder: 1 }),
  category({ id: 'market', parentId: 'food', sortOrder: 1 }),
  category({ id: 'bakery', parentId: 'food', sortOrder: 0 }),
  category({ id: 'home', sortOrder: 0 }),
  category({ id: 'rent', parentId: 'home', sortOrder: 0 }),
  category({ id: 'gone', sortOrder: 2, archivedAt: '2026-02-01T00:00:00.000Z' }),
  category({ id: 'salary', direction: 'income', sortOrder: 0 }),
];

describe('rollUpCategoryUsage', () => {
  // §5.4: a parent id stands for itself and its children, so the admin list cannot show a parent
  // with "0 entries" above children that have some.
  it('adds every child count to its parent', () => {
    const direct = new Map([
      ['food', 3],
      ['market', 4],
      ['bakery', 2],
    ]);
    const rolled = rollUpCategoryUsage(CATEGORIES, direct);
    expect(rolled.get('food')).toBe(9);
  });

  it('counts an archived child towards its parent, since its transactions still exist', () => {
    const withArchivedChild = [
      ...CATEGORIES,
      category({ id: 'old', parentId: 'food', archivedAt: '2026-02-01T00:00:00.000Z' }),
    ];
    const rolled = rollUpCategoryUsage(withArchivedChild, new Map([['old', 5]]));
    expect(rolled.get('food')).toBe(5);
  });
});

describe('reorderSiblings', () => {
  // Seeds and imports both write sortOrder from their own counter, so duplicates reach this list.
  // Renumbering the whole group makes the move stick instead of swapping two equal values.
  it('renumbers a group whose sortOrder values collide', () => {
    const tied = [
      category({ id: 'a', sortOrder: 0 }),
      category({ id: 'b', sortOrder: 0 }),
      category({ id: 'c', sortOrder: 0 }),
    ];
    expect(reorderSiblings(tied, 'c', -1)).toEqual([
      { id: 'a', sortOrder: 0 },
      { id: 'c', sortOrder: 1 },
      { id: 'b', sortOrder: 2 },
    ]);
  });
});
