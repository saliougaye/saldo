import type { TagWriteError } from '../../server/write/tags';

/** The `web.tags.error_*` lines the tag form and its dialogs can show. */
interface ErrorLines {
  error_invalid: string;
  error_notFound: string;
  error_conflict: string;
  error_unexpected: string;
}

/**
 * One line for every error the tag writes return, and for a throw. `taken` is the phone's own
 * `tags.missing_taken`, which already says it.
 */
export function tagWriteErrors(
  lines: ErrorLines,
  taken: string,
): Record<TagWriteError | 'unexpected', string> {
  return {
    invalid: lines.error_invalid,
    notFound: lines.error_notFound,
    conflict: lines.error_conflict,
    taken,
    unexpected: lines.error_unexpected,
  };
}
