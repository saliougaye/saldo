import { describe, expect, it } from 'vitest';
import type { Category } from '../entities';
import {
  categoryFormFrom,
  categoryMissingForSave,
  categoryParentCandidates,
  emptyCategoryForm,
  movableTargets,
} from './categoryForm';

const category = (patch: Partial<Category> & { id: string }): Category => ({
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  name: patch.id,
  direction: 'expense',
  parentId: null,
  icon: 'cart',
  colorIndex: 2,
  archivedAt: null,
  sortOrder: 0,
  ...patch,
});

const ARCHIVED = '2026-02-01T00:00:00.000Z';
const TREE: Category[] = [
  category({ id: 'food' }),
  category({ id: 'market', parentId: 'food' }),
  category({ id: 'home' }),
  category({ id: 'old', archivedAt: ARCHIVED }),
  category({ id: 'salary', direction: 'income' }),
  category({ id: 'bonus', direction: 'income' }),
];

describe('emptyCategoryForm', () => {
  it('starts as a top-level expense with the default look and no budget', () => {
    expect(emptyCategoryForm()).toEqual({
      name: '',
      direction: 'expense',
      icon: 'tag',
      colorIndex: 0,
      parentId: null,
      budgetEnabled: false,
      budgetBuffer: '',
    });
  });
});

describe('categoryFormFrom', () => {
  it('reads the category and switches the budget on with its amount', () => {
    expect(categoryFormFrom(category({ id: 'a', name: 'Spesa' }), 30000, 2)).toMatchObject({
      name: 'Spesa',
      icon: 'cart',
      colorIndex: 2,
      budgetEnabled: true,
      budgetBuffer: '300',
    });
  });

  it('leaves the budget off without one', () => {
    expect(categoryFormFrom(category({ id: 'a' }), null, 2)).toMatchObject({
      budgetEnabled: false,
      budgetBuffer: '',
    });
  });
});

describe('categoryMissingForSave', () => {
  it('asks for a name, and only for that', () => {
    expect(categoryMissingForSave(emptyCategoryForm())).toBe('name');
    expect(categoryMissingForSave({ ...emptyCategoryForm(), name: '   ' })).toBe('name');
    expect(categoryMissingForSave({ ...emptyCategoryForm(), name: 'Spesa' })).toBeNull();
  });
});

describe('categoryParentCandidates', () => {
  it('offers live top-level categories of the same direction', () => {
    expect(categoryParentCandidates(TREE, 'expense', null).map((c) => c.id)).toEqual([
      'food',
      'home',
    ]);
    expect(categoryParentCandidates(TREE, 'income', null).map((c) => c.id)).toEqual([
      'bonus',
      'salary',
    ]);
  });

  it('leaves out the category being edited', () => {
    expect(categoryParentCandidates(TREE, 'expense', 'home').map((c) => c.id)).toEqual(['food']);
  });

  it('offers nothing to a category that has children: a child cannot have children', () => {
    expect(categoryParentCandidates(TREE, 'expense', 'food')).toEqual([]);
  });
});

describe('movableTargets', () => {
  it('is live, same direction, not itself nor its children', () => {
    const food = TREE.find((c) => c.id === 'food');
    if (food === undefined) throw new Error('fixture');
    expect(movableTargets(TREE, food).map((c) => c.id)).toEqual(['home']);
  });

  it('allows the parent and siblings of a child', () => {
    const market = TREE.find((c) => c.id === 'market');
    if (market === undefined) throw new Error('fixture');
    expect(movableTargets(TREE, market).map((c) => c.id)).toEqual(['food', 'home']);
  });
});
