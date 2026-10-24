'use server';

import { headers } from 'next/headers';
import type { SearchResult } from '../../src/features/search/searchView';
import { requireWebUser } from '../../src/server/auth/currentUser';
import { env } from '../../src/server/env';
import { searchFor } from '../../src/server/search/search';

/**
 * The command palette's data search (spec 2026-10-23, §05). A Server Action is a public endpoint,
 * whatever page rendered the palette: it reads the session itself and searches that user only.
 */
export async function searchAction(query: unknown): Promise<SearchResult> {
  const user = await requireWebUser();
  return searchFor(user.id, typeof query === 'string' ? query : '', {
    now: new Date(),
    fallbackTimeZone: env().defaultTimeZone,
    acceptLanguage: (await headers()).get('accept-language'),
  });
}
