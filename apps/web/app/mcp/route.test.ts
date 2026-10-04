import type { WriteToolSpec } from '@saldo/core';
import { readTools } from '@saldo/core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { settleBackground } from '../../src/server/background';
import { mcpUsage, serverSettings } from '../../src/server/db/schema';
import { revokeConnector } from '../../src/server/mcp/connectors';
import { type McpEndpointDeps, serveMcp } from '../../src/server/mcp/endpoint';
import { createFixedWindowLimiter } from '../../src/server/mcp/rateLimit';
import { defineWriteToolHandler } from '../../src/server/mcp/types';
import { resetMcpUsageForTests } from '../../src/server/mcp/usage';
import { createTestDatabase, type TestDatabase } from '../../src/server/test/harness';
import {
  createTestClient,
  grantTestConsent,
  issueTestAccessToken,
} from '../../src/server/test/oauth';
import { createTestSession } from '../../src/server/test/session';
import { DELETE, GET, POST } from './route';

let harness: TestDatabase;

beforeAll(async () => {
  harness = await createTestDatabase();
});

beforeEach(() => {
  resetMcpUsageForTests();
});

afterEach(async () => {
  await settleBackground();
  await harness.reset();
});

afterAll(async () => {
  await harness.close();
});

const URL_MCP = 'http://localhost:3000/mcp';
const CHALLENGE =
  'Bearer resource_metadata="http://localhost:3000/.well-known/oauth-protected-resource"';
const HEADERS = {
  'content-type': 'application/json',
  accept: 'application/json, text/event-stream',
  'mcp-protocol-version': '2025-11-25',
};

const echoSpec: WriteToolSpec<{ text: string }, { echoed: string }> = {
  name: 'echo_test',
  title: 'Echo',
  description: 'Test-only write tool.',
  scope: 'write',
  input: z.object({ text: z.string() }),
  output: z.object({ echoed: z.string() }),
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};
const echo = defineWriteToolHandler({
  spec: echoSpec,
  handle: async (_principal, input) =>
    input.text === 'no'
      ? { ok: false, message: 'Refused' }
      : { ok: true, value: { echoed: input.text } },
});

function deps(overrides: Partial<McpEndpointDeps> = {}): McpEndpointDeps {
  return {
    writeHandlers: [echo],
    now: () => new Date(),
    limiter: createFixedWindowLimiter({ max: 120, windowMs: 60_000 }),
    ...overrides,
  };
}

function rpcRequest(
  bearer: string | null,
  method: string,
  params: unknown = {},
  id: number | string = 1,
) {
  return new Request(URL_MCP, {
    method: 'POST',
    headers: { ...HEADERS, ...(bearer === null ? {} : { authorization: bearer }) },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });
}

async function connected(scopes: string[] = ['read', 'offline_access']) {
  const { userId } = await createTestSession(harness.db);
  const { clientId } = await createTestClient(harness.db);
  await grantTestConsent(harness.db, { userId, clientId, scopes });
  const { bearer } = await issueTestAccessToken(harness.db, { userId, clientId, scopes });
  return { userId, clientId, bearer };
}

const switchOff = () =>
  harness.db
    .insert(serverSettings)
    .values({ key: 'mcp.enabled', value: false, updatedAt: new Date(), updatedBy: null });

describe('/mcp, the HTTP surface', () => {
  it('answers GET and DELETE with 405', async () => {
    for (const handler of [GET, DELETE]) {
      const response = await handler(new Request(URL_MCP, { method: 'GET' }));
      expect(response.status).toBe(405);
      expect(response.headers.get('allow')).toBe('POST');
    }
  });

  it('answers 401 with the challenge when there is no token', async () => {
    const response = await POST(rpcRequest(null, 'tools/list'));
    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBe(CHALLENGE);
  });

  it('refuses a token in the query string', async () => {
    const { bearer } = await connected();
    const token = bearer.replace('Bearer ', '');
    const response = await POST(
      new Request(`${URL_MCP}?access_token=${token}`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
      }),
    );
    expect(response.status).toBe(400);
  });

  it('refuses a body over 1 MB, declared or not', async () => {
    const { bearer } = await connected();
    const declared = await serveMcp(
      new Request(URL_MCP, {
        method: 'POST',
        headers: { ...HEADERS, authorization: bearer, 'content-length': String(2 * 1024 * 1024) },
        body: '{}',
      }),
      deps(),
    );
    expect(declared.status).toBe(413);
    const measured = await serveMcp(
      new Request(URL_MCP, {
        method: 'POST',
        headers: { ...HEADERS, authorization: bearer },
        body: JSON.stringify({ padding: 'x'.repeat(1024 * 1024) }),
      }),
      deps(),
    );
    expect(measured.status).toBe(413);
  });

  it('answers a body that is not JSON with a JSON-RPC parse error', async () => {
    const { bearer } = await connected();
    const response = await serveMcp(
      new Request(URL_MCP, {
        method: 'POST',
        headers: { ...HEADERS, authorization: bearer },
        body: '{',
      }),
      deps(),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: -32700 } });
  });

  it('allows 120 requests a minute per token, then 429 with Retry-After', async () => {
    const { bearer } = await connected();
    const limited = deps({ limiter: createFixedWindowLimiter({ max: 2, windowMs: 60_000 }) });
    expect((await serveMcp(rpcRequest(bearer, 'tools/list'), limited)).status).toBe(200);
    expect((await serveMcp(rpcRequest(bearer, 'tools/list'), limited)).status).toBe(200);
    const third = await serveMcp(rpcRequest(bearer, 'tools/list'), limited);
    expect(third.status).toBe(429);
    expect(Number(third.headers.get('retry-after'))).toBeGreaterThan(0);
  });
});

describe('/mcp, the tools', () => {
  it('lists the read tools and answers one, recording the use', async () => {
    const { userId, clientId, bearer } = await connected();
    const listed = await serveMcp(rpcRequest(bearer, 'tools/list'), deps());
    expect(listed.status).toBe(200);
    const { result } = (await listed.json()) as { result: { tools: Array<{ name: string }> } };
    expect(result.tools.map((tool) => tool.name).sort()).toEqual(
      readTools.map((tool) => tool.name).sort(),
    );

    const called = await serveMcp(
      rpcRequest(bearer, 'tools/call', { name: 'get_preferences', arguments: {} }, 2),
      deps(),
    );
    const body = (await called.json()) as {
      result: { structuredContent: unknown; content: Array<{ text: string }>; isError?: boolean };
    };
    expect(body.result.isError).not.toBe(true);
    expect(JSON.parse(body.result.content[0]?.text ?? 'null')).toEqual(
      body.result.structuredContent,
    );
    expect(body.result.structuredContent).toMatchObject({
      webApp: {
        url: 'http://localhost:3000',
        transaction: 'http://localhost:3000/transactions?t={id}',
      },
    });

    await settleBackground();
    expect(await harness.db.select().from(mcpUsage)).toMatchObject([
      { userId, clientId, calls: 1 },
    ]);
  });

  it('refuses a write tool to a read token with 403 insufficient_scope', async () => {
    const { bearer } = await connected();
    const response = await serveMcp(
      rpcRequest(bearer, 'tools/call', { name: 'echo_test', arguments: { text: 'hi' } }, 7),
      deps(),
    );
    expect(response.status).toBe(403);
    expect(response.headers.get('www-authenticate')).toBe(
      'Bearer error="insufficient_scope", scope="read write", resource_metadata="http://localhost:3000/.well-known/oauth-protected-resource"',
    );
    expect(await response.json()).toEqual({
      jsonrpc: '2.0',
      id: 7,
      error: { code: -32600, message: 'insufficient_scope', data: { required: 'write' } },
    });
  });

  it('refuses each of the catalogue write tools to a read token, before any write', async () => {
    const { bearer } = await connected();
    const response = await serveMcp(
      rpcRequest(
        bearer,
        'tools/call',
        {
          name: 'save_transaction',
          arguments: { kind: 'expense', amountMinor: 100, accountId: 'a', categoryId: 'c' },
        },
        8,
      ),
      deps(),
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      jsonrpc: '2.0',
      id: 8,
      error: { code: -32600, message: 'insufficient_scope', data: { required: 'write' } },
    });
  });

  it('runs a write tool for a write token, and answers its refusal as a tool error', async () => {
    const { bearer } = await connected(['read', 'write', 'offline_access']);
    const ok = await serveMcp(
      rpcRequest(bearer, 'tools/call', { name: 'echo_test', arguments: { text: 'hi' } }),
      deps(),
    );
    expect(
      ((await ok.json()) as { result: { structuredContent: unknown } }).result.structuredContent,
    ).toEqual({
      echoed: 'hi',
    });
    const refused = await serveMcp(
      rpcRequest(bearer, 'tools/call', { name: 'echo_test', arguments: { text: 'no' } }),
      deps(),
    );
    expect(refused.status).toBe(200);
    expect(((await refused.json()) as { result: { isError: boolean } }).result.isError).toBe(true);
  });
});

describe('/mcp, revocation and the switch', () => {
  it('turns the next call into a 401 once the app is revoked', async () => {
    const { userId, clientId, bearer } = await connected();
    expect((await POST(rpcRequest(bearer, 'tools/list'))).status).toBe(200);
    await revokeConnector(userId, clientId);
    const response = await POST(rpcRequest(bearer, 'tools/list'));
    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toContain('resource_metadata=');
  });

  it('answers 404 to everything while off, and works again when back on', async () => {
    const { bearer } = await connected();
    await switchOff();
    expect((await POST(rpcRequest(bearer, 'tools/list'))).status).toBe(404);
    expect((await GET(new Request(URL_MCP))).status).toBe(404);
    await harness.db.delete(serverSettings);
    expect((await POST(rpcRequest(bearer, 'tools/list'))).status).toBe(200);
  });

  it('refuses an expired token', async () => {
    const { userId } = await createTestSession(harness.db);
    const { clientId } = await createTestClient(harness.db);
    const { bearer } = await issueTestAccessToken(harness.db, {
      userId,
      clientId,
      expiresAt: new Date(Date.now() - 1000),
    });
    expect((await POST(rpcRequest(bearer, 'tools/list'))).status).toBe(401);
  });
});
