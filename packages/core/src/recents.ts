import { addDays, type LocalDate } from './dates';
import type { Category, Transaction, TransactionKind } from './entities';

/** How far back "recently used" reaches, and how much use it takes to trust the window. */
export const RECENTS_WINDOW_DAYS = 90;
const MIN_ROWS_IN_WINDOW = 5;

/** Two rows of four, the "Altro" tile included. */
const DEFAULT_LIMIT = 7;

/**
 * The categories the transaction form offers as tiles (§6.16), most used first.
 *
 * **Ranked on the last 90 days, not on all of history.** A category used heavily two years ago and
 * never since is not what the next transaction wants, and all-time counts never let go of it. The
 * fallback matters as much as the window: a fresh install, or somebody who has not entered anything
 * in months, has nothing inside it, and ranking on an almost-empty sample is worse than ranking on
 * everything — so under five rows in the window, the whole history decides.
 *
 * Recency (last used first) was considered and rejected: it moves the tiles between one entry and
 * the next, and a target that moves costs more than the ranking saves.
 *
 * Seven, not the ten the spec names: with the "Altro" tile that is two rows of four, and the grid
 * stops pushing the date, the tags and the attachments off the screen. Everything it drops is one
 * tap away in the picker, which also holds the subcategories the grid never showed.
 */
export function topCategories(
  categories: readonly Category[],
  transactions: readonly Pick<Transaction, 'categoryId' | 'date'>[],
  kind: TransactionKind,
  options: { today: LocalDate; limit?: number },
): Category[] {
  const limit = options.limit ?? DEFAULT_LIMIT;
  // Transfers carry no category, so the grid they would show is the expense one — the form only
  // asks for this while the kind is expense or income anyway.
  const direction = kind === 'income' ? 'income' : 'expense';
  const since = addDays(options.today, -RECENTS_WINDOW_DAYS);
  const inWindow = transactions.filter((tx) => tx.date >= since);
  const counted = inWindow.length >= MIN_ROWS_IN_WINDOW ? inWindow : transactions;

  const usage = new Map<string, number>();
  for (const tx of counted) {
    if (tx.categoryId === null) continue;
    usage.set(tx.categoryId, (usage.get(tx.categoryId) ?? 0) + 1);
  }
  return categories
    .filter((category) => category.direction === direction && category.archivedAt === null)
    .sort((a, b) => {
      const diff = (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0);
      return diff !== 0 ? diff : a.sortOrder - b.sortOrder;
    })
    .slice(0, limit);
}
