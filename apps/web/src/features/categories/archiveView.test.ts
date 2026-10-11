import { categorySchema } from '@saldo/core';
import { describe, expect, it } from 'vitest';
import { CATEGORY, CATEGORY_2, CATEGORY_CHILD } from '../test/fixtures';
import { archiveMoveTargets } from './archiveView';

const SALARY = categorySchema.parse({
  ...CATEGORY,
  id: 'i1',
  name: 'Stipendio',
  direction: 'income',
  icon: 'wallet',
});

describe('archiveMoveTargets', () => {
  // Regression (2026-10-11, Profilo → Categorie in place): the dialog showed «Sposta le transazioni
  // in» whenever the category was in use, so the only income category offered a select whose only
  // option was «Nessuna».
  it('offers no move for a category in use that no other category can take', () => {
    expect(archiveMoveTargets([CATEGORY, CATEGORY_2, SALARY], SALARY.id, 3)).toBeNull();
  });

  it('offers no move when nothing uses the category', () => {
    expect(archiveMoveTargets([CATEGORY, CATEGORY_2], CATEGORY.id, 0)).toBeNull();
  });

  it('offers the live categories of the same direction, not its own children', () => {
    const targets = archiveMoveTargets(
      [CATEGORY, CATEGORY_CHILD, CATEGORY_2, SALARY],
      CATEGORY.id,
      2,
    );
    expect(targets?.map((row) => row.id)).toEqual([CATEGORY_2.id]);
  });
});
