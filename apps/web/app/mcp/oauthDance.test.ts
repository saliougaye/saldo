import {
  Client,
  discoverOAuthServerInfo,
  exchangeAuthorization,
  type FetchLike,
  registerClient,
  StreamableHTTPClientTransport,
  startAuthorization,
} from '@modelcontextprotocol/client';
import { readTools } from '@saldo/core';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { settleBackground } from '../../src/server/background';
import { oauthRefreshToken } from '../../src/server/db/schema';
import { revokeConnector } from '../../src/server/mcp/connectors';
import { readConsentRequest, submitConsent } from '../../src/server/mcp/consent';
import {
  authorizationServerMetadataResponse,
  protectedResourceMetadataResponse,
} from '../../src/server/mcp/discovery';
import { createTestDatabase, type TestDatabase } from '../../src/server/test/harness';
import { createTestSession, sessionCookie } from '../../src/server/test/session';
import { GET as authGet, POST as authPost } from '../api/auth/[...all]/route';
import { DELETE as mcpDelete, GET as mcpGet, POST as mcpPost } from './route';

/**
 * §17.4.5, in process: the MCP SDK's own client discovers the authorization server, registers,
 * starts the authorization; a «browser» with a Saldo session follows the redirects through the
 * consent; the client exchanges the code, connects to /mcp, lists and calls tools; the user revokes
 * and the next call fails. Every HTTP request is routed to the real handlers.
 */
let harness: TestDatabase;

beforeAll(async () => {
  harness = await createTestDatabase();
});

afterEach(async () => {
  await settleBackground();
  await harness.reset();
});

afterAll(async () => {
  await harness.close();
});

const ORIGIN = 'http://localhost:3000';
const REDIRECT = 'http://127.0.0.1:33418/callback';

function router(ip: string): FetchLike {
  return async (input, init) => {
    const original = new Request(input, init);
    const headers = new Headers(original.headers);
    headers.set('x-forwarded-for', ip);
    const body =
      original.method === 'GET' || original.method === 'HEAD'
        ? undefined
        : await original.arrayBuffer();
    const request = new Request(original.url, { method: original.method, headers, body });
    const { pathname } = new URL(request.url);
    if (pathname.startsWith('/.well-known/oauth-protected-resource'))
      return protectedResourceMetadataResponse();
    if (pathname.startsWith('/.well-known/oauth-authorization-server')) {
      return authorizationServerMetadataResponse(request);
    }
    if (pathname.startsWith('/api/auth/'))
      return request.method === 'GET' ? authGet(request) : authPost(request);
    if (pathname === '/mcp') {
      if (request.method === 'POST') return mcpPost(request);
      return request.method === 'DELETE' ? mcpDelete(request) : mcpGet(request);
    }
    return new Response('not found', { status: 404 });
  };
}

/** The browser: GET with the session cookie, expect a redirect, return where it points. */
async function follow(url: string, cookie: string): Promise<URL> {
  const response = await authGet(new Request(new URL(url, ORIGIN), { headers: { cookie } }));
  expect(response.status).toBe(302);
  return new URL(response.headers.get('location') ?? '', ORIGIN);
}

describe('connecting an MCP client to Saldo', () => {
  it('discovers, registers, consents, exchanges, calls, refreshes, and stops after revocation', async () => {
    const fetchFn = router('192.0.2.10');
    const session = await createTestSession(harness.db, 'Ada');
    const cookie = await sessionCookie(session.token);

    // 1. Discovery, as the client does it.
    const info = await discoverOAuthServerInfo(`${ORIGIN}/mcp`, { fetchFn });
    expect(info.authorizationServerUrl).toBe(`${ORIGIN}/api/auth`);
    expect(info.resourceMetadata?.resource).toBe(`${ORIGIN}/mcp`);
    const metadata = info.authorizationServerMetadata;
    expect(metadata?.issuer).toBe(`${ORIGIN}/api/auth`);

    // 2. Dynamic registration.
    const clientInformation = await registerClient(info.authorizationServerUrl, {
      metadata,
      clientMetadata: {
        client_name: 'Claude Code (test)',
        redirect_uris: [REDIRECT],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
      },
      fetchFn,
    });
    expect(clientInformation.client_secret).toBeUndefined();

    // 3. Authorization request (PKCE S256, resource).
    const { authorizationUrl, codeVerifier } = await startAuthorization(
      info.authorizationServerUrl,
      {
        metadata,
        clientInformation,
        redirectUrl: REDIRECT,
        scope: 'read write offline_access',
        state: 'st-dance',
        resource: new URL(`${ORIGIN}/mcp`),
      },
    );

    // 4. The browser: consent page, read only.
    const consentAt = await follow(authorizationUrl.toString(), cookie);
    expect(consentAt.pathname).toBe('/oauth/consent');
    const read = await readConsentRequest(consentAt.searchParams, session.userId);
    expect(read).toMatchObject({
      ok: true,
      request: {
        clientName: 'Claude Code (test)',
        requestedScopes: ['read', 'write'],
        fresh: true,
      },
    });
    const { redirectTo } = await submitConsent({
      searchParams: consentAt.searchParams,
      userId: session.userId,
      accept: true,
      scopes: ['read'],
    });
    const callback = await follow(redirectTo, cookie);
    expect(`${callback.origin}${callback.pathname}`).toBe(REDIRECT);
    expect(callback.searchParams.get('state')).toBe('st-dance');
    const code = callback.searchParams.get('code') ?? '';

    // 5. Code for tokens.
    const tokens = await exchangeAuthorization(info.authorizationServerUrl, {
      metadata,
      clientInformation,
      authorizationCode: code,
      iss: callback.searchParams.get('iss') ?? undefined,
      codeVerifier,
      redirectUri: REDIRECT,
      resource: new URL(`${ORIGIN}/mcp`),
      fetchFn,
    });
    expect(tokens.scope).toBe('read offline_access');
    expect(tokens.refresh_token).toBeTruthy();
    expect(tokens.expires_in).toBeLessThanOrEqual(3600);
    const [stored] = await harness.db
      .select()
      .from(oauthRefreshToken)
      .where(eq(oauthRefreshToken.clientId, clientInformation.client_id));
    const lifetimeDays =
      ((stored?.expiresAt.getTime() ?? 0) - (stored?.createdAt.getTime() ?? 0)) / 86_400_000;
    expect(Math.round(lifetimeDays)).toBe(180);

    // 6. /mcp with the real client.
    const client = new Client({ name: 'saldo-test', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL(`${ORIGIN}/mcp`), {
      fetch: fetchFn,
      requestInit: { headers: { authorization: `Bearer ${tokens.access_token}` } },
    });
    await client.connect(transport);
    expect(client.getInstructions()).toBeTruthy();
    const listed = await client.listTools();
    expect(listed.tools.map((tool) => tool.name).sort()).toEqual(
      readTools.map((tool) => tool.name).sort(),
    );
    const called = await client.callTool({ name: 'get_preferences', arguments: {} });
    expect(called.isError).not.toBe(true);
    expect(called.structuredContent).toBeDefined();

    // 6b. The same token from a client pinned to 2026-07-28: the modern leg (`createMcpHandler`).
    // The SDK's client negotiates the 2025 handshake by default, so without this the leg goes untested.
    const modern = new Client(
      { name: 'saldo-test-modern', version: '1.0.0' },
      { versionNegotiation: { mode: { pin: '2026-07-28' } } },
    );
    await modern.connect(
      new StreamableHTTPClientTransport(new URL(`${ORIGIN}/mcp`), {
        fetch: fetchFn,
        requestInit: { headers: { authorization: `Bearer ${tokens.access_token}` } },
      }),
    );
    const modernListed = await modern.listTools();
    expect(modernListed.tools.map((tool) => tool.name).sort()).toEqual(
      readTools.map((tool) => tool.name).sort(),
    );
    const modernCalled = await modern.callTool({ name: 'get_preferences', arguments: {} });
    expect(modernCalled.isError).not.toBe(true);
    expect(modernCalled.structuredContent).toEqual(called.structuredContent);
    await modern.close();

    // 7. Refresh: rotated, and a retry inside 30 s gets the same answer.
    const refresh = () =>
      authPost(
        new Request(`${ORIGIN}/api/auth/oauth2/token`, {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
            'x-forwarded-for': '192.0.2.10',
          },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: tokens.refresh_token ?? '',
            client_id: clientInformation.client_id,
            resource: `${ORIGIN}/mcp`,
          }),
        }),
      );
    const first = (await (await refresh()).json()) as {
      access_token: string;
      refresh_token: string;
    };
    expect(first.refresh_token).not.toBe(tokens.refresh_token);
    const replay = (await (await refresh()).json()) as { refresh_token: string };
    expect(replay.refresh_token).toBe(first.refresh_token);

    // 8. Revoke in Profile: the next call fails.
    await revokeConnector(session.userId, clientInformation.client_id);
    await expect(client.listTools(undefined, { cacheMode: 'bypass' })).rejects.toThrow();
    await client.close();
  });
});
