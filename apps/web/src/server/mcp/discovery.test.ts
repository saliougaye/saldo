import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { GET as authGet } from '../../../app/api/auth/[...all]/route';
import { serverSettings } from '../db/schema';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import {
  authorizationServerMetadataResponse,
  protectedResourceMetadataResponse,
} from './discovery';

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

const switchOff = () =>
  harness.db
    .insert(serverSettings)
    .values({ key: 'mcp.enabled', value: false, updatedAt: new Date(), updatedBy: null });

describe('/.well-known/oauth-protected-resource', () => {
  it('names the resource, its authorization server and the scopes', async () => {
    const response = await protectedResourceMetadataResponse();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      resource: 'http://localhost:3000/mcp',
      authorization_servers: ['http://localhost:3000/api/auth'],
      scopes_supported: ['read', 'write', 'offline_access'],
      bearer_methods_supported: ['header'],
    });
  });

  it('answers 404 while MCP is off', async () => {
    await switchOff();
    expect((await protectedResourceMetadataResponse()).status).toBe(404);
  });
});

describe('/.well-known/oauth-authorization-server', () => {
  const request = () => new Request('http://localhost:3000/.well-known/oauth-authorization-server');

  it('describes an OAuth 2.1 server for public clients with PKCE S256, no JWT', async () => {
    const response = await authorizationServerMetadataResponse(request());
    expect(response.status).toBe(200);
    const metadata = (await response.json()) as Record<string, unknown>;
    expect(metadata).toMatchObject({
      issuer: 'http://localhost:3000/api/auth',
      authorization_endpoint: 'http://localhost:3000/api/auth/oauth2/authorize',
      token_endpoint: 'http://localhost:3000/api/auth/oauth2/token',
      registration_endpoint: 'http://localhost:3000/api/auth/oauth2/register',
      revocation_endpoint: 'http://localhost:3000/api/auth/oauth2/revoke',
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      scopes_supported: ['read', 'write', 'offline_access'],
    });
    expect(metadata.token_endpoint_auth_methods_supported).toContain('none');
    expect(metadata.jwks_uri).toBeUndefined();
    expect(metadata.userinfo_endpoint).toBeUndefined();
  });

  it('answers 404 while MCP is off, here and under the issuer path', async () => {
    await switchOff();
    expect((await authorizationServerMetadataResponse(request())).status).toBe(404);
    const underIssuer = await authGet(
      new Request('http://localhost:3000/api/auth/.well-known/oauth-authorization-server'),
    );
    expect(underIssuer.status).toBe(404);
  });
});
