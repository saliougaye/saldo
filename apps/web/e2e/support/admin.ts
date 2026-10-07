import { createHash, randomBytes } from 'node:crypto';
import {
  type Browser,
  type BrowserContext,
  type Page,
  request as playwrightRequest,
} from '@playwright/test';
import { E2E_ORIGIN } from '../env';
import { ADMIN_STORAGE } from './state';

/** The setup admin in a browser of its own. Never revoke or demote it: every other spec uses its session. */
export async function openAdmin(
  browser: Browser,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    storageState: ADMIN_STORAGE,
    locale: 'it-IT',
    baseURL: E2E_ORIGIN,
  });
  return { context, page: await context.newPage() };
}

/** Where the OAuth client of the tests «listens»: a loopback address nothing serves; the test intercepts it. */
export const OAUTH_REDIRECT = 'http://127.0.0.1:33418/callback';

export interface AuthorizationRequest {
  clientId: string;
  /** The URL a client opens in the browser (§17.4.1), with PKCE S256 and the resource. */
  authorizeUrl: string;
  state: string;
  codeVerifier: string;
}

/**
 * What an MCP client does before it opens the browser: dynamic registration as a public client,
 * then the authorization URL with a PKCE challenge. Same calls as `app/mcp/oauthDance.test.ts`.
 */
export async function startAuthorization(
  clientName: string,
  scope = 'read write offline_access',
): Promise<AuthorizationRequest> {
  const api = await playwrightRequest.newContext({
    baseURL: E2E_ORIGIN,
    extraHTTPHeaders: { Origin: E2E_ORIGIN },
  });
  try {
    const registered = await api.post('/api/auth/oauth2/register', {
      data: {
        client_name: clientName,
        redirect_uris: [OAUTH_REDIRECT],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
      },
    });
    if (!registered.ok()) throw new Error(`registration refused: ${registered.status()}`);
    const { client_id: clientId } = (await registered.json()) as { client_id: string };

    const codeVerifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(codeVerifier).digest('base64url');
    const state = randomBytes(8).toString('hex');
    const url = new URL('/api/auth/oauth2/authorize', E2E_ORIGIN);
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: OAUTH_REDIRECT,
      scope,
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      resource: `${E2E_ORIGIN}/mcp`,
    }).toString();
    return { clientId, authorizeUrl: url.toString(), state, codeVerifier };
  } finally {
    await api.dispose();
  }
}

/** The browser meets `OAUTH_REDIRECT` when the consent is answered: serve it, so the page does not error. */
export async function captureCallback(page: Page): Promise<() => Promise<URL>> {
  let resolve: (url: URL) => void = () => {};
  const arrived = new Promise<URL>((done) => {
    resolve = done;
  });
  await page.route(`${OAUTH_REDIRECT.replace('/callback', '')}/**`, async (route) => {
    resolve(new URL(route.request().url()));
    await route.fulfill({ status: 200, contentType: 'text/html', body: '<p>callback</p>' });
  });
  return () => arrived;
}
