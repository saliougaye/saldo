import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import type { Category, Transaction } from './entities';
import { RECENTS_WINDOW_DAYS, topCategories } from './recents';

const TODAY = '2026-09-13';
/** The oldest date still inside the window, and the newest one outside it. */
const OLDEST_INSIDE = addDays(TODAY, -RECENTS_WINDOW_DAYS);
const NEWEST_OUTSIDE = addDays(TODAY, -(RECENTS_WINDOW_DAYS + 1));
const LONG_AGO = '2024-01-10';

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

const times = (count: number, categoryId: string, date: string) =>
  Array.from({ length: count }, () => use(categoryId, date));

describe('topCategories', () => {
  // `current` is first by hand and `old-favourite` second, so every ranking below that puts
  // `old-favourite` on top can only have got there by counting, never by the manual order.
  const categories = [
    category('current', { sortOrder: 0 }),
    category('old-favourite', { sortOrder: 1 }),
    category('salary', { direction: 'income', sortOrder: 2 }),
  ];

  it('orders by usage, then by the manual order', () => {
    expect(topCategories(categories, [], 'expense', { today: TODAY }).map((c) => c.id)).toEqual([
      'current',
      'old-favourite',
    ]);
    const usage = [...times(2, 'old-favourite', TODAY), use('current', TODAY)];
    expect(topCategories(categories, usage, 'expense', { today: TODAY }).map((c) => c.id)).toEqual([
      'old-favourite',
      'current',
    ]);
  });

  it('ranks a category used inside the window above one used only before it', () => {
    const usage = [...times(20, 'old-favourite', LONG_AGO), ...times(5, 'current', '2026-09-01')];
    const ranked = topCategories(categories, usage, 'expense', { today: TODAY });
    expect(ranked[0]?.id).toBe('current');
  });

  it('falls back to all of history when the window is nearly empty', () => {
    const usage = times(20, 'old-favourite', LONG_AGO);
    const ranked = topCategories(categories, usage, 'expense', { today: TODAY });
    expect(ranked[0]?.id).toBe('old-favourite');
  });

  it('counts a transaction dated exactly at the far edge of the window', () => {
    const usage = [...times(20, 'old-favourite', LONG_AGO), ...times(5, 'current', OLDEST_INSIDE)];
    const ranked = topCategories(categories, usage, 'expense', { today: TODAY });
    expect(ranked[0]?.id).toBe('current');
  });

  it('leaves out a transaction dated one day beyond the window', () => {
    const usage = [
      ...times(20, 'old-favourite', LONG_AGO),
      ...times(5, 'current', NEWEST_OUTSIDE),
    ];
    // Nothing is inside the window any more, so the fallback ranks all of history instead.
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
    const usage = [{ categoryId: null, date: TODAY }, ...times(2, 'old-favourite', TODAY)];
    expect(topCategories(categories, usage, 'expense', { today: TODAY })[0]?.id).toBe(
      'old-favourite',
    );
  });
});
