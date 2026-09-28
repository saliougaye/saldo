import { filtersFromParams, type TransactionFilters } from '@saldo/core';
import { PERIOD_PARAM } from '../period/periodParams';

/**
 * The filters of §5.12, read out of a URL.
 *
 * They live in the URL rather than in client state so a filtered list is shareable, survives a
 * reload, and can be reached by a link — which is what lets a chip be an `<a>` rather than a button.
 * The account, the direction and «solo escluse» are read by `@saldo/core`'s own `filtersFromParams`,
 * so a hand-edited `?direction=sideways` is dropped by the same rule on both apps: anything
 * unreadable reads as «not filtered», never as a silently wrong slice.
 */
export function filtersFromSearch(params: Record<string, string | undefined>): TransactionFilters {
  const tag = params.tag;
  return {
    ...filtersFromParams({
      accountId: params.account,
      direction: params.direction,
      onlyExcluded: params.excluded,
    }),
    query: params.q ?? '',
    categoryId: params.category ?? null,
    tagIds: tag === undefined || tag === '' ? [] : tag.split(','),
  };
}

/** The other way: only what is set, so an unfiltered list has a clean URL. */
export function searchFromFilters(filters: TransactionFilters): Record<string, string> {
  const out: Record<string, string> = {};
  if (filters.query !== '') out.q = filters.query;
  if (filters.accountId !== null) out.account = filters.accountId;
  if (filters.categoryId !== null) out.category = filters.categoryId;
  if (filters.direction !== 'all') out.direction = filters.direction;
  if (filters.tagIds.length > 0) out.tag = filters.tagIds.join(',');
  if (filters.onlyExcluded) out.excluded = '1';
  return out;
}

/** The one filter a chip flips; the others are carried over untouched. */
export interface Toggle {
  direction?: TransactionFilters['direction'];
  accountId?: string;
  tagId?: string;
  excluded?: boolean;
}

/**
 * Where a chip links: the same list with that one filter flipped. The selected row (`?t=`) is
 * dropped, because a row that does not match the new filters would leave the panel showing something
 * the list no longer holds; the period is kept, because it is not a filter.
 */
export function toggleHref(
  path: string,
  filters: TransactionFilters,
  toggle: Toggle,
  others: Record<string, string | undefined> = {},
): string {
  const next: TransactionFilters = { ...filters };
  if (toggle.direction !== undefined) {
    // A chip toggles: tapping the one already on clears it rather than setting it again.
    next.direction = filters.direction === toggle.direction ? 'all' : toggle.direction;
  }
  if (toggle.accountId !== undefined) {
    next.accountId = filters.accountId === toggle.accountId ? null : toggle.accountId;
  }
  if (toggle.tagId !== undefined) {
    const tagId = toggle.tagId;
    next.tagIds = filters.tagIds.includes(tagId)
      ? filters.tagIds.filter((id) => id !== tagId)
      : [...filters.tagIds, tagId];
  }
  if (toggle.excluded !== undefined) next.onlyExcluded = toggle.excluded;

  const params = new URLSearchParams(searchFromFilters(next));
  const period = others[PERIOD_PARAM];
  if (period !== undefined) params.set(PERIOD_PARAM, period);
  const query = params.toString();
  return query === '' ? path : `${path}?${query}`;
}
