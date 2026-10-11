import { categorySchema } from '@saldo/core';
import { describe, expect, it } from 'vitest';
import { CATEGORY, CATEGORY_2, CATEGORY_CHILD, dataWith, tx } from '../test/fixtures';
import { categoriesView } from './categoriesView';

const ARCHIVED = categorySchema.parse({
  ...CATEGORY_2,
  id: 'c3',
  name: 'Auto',
  archivedAt: '2026-09-01T00:00:00.000Z',
});
/** A live child whose parent is archived: it has no row, but it has a form and an archive dialog. */
const ORPHAN = categorySchema.parse({ ...CATEGORY_CHILD, id: 'c3a', parentId: ARCHIVED.id });

describe('categoriesView usage', () => {
  // The page reads the archive dialog's count here, once, instead of a scan of the transactions for
  // each form. It must be the count the dialog read before: children folded in, deleted rows out.
  it('counts every live category, also a child whose parent is archived', () => {
    const data = dataWith(
      [
        tx({ id: 't1', amount: 100, date: '2026-09-01' }),
        tx({ id: 't2', amount: 100, date: '2026-09-02', categoryId: CATEGORY_CHILD.id }),
        tx({
          id: 't3',
          amount: 100,
          date: '2026-09-03',
          categoryId: CATEGORY_CHILD.id,
          deletedAt: '2026-09-04T00:00:00.000Z',
        }),
        tx({ id: 't4', amount: 100, date: '2026-09-05', categoryId: ORPHAN.id }),
      ],
      { categories: [CATEGORY, CATEGORY_CHILD, CATEGORY_2, ARCHIVED, ORPHAN] },
    );
    const view = categoriesView(data);
    expect(Object.fromEntries(view.usage)).toMatchObject({ c1: 2, c1a: 1, c2: 0, c3a: 1 });
    const rows = view.sections.flatMap((section) => section.rows);
    expect(rows.some((row) => row.id === ORPHAN.id)).toBe(false);
    for (const row of rows) expect(row.uses).toBe(view.usage.get(row.id));
  });
});
