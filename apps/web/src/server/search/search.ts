import { MAX_SEARCH_QUERY, readSettings } from '@saldo/core';
import { catalogs, makeTranslator } from '@saldo/i18n';
import { type SearchResult, searchView } from '../../features/search/searchView';
import { webLocale } from '../../i18n/locale';
import { pageState } from '../page/context';
import { loadUserData } from '../userData/load';

/**
 * Palette spec §05: the data search of one user. `userId` comes from the session, never from the
 * request — the caller (`searchAction`) reads it — and `loadUserData` reads that user's rows only.
 * The request's headers come in as values, so a test can call this without a request.
 */
export async function searchFor(
  userId: string,
  query: string,
  request: { now: Date; fallbackTimeZone: string; acceptLanguage: string | null },
): Promise<SearchResult> {
  const data = await loadUserData(userId);
  const locale = webLocale(readSettings(data.settings).language, request.acceptLanguage);
  const state = pageState({
    data,
    now: request.now,
    fallbackTimeZone: request.fallbackTimeZone,
    params: {},
  });
  return searchView({
    data,
    query: query.slice(0, MAX_SEARCH_QUERY),
    today: state.today,
    def: state.def,
    currency: state.currency,
    locale,
    t: makeTranslator(catalogs[locale]),
  });
}
