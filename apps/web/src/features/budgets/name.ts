/** The schema's limit on a budget name (`budgetInputSchema`). */
export const BUDGET_NAME_MAX = 40;

/** The typed name, or the one built from the categories, cut so the server never refuses its length. */
export function resolveBudgetName(typed: string, built: string): string {
  return (typed.trim() || built).slice(0, BUDGET_NAME_MAX);
}
