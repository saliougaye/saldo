import { authorizeQuery, signedQueryHolds } from './consent';

/**
 * Decision 10. The plugin sends a browser with no session to `/login?{signed query}`; after the
 * passkey ceremony (or at once, when it is already signed in) the browser goes to the authorize
 * endpoint again with the same request, which now finds a session and continues to consent. `null`
 * when the query is absent, tampered or expired: `/login` then behaves as always.
 */
export async function oauthResumePath(searchParams: URLSearchParams): Promise<string | null> {
  if (!(await signedQueryHolds(searchParams))) return null;
  return `/api/auth/oauth2/authorize?${authorizeQuery(searchParams).toString()}`;
}
