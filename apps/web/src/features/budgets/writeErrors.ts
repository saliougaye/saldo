import type { BudgetWriteError } from '../../server/write/budgets';

/** The `web.budgets.error_*` lines the budget form and its delete dialog can show. */
interface ErrorLines {
  error_invalid: string;
  error_notFound: string;
  error_conflict: string;
  error_unexpected: string;
}

/**
 * One line for every error the budget writes return, and for a throw. `taken` names a category, so
 * it is not here: the form says it with the name; the dialog never meets it. `closedGoal` is a
 * transaction error a budget write never returns and reads as «invalid» if it ever does.
 */
export function budgetWriteErrors(
  lines: ErrorLines,
  taken: string,
): Record<BudgetWriteError | 'unexpected', string> {
  return {
    invalid: lines.error_invalid,
    notFound: lines.error_notFound,
    conflict: lines.error_conflict,
    closedGoal: lines.error_invalid,
    taken,
    unexpected: lines.error_unexpected,
  };
}
