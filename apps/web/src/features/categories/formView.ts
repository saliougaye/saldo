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
  /** The parents each direction offers (§4); both are handed over because a new category can switch. */
  parents: Record<Category['direction'], ParentOption[]>;
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

  const options = (direction: Category['direction']): ParentOption[] =>
    categoryParentCandidates(data.categories, direction, editing?.id ?? null).map((row) => ({
      id: row.id,
      name: row.name,
      icon: row.icon,
      colorIndex: row.colorIndex,
    }));

  return {
    mode: input.mode,
    id: editing?.id ?? null,
    updatedAt: editing?.updatedAt ?? null,
    initial:
      editing === undefined
        ? emptyCategoryForm()
        : categoryFormFrom(editing, own?.amount ?? null, minorDigits),
    parents: { expense: options('expense'), income: options('income') },
    hasChildren:
      editing !== undefined && data.categories.some((row) => row.parentId === editing.id),
    minorDigits,
  };
}
