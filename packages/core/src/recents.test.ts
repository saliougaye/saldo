import { describe, expect, it } from 'vitest';
import type { Category, Transaction } from './entities';
import { topCategories } from './recents';

const TODAY = '2026-09-13';

function category(id: string, overrides: Partial<Category> = {}): Category {
  return {
    id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '001775000000000-0000-dev',
    deletedAt: null,
    name: id,
    direction: 'expense',
    parentId: null,
    icon: 'cart',
    colorIndex: 0,
    archivedAt: null,
    sortOrder: 0,
    ...overrides,
  };
}

const use = (categoryId: string, date: string): Pick<Transaction, 'categoryId' | 'date'> => ({
  categoryId,
  date,
});

describe('topCategories', () => {
  const categories = [
    category('old-favourite', { sortOrder: 0 }),
    category('current', { sortOrder: 1 }),
    category('salary', { direction: 'income', sortOrder: 2 }),
  ];

  it('orders by usage, then by the manual order', () => {
    const usage = [use('current', TODAY), use('current', TODAY), use('old-favourite', TODAY)];
    expect(topCategories(categories, usage, 'expense', { today: TODAY }).map((c) => c.id)).toEqual([
      'current',
      'old-favourite',
    ]);
  });

  it('ranks a category used inside the window above one used only before it', () => {
    const usage = [
      ...Array.from({ length: 20 }, () => use('old-favourite', '2024-01-10')),
      ...Array.from({ length: 5 }, () => use('current', '2026-09-01')),
    ];
    const ranked = topCategories(categories, usage, 'expense', { today: TODAY });
    expect(ranked[0]?.id).toBe('current');
  });

  it('falls back to all of history when the window is nearly empty', () => {
    const usage = Array.from({ length: 20 }, () => use('old-favourite', '2024-01-10'));
    const ranked = topCategories(categories, usage, 'expense', { today: TODAY });
    expect(ranked[0]?.id).toBe('old-favourite');
  });

  it('offers only the direction being entered', () => {
    const ranked = topCategories(categories, [], 'income', { today: TODAY });
    expect(ranked.map((c) => c.id)).toEqual(['salary']);
  });

  it('caps the grid at two rows, the "Altro" tile included', () => {
    const many = Array.from({ length: 30 }, (_, index) => category(`c-${index}`));
    expect(topCategories(many, [], 'expense', { today: TODAY })).toHaveLength(7);
  });

  it('leaves an archived category out', () => {
    const archived = category('gone', { archivedAt: '2026-01-01T00:00:00.000Z', sortOrder: 9 });
    const ranked = topCategories([...categories, archived], [], 'expense', { today: TODAY });
    expect(ranked.map((c) => c.id)).not.toContain('gone');
  });

  it('ignores the transfers that carry no category', () => {
    const usage = [{ categoryId: null, date: TODAY }, use('current', TODAY)];
    expect(topCategories(categories, usage, 'expense', { today: TODAY })[0]?.id).toBe('current');
  });
});
