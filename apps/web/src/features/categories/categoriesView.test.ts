import { categorySchema } from '@saldo/core';
import { describe, expect, it } from 'vitest';
import { CATEGORY, CATEGORY_2, CATEGORY_CHILD, dataWith, tx } from '../test/fixtures';
import { categoriesView } from './categoriesView';

const INCOME = categorySchema.parse({
  ...CATEGORY,
  id: 'i1',
  name: 'Stipendio',
  direction: 'income',
});
const ARCHIVED = categorySchema.parse({
  ...CATEGORY_2,
  id: 'c9',
  name: 'Vecchia',
  archivedAt: '2026-05-01T00:00:00.000Z',
});

describe('categoriesView', () => {
  it('lists Uscite then Entrate, children under their parent', () => {
    const view = categoriesView(
      dataWith([], { categories: [CATEGORY_2, INCOME, CATEGORY_CHILD, CATEGORY] }),
    );
    expect(view.sections.map((s) => s.direction)).toEqual(['expense', 'income']);
    expect(view.sections[0]?.rows.map((r) => [r.id, r.depth])).toEqual([
      ['c1', 0],
      ['c1a', 1],
      ['c2', 0],
    ]);
    expect(view.sections[1]?.rows.map((r) => r.id)).toEqual(['i1']);
  });

  it('counts live transactions and folds the children into the parent', () => {
    const view = categoriesView(
      dataWith(
        [
          tx({ id: 't1', amount: 100, date: '2026-09-01' }),
          tx({ id: 't2', amount: 100, date: '2026-09-02', categoryId: 'c1a' }),
          tx({ id: 't3', amount: 100, date: '2026-09-03', deletedAt: '2026-09-04T00:00:00.000Z' }),
        ],
        { categories: [CATEGORY, CATEGORY_CHILD] },
      ),
    );
    const rows = view.sections[0]?.rows ?? [];
    expect(rows.find((r) => r.id === 'c1')?.uses).toBe(2);
    expect(rows.find((r) => r.id === 'c1a')?.uses).toBe(1);
  });

  it('disables up on the first and down on the last of each sibling group', () => {
    const view = categoriesView(
      dataWith([], { categories: [CATEGORY, CATEGORY_2, CATEGORY_CHILD] }),
    );
    const rows = view.sections[0]?.rows ?? [];
    const flags = (id: string) => {
      const row = rows.find((r) => r.id === id);
      return [row?.canMoveUp, row?.canMoveDown];
    };
    expect(flags('c1')).toEqual([false, true]);
    expect(flags('c2')).toEqual([true, false]);
    expect(flags('c1a')).toEqual([false, false]);
  });

  it('collects the archived ones, and flags a child under an archived parent', () => {
    const parent = categorySchema.parse({ ...CATEGORY, archivedAt: '2026-06-01T00:00:00.000Z' });
    const child = categorySchema.parse({
      ...CATEGORY_CHILD,
      archivedAt: '2026-06-01T00:00:00.000Z',
    });
    const view = categoriesView(dataWith([], { categories: [parent, child, ARCHIVED, INCOME] }));
    expect(view.archived.map((r) => r.id).sort()).toEqual(['c1', 'c1a', 'c9']);
    const row = view.archived.find((r) => r.id === 'c1a');
    expect(row?.parentName).toBe('Spesa');
    expect(row?.parentArchived).toBe(true);
    expect(view.archived.find((r) => r.id === 'c9')?.parentArchived).toBe(false);
    expect(view.sections[0]?.rows).toEqual([]);
  });
});
