import { topLevelCategories } from '../categories';
import type { Category } from '../entities';
import { minorToAmountBuffer } from '../money';

export interface CategoryFormValues {
  name: string;
  direction: Category['direction'];
  icon: string;
  colorIndex: number;
  parentId: string | null;
  /** §6.19: a single-category cycle budget, created or updated on save. */
  budgetEnabled: boolean;
  budgetBuffer: string;
}

export function emptyCategoryForm(): CategoryFormValues {
  return {
    name: '',
    direction: 'expense',
    icon: 'tag',
    colorIndex: 0,
    parentId: null,
    budgetEnabled: false,
    budgetBuffer: '',
  };
}

export function categoryFormFrom(
  category: Category,
  budgetAmount: number | null,
  minorDigits: 0 | 2 | 3,
): CategoryFormValues {
  return {
    name: category.name,
    direction: category.direction,
    icon: category.icon,
    colorIndex: category.colorIndex,
    parentId: category.parentId,
    budgetEnabled: budgetAmount !== null,
    budgetBuffer: budgetAmount === null ? '' : minorToAmountBuffer(budgetAmount, minorDigits),
  };
}

/**
 * What the form is still waiting for, or `null` when nothing is. Only the name is required (§6.19):
 * the direction, the icon and the colour all start from a default, so the footer can name the one
 * thing that is missing instead of leaving the button grey and unexplained.
 */
export function categoryMissingForSave(values: CategoryFormValues): 'name' | null {
  return values.name.trim().length > 0 ? null : 'name';
}

/**
 * The parents a category can sit under (§4): live top-level categories of its direction, never the
 * one being edited. A category that has children cannot get a parent (a child cannot have
 * children), so it is offered none.
 */
export function categoryParentCandidates(
  categories: readonly Category[],
  direction: Category['direction'],
  editingId: string | null,
): Category[] {
  if (editingId !== null && categories.some((category) => category.parentId === editingId)) {
    return [];
  }
  return topLevelCategories(categories, direction).filter((category) => category.id !== editingId);
}

/**
 * Where an archived category's transactions can move (§5.11): live, same direction, and neither
 * the category itself nor one of its children (which are archived with it).
 */
export function movableTargets(categories: readonly Category[], category: Category): Category[] {
  return categories.filter(
    (candidate) =>
      candidate.id !== category.id &&
      candidate.parentId !== category.id &&
      candidate.direction === category.direction &&
      candidate.archivedAt === null,
  );
}
