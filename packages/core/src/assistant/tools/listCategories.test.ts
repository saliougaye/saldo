import { describe, expect, it } from 'vitest';
import { CONTEXT, fixtureData } from '../__fixtures__/userData';
import { listCategoriesTool } from './listCategories';

describe('list_categories', () => {
  it('lists expenses then income, each parent followed by its children', () => {
    const result = listCategoriesTool.run(fixtureData(), CONTEXT, { includeArchived: false });
    expect(result.categories).toEqual([
      { id: 'c-food', name: 'Spesa', direction: 'expense', parentId: null, archived: false },
      {
        id: 'c-super',
        name: 'Supermercato',
        direction: 'expense',
        parentId: 'c-food',
        archived: false,
      },
      { id: 'c-home', name: 'Casa', direction: 'expense', parentId: null, archived: false },
      { id: 'c-salary', name: 'Stipendio', direction: 'income', parentId: null, archived: false },
    ]);
  });

  it('adds archived categories at the end only on request', () => {
    const result = listCategoriesTool.run(fixtureData(), CONTEXT, { includeArchived: true });
    expect(result.categories.at(-1)).toEqual({
      id: 'c-old',
      name: 'Vecchia',
      direction: 'expense',
      parentId: null,
      archived: true,
    });
  });

  it('still lists a live child whose parent was archived', () => {
    const data = fixtureData();
    data.categories = data.categories.map((category) =>
      category.id === 'c-food' ? { ...category, archivedAt: '2026-09-01T00:00:00.000Z' } : category,
    );
    const ids = listCategoriesTool
      .run(data, CONTEXT, { includeArchived: false })
      .categories.map((category) => category.id);
    expect(ids).toContain('c-super');
    expect(ids).not.toContain('c-food');
  });
});
