import type { CategoryWriteError } from '../../server/write/categories';

/** The `web.categories.error_*` lines the category components can show. */
interface ErrorLines {
  error_invalid: string;
  error_notFound: string;
  error_conflict: string;
  error_parentInvalid: string;
  error_parentArchived: string;
  error_moveInvalid: string;
  error_unexpected: string;
}

/**
 * One line for every error the category writes return, and for a throw. `closedGoal` is a
 * transaction error these writes never return and reads as «invalid». Restoring a child under an
 * archived parent answers `parentInvalid`, which there means the parent is archived.
 */
export function categoryWriteErrors(
  lines: ErrorLines,
  context: 'save' | 'restore',
): Record<CategoryWriteError | 'unexpected', string> {
  return {
    invalid: lines.error_invalid,
    notFound: lines.error_notFound,
    conflict: lines.error_conflict,
    closedGoal: lines.error_invalid,
    parentInvalid: context === 'restore' ? lines.error_parentArchived : lines.error_parentInvalid,
    moveInvalid: lines.error_moveInvalid,
    unexpected: lines.error_unexpected,
  };
}
