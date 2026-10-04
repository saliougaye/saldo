'use server';

import { parseChosenScopes } from '../../../../src/features/consent/consentView';
import { currentUser } from '../../../../src/server/auth/currentUser';
import { log, shortId } from '../../../../src/server/log';
import { submitConsent } from '../../../../src/server/mcp/consent';

export type ConsentActionResult = { ok: true; redirectTo: string } | { ok: false };

/**
 * «Autorizza» / «Nega» (§17.4.1). Thin: the session, the browser's input checked, then
 * `submitConsent`, which verifies the signed query again and answers with where to go — the
 * authorize endpoint (which issues the code), the client's redirect with `access_denied`, or this
 * page again when the query no longer holds. The browser goes there itself (Decision 10).
 */
export async function submitConsentAction(
  query: unknown,
  accept: unknown,
  scopes: unknown,
): Promise<ConsentActionResult> {
  const user = await currentUser();
  if (user === null || typeof query !== 'string' || typeof accept !== 'boolean') {
    return { ok: false };
  }
  const chosen = accept ? parseChosenScopes(scopes) : [];
  if (chosen === null) return { ok: false };
  try {
    const { redirectTo } = await submitConsent({
      searchParams: new URLSearchParams(query),
      userId: user.id,
      accept,
      scopes: chosen,
    });
    return { ok: true, redirectTo };
  } catch (error) {
    log('mcp', 'a consent answer failed', {
      user: shortId(user.id),
      error: error instanceof Error ? error.name : 'unknown',
    });
    return { ok: false };
  }
}
