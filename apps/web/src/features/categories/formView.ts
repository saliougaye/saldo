import {
  type Category,
  type CategoryFormValues,
  type CurrencyCode,
  categoryFormFrom,
  categoryParentCandidates,
  emptyCategoryForm,
  getCurrency,
  type MinorDigits,
  type UserData,
} from '@saldo/core';

export interface ParentOption {
  id: string;
  name: string;
  icon: string;
  colorIndex: number;
}

export interface CategoryFormView {
  mode: 'new' | 'edit';
  id: string | null;
  /**
   * The edited row's version as the page loaded it, sent back as `expectedUpdatedAt`: a phone's edit
   * after the page loaded answers `conflict` instead of being overwritten (§17.4.2). Null for a new one.
   */
  updatedAt: string | null;
  initial: CategoryFormValues;
  /** A category with children cannot get a parent, so its parent select is hidden. */
  hasChildren: boolean;
  minorDigits: MinorDigits;
}

/** The category being edited, or null when `id` is not a live category. */
export function categoryFormView(input: {
  data: UserData;
  currency: CurrencyCode;
  mode: 'new' | 'edit';
  id: string | null;
  /** A new category's direction: the one the list shows (`?d=income`). Default: an expense. */
  direction?: Category['direction'];
}): CategoryFormView | null {
  const { data } = input;
  const { minorDigits } = getCurrency(input.currency);
  const editing =
    input.mode === 'edit'
      ? data.categories.find((row) => row.id === input.id && row.archivedAt === null)
      : undefined;
  if (input.mode === 'edit' && editing === undefined) return null;

  const own =
    editing === undefined
      ? null
      : (data.budgets.find(
          (budget) => budget.categoryIds.length === 1 && budget.categoryIds[0] === editing.id,
        ) ?? null);

  return {
    mode: input.mode,
    id: editing?.id ?? null,
    updatedAt: editing?.updatedAt ?? null,
    initial:
      editing === undefined
        ? { ...emptyCategoryForm(), direction: input.direction ?? 'expense' }
        : categoryFormFrom(editing, own?.amount ?? null, minorDigits),
    hasChildren:
      editing !== undefined && data.categories.some((row) => row.parentId === editing.id),
    minorDigits,
  };
}

/**
 * The parents a category can take in `direction` (§4): core's candidates, as options. The form
 * calls it on the page's categories, which it gets once for every row (`sharedProps`), so a page
 * with a form for each category does not send a list of parents for each of them.
 */
export function categoryParentOptions(
  categories: readonly Category[],
  direction: Category['direction'],
  editingId: string | null,
): ParentOption[] {
  return categoryParentCandidates(categories, direction, editingId).map((row) => ({
    id: row.id,
    name: row.name,
    icon: row.icon,
    colorIndex: row.colorIndex,
  }));
}
