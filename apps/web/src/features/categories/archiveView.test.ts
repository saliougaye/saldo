import { categorySchema } from '@saldo/core';
import { describe, expect, it } from 'vitest';
import { CATEGORY, CATEGORY_2, CATEGORY_CHILD, dataWith, tx } from '../test/fixtures';
import { archiveCategoryView } from './archiveView';

const INCOME = categorySchema.parse({
  ...CATEGORY,
  id: 'i1',
  name: 'Stipendio',
  direction: 'income',
});

describe('archiveCategoryView', () => {
  it('counts the usage with children folded in and offers same-direction live targets', () => {
    const data = dataWith(
      [
        tx({ id: 't1', amount: 1, date: '2026-09-01' }),
        tx({ id: 't2', amount: 1, date: '2026-09-02', categoryId: 'c1a' }),
      ],
      { categories: [CATEGORY, CATEGORY_2, CATEGORY_CHILD, INCOME] },
    );
    const view = archiveCategoryView(data, 'c1');
    expect(view?.uses).toBe(2);
    // Not itself, not its child, not the other direction.
    expect(view?.targets.map((t) => t.id)).toEqual(['c2']);
  });

  it('is null for an archived or unknown category', () => {
    const archived = categorySchema.parse({ ...CATEGORY, archivedAt: '2026-05-01T00:00:00.000Z' });
    expect(archiveCategoryView(dataWith([], { categories: [archived] }), 'c1')).toBeNull();
    expect(archiveCategoryView(dataWith([]), 'zz')).toBeNull();
  });
});
