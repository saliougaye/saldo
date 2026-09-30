import type { AccountWriteError } from '../../server/write/accounts';

/** The `web.accounts.error_*` lines the archive and restore components can show. */
interface ErrorLines {
  error_invalid: string;
  error_notFound: string;
  error_conflict: string;
  error_holdsGoals: string;
  error_parentArchived: string;
  error_unexpected: string;
}

/**
 * One line for every error the account and goal writes return, and for a throw. `closedGoal` is a
 * transaction error the account writes never return; it reads as a plain «invalid» if it ever does.
 */
export function accountWriteErrors(
  lines: ErrorLines,
): Record<AccountWriteError | 'unexpected', string> {
  return {
    invalid: lines.error_invalid,
    notFound: lines.error_notFound,
    conflict: lines.error_conflict,
    closedGoal: lines.error_invalid,
    holdsGoals: lines.error_holdsGoals,
    parentArchived: lines.error_parentArchived,
    unexpected: lines.error_unexpected,
  };
}
