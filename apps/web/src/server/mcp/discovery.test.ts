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
  it('answers 404 while MCP is off', async () => {
    await switchOff();
    expect((await protectedResourceMetadataResponse()).status).toBe(404);
  });
});

describe('/.well-known/oauth-authorization-server', () => {
  const request = () => new Request('http://localhost:3000/.well-known/oauth-authorization-server');

  it('answers 404 while MCP is off, here and under the issuer path', async () => {
    await switchOff();
    expect((await authorizationServerMetadataResponse(request())).status).toBe(404);
    const underIssuer = await authGet(
      new Request('http://localhost:3000/api/auth/.well-known/oauth-authorization-server'),
    );
    expect(underIssuer.status).toBe(404);
  });
});
