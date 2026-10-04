import type { ToolScope } from '@saldo/core';
import type { ConsentRequest } from '../../server/mcp/consent';

// `/oauth/consent` (§17.4.1, §17.4.3, variant C). Imports types only, so the consent form — a client
// component — can use it. Rebuilding the signed query is 0.4a-2's `consentSearchParams`.

/**
 * Not signed in (a session lost between redirects): `/login` with the same signed query, which
 * `/login` verifies and resumes through the authorize endpoint (0.4a-2 decision 10). No `next`.
 */
export function loginRedirect(query: string): string {
  return `/login?${query}`;
}

/** «Aggiungere e modificare» is a row only when the client asked for `write`. */
export function offersWrite(requested: readonly ToolScope[]): boolean {
  return requested.includes('write');
}

/**
 * What the user chose, as `submitConsent` takes it: `read` always («richiesto»), `write` when asked
 * and left ticked. `offline_access` is not a choice: `submitConsent` adds it when it was requested.
 */
export function chosenScopes(requested: readonly ToolScope[], writeTicked: boolean): ToolScope[] {
  return offersWrite(requested) && writeTicked ? ['read', 'write'] : ['read'];
}

/** The primary button reads «Autorizza solo la lettura» once `write` is unticked. */
export function authorizeReadOnly(requested: readonly ToolScope[], writeTicked: boolean): boolean {
  return offersWrite(requested) && !writeTicked;
}

/** Under the client's name on its card, after «torna a {host}». */
export type ClientNote =
  | { key: 'web.consent.registeredNow' }
  | { key: 'web.consent.authorizedBefore'; dateIso: string };

export function clientNote(
  request: Pick<ConsentRequest, 'fresh' | 'previouslyAuthorizedAt'>,
): ClientNote | null {
  if (request.fresh) return { key: 'web.consent.registeredNow' };
  if (request.previouslyAuthorizedAt !== null) {
    return {
      key: 'web.consent.authorizedBefore',
      dateIso: request.previouslyAuthorizedAt.toISOString(),
    };
  }
  return null;
}

const SCOPES: readonly ToolScope[] = ['read', 'write'];

/**
 * What the browser sent as the chosen scopes, checked: each a known scope, once, `read` among
 * them, returned read-first. Anything else is `null` and the action answers no.
 */
export function parseChosenScopes(raw: unknown): ToolScope[] | null {
  if (!Array.isArray(raw)) return null;
  const seen = new Set<ToolScope>();
  for (const value of raw as unknown[]) {
    const scope = SCOPES.find((candidate) => candidate === value);
    if (scope === undefined || seen.has(scope)) return null;
    seen.add(scope);
  }
  if (!seen.has('read')) return null;
  return SCOPES.filter((scope) => seen.has(scope));
}
