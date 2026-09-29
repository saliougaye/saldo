import type { Transaction } from './entities';

/** Plain code-unit comparison: what SQLite's default BINARY collation does to a TEXT column. */
function binary(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * The order every transaction list comes back in on the phone — `ORDER BY date DESC, created_at
 * DESC, id DESC` — for code that sorts rows it already holds. **Not** `localeCompare`: ICU folds
 * case and skips punctuation, so on a tie it can put two ids the other way round from SQLite.
 */
export function newestFirst(
  a: Pick<Transaction, 'date' | 'createdAt' | 'id'>,
  b: Pick<Transaction, 'date' | 'createdAt' | 'id'>,
): number {
  return binary(b.date, a.date) || binary(b.createdAt, a.createdAt) || binary(b.id, a.id);
}
