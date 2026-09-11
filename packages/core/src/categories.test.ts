import { describe, expect, it } from 'vitest';
import {
  childCategories,
  reorderSiblings,
  rollUpCategoryUsage,
  topLevelCategories,
} from './categories';
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

describe('topLevelCategories', () => {
  it('keeps one direction, drops children and archived rows, and sorts by sortOrder', () => {
    expect(topLevelCategories(CATEGORIES, 'expense').map((row) => row.id)).toEqual([
      'home',
      'food',
    ]);
  });

  it('separates the directions', () => {
    expect(topLevelCategories(CATEGORIES, 'income').map((row) => row.id)).toEqual(['salary']);
  });
});

describe('childCategories', () => {
  it('returns the live children in display order', () => {
    expect(childCategories(CATEGORIES, 'food').map((row) => row.id)).toEqual(['bakery', 'market']);
  });

  it('is empty for a leaf', () => {
    expect(childCategories(CATEGORIES, 'rent')).toEqual([]);
  });
});

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

  it('leaves the children counts untouched', () => {
    const rolled = rollUpCategoryUsage(CATEGORIES, new Map([['market', 4]]));
    expect(rolled.get('market')).toBe(4);
    expect(rolled.get('food')).toBe(4);
  });

  it('reports zero for a category nothing uses', () => {
    const rolled = rollUpCategoryUsage(CATEGORIES, new Map());
    expect(rolled.get('rent')).toBe(0);
    expect(rolled.get('home')).toBe(0);
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
  const siblings = [
    category({ id: 'a', sortOrder: 0 }),
    category({ id: 'b', sortOrder: 1 }),
    category({ id: 'c', sortOrder: 2 }),
  ];

  it('swaps a row with the one above it', () => {
    expect(reorderSiblings(siblings, 'b', -1)).toEqual([
      { id: 'b', sortOrder: 0 },
      { id: 'a', sortOrder: 1 },
      { id: 'c', sortOrder: 2 },
    ]);
  });

  it('swaps a row with the one below it', () => {
    expect(reorderSiblings(siblings, 'b', 1)).toEqual([
      { id: 'a', sortOrder: 0 },
      { id: 'c', sortOrder: 1 },
      { id: 'b', sortOrder: 2 },
    ]);
  });

  it('refuses to move past either end', () => {
    expect(reorderSiblings(siblings, 'a', -1)).toEqual([]);
    expect(reorderSiblings(siblings, 'c', 1)).toEqual([]);
  });

  it('ignores an id that is not in the group', () => {
    expect(reorderSiblings(siblings, 'zzz', 1)).toEqual([]);
  });

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
