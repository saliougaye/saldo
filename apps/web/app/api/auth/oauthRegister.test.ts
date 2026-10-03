import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { oauthClient, serverSettings } from '../../../src/server/db/schema';
import { createTestDatabase, type TestDatabase } from '../../../src/server/test/harness';
import { GET, POST } from './[...all]/route';

/**
 * §17.4.1, through the real catch-all: dynamic client registration, its per-IP limit, Saldo's checks
 * on top of the plugin's, the switch, and the endpoints Saldo does not offer.
 */
let harness: TestDatabase;

beforeAll(async () => {
  harness = await createTestDatabase();
});

afterEach(async () => {
  await harness.reset();
});

afterAll(async () => {
  await harness.close();
});

const BASE = 'http://localhost:3000/api/auth';
let nextIp = 0;
/** Each test registers from its own address: the limit is one registration per minute per IP. */
const freshIp = () => `198.51.100.${++nextIp}`;

function register(body: unknown, ip: string = freshIp()): Promise<Response> {
  return POST(
    new Request(`${BASE}/oauth2/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
      body: JSON.stringify(body),
    }),
  );
}

const claudeCode = {
  client_name: 'Claude Code',
  redirect_uris: ['http://localhost:33418/callback'],
  grant_types: ['authorization_code', 'refresh_token'],
  response_types: ['code'],
  token_endpoint_auth_method: 'none',
};

describe('POST /api/auth/oauth2/register', () => {
  it('registers a public loopback client, with no secret, as native', async () => {
    const response = await register(claudeCode);
    expect(response.status).toBe(201);
    const body = (await response.json()) as Record<string, unknown>;
    expect(typeof body.client_id).toBe('string');
    expect(body.client_secret).toBeUndefined();
    const [row] = await harness.db
      .select()
      .from(oauthClient)
      .where(eq(oauthClient.clientId, String(body.client_id)));
    expect(row).toMatchObject({
      name: 'Claude Code',
      tokenEndpointAuthMethod: 'none',
      applicationType: 'native',
      redirectUris: ['http://localhost:33418/callback'],
      clientSecret: null,
    });
  });

  it('makes a client that names no auth method public too', async () => {
    const { token_endpoint_auth_method: _omitted, ...withoutMethod } = claudeCode;
    const response = await register(withoutMethod);
    expect(response.status).toBe(201);
    expect(((await response.json()) as Record<string, unknown>).client_secret).toBeUndefined();
  });

  it('allows one registration per minute per IP', async () => {
    expect((await register(claudeCode, '203.0.113.9')).status).toBe(201);
    expect((await register(claudeCode, '203.0.113.9')).status).toBe(429);
    expect((await register(claudeCode, '203.0.113.10')).status).toBe(201);
  });

  it.each(['http://example.com/cb', 'com.example.app:/cb', 'https://claude.ai/cb#x'])(
    'refuses the redirect %s',
    async (uri) => {
      const response = await register({ ...claudeCode, redirect_uris: [uri] });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: 'invalid_redirect_uri' });
      expect(await harness.db.select().from(oauthClient)).toEqual([]);
    },
  );

  it('refuses a confidential client', async () => {
    const response = await register({
      ...claudeCode,
      token_endpoint_auth_method: 'client_secret_post',
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'invalid_client_metadata' });
  });

  it('answers 404 while MCP is switched off, and stores nothing', async () => {
    await harness.db
      .insert(serverSettings)
      .values({ key: 'mcp.enabled', value: false, updatedAt: new Date(), updatedBy: null });
    expect((await register(claudeCode)).status).toBe(404);
    expect(await harness.db.select().from(oauthClient)).toEqual([]);
  });
});

describe('the endpoints Saldo does not offer', () => {
  it.each([
    ['GET', '/oauth2/get-clients'],
    ['POST', '/oauth2/create-client'],
    ['POST', '/oauth2/consent'],
    ['POST', '/oauth2/continue'],
    ['GET', '/oauth2/userinfo'],
    ['GET', '/oauth2/public-client'],
  ])('%s %s answers 404', async (method, path) => {
    const request = new Request(`${BASE}${path}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-forwarded-for': freshIp() },
      body: method === 'POST' ? '{}' : undefined,
    });
    const response = method === 'GET' ? await GET(request) : await POST(request);
    expect(response.status).toBe(404);
  });
});
