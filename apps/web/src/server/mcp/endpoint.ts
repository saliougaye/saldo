import type { ToolScope } from '@saldo/core';
import { writeTools } from '@saldo/core';
import { getDb } from '../db/client';
import { env } from '../env';
import { log, ms, shortId } from '../log';
import { mcpEnabled } from '../settings/serverSettings';
import { loadUserData } from '../userData/load';
import { todayFor } from '../userData/today';
import { bearerToken, hashOAuthToken } from './oauthToken';
import { type FixedWindowLimiter, mcpRequestLimiter } from './rateLimit';
import { buildMcpServer } from './server';
import { bearerChallenge, verifyMcpRequest } from './token';
import { MCP_MAX_BODY_BYTES, serveMcpExchange } from './transport';
import type { AnyWriteToolHandler } from './types';
import { mcpResourceUrl, webAppLinks } from './urls';
import { recordMcpUsage } from './usage';
import { writeToolHandlers } from './writeTools';

export interface McpEndpointDeps {
  writeHandlers: readonly AnyWriteToolHandler[];
  now: () => Date;
  limiter: FixedWindowLimiter;
}

const defaults: McpEndpointDeps = {
  writeHandlers: writeToolHandlers,
  now: () => new Date(),
  limiter: mcpRequestLimiter,
};

const jsonRpcError = (id: unknown, code: number, message: string, status: number, data?: unknown) =>
  Response.json(
    {
      jsonrpc: '2.0',
      id: id ?? null,
      error: data === undefined ? { code, message } : { code, message, data },
    },
    { status },
  );

function declaredTooLarge(request: Request): boolean {
  const declared = Number(request.headers.get('content-length') ?? Number.NaN);
  return Number.isFinite(declared) && declared > MCP_MAX_BODY_BYTES;
}

function parseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

/** The `tools/call` messages of a body (one message, or a 2025-03 batch), with their ids. */
export function toolCalls(body: unknown): Array<{ id: unknown; name: string }> {
  const messages: unknown[] = Array.isArray(body) ? body : [body];
  const calls: Array<{ id: unknown; name: string }> = [];
  for (const message of messages) {
    if (typeof message !== 'object' || message === null) continue;
    if (Reflect.get(message, 'method') !== 'tools/call') continue;
    const params: unknown = Reflect.get(message, 'params');
    const name =
      typeof params === 'object' && params !== null ? Reflect.get(params, 'name') : undefined;
    if (typeof name === 'string') calls.push({ id: Reflect.get(message, 'id'), name });
  }
  return calls;
}

/** Decision 12: HTTP 403 with the step-up challenge, and a JSON-RPC error saying `insufficient_scope`. */
function insufficientScope(id: unknown, required: ToolScope): Response {
  return Response.json(
    {
      jsonrpc: '2.0',
      id: id ?? null,
      error: { code: -32600, message: 'insufficient_scope', data: { required } },
    },
    {
      status: 403,
      headers: {
        'www-authenticate': bearerChallenge({ error: 'insufficient_scope', scope: 'read write' }),
      },
    },
  );
}

/**
 * `POST /mcp` (§17.4.2), in decision 15's order. The route is thin: authenticate → `loadUserData` and
 * `todayFor` → build the server → answer. The token is never logged; the AuthInfo handed to the SDK
 * carries its hash.
 */
export async function serveMcp(
  request: Request,
  deps: McpEndpointDeps = defaults,
): Promise<Response> {
  const startedAt = Date.now();
  try {
    if (!(await mcpEnabled(getDb()))) return Response.json({ error: 'not_found' }, { status: 404 });
    if (request.method !== 'POST')
      return new Response(null, { status: 405, headers: { allow: 'POST' } });
    if (declaredTooLarge(request))
      return Response.json({ error: 'payload_too_large' }, { status: 413 });

    const verified = await verifyMcpRequest(request);
    if (!verified.ok) return verified.response;
    const { principal } = verified;
    const now = deps.now();
    const tokenHash = hashOAuthToken(bearerToken(request) ?? '');
    const limit = deps.limiter.allow(tokenHash, now.getTime());
    if (!limit.allowed) {
      return Response.json(
        { error: 'rate_limited' },
        { status: 429, headers: { 'retry-after': String(limit.retryAfterSeconds) } },
      );
    }

    const text = await request.text();
    if (Buffer.byteLength(text, 'utf8') > MCP_MAX_BODY_BYTES) {
      return Response.json({ error: 'payload_too_large' }, { status: 413 });
    }
    const parsed = parseJson(text);
    if (!parsed.ok) return jsonRpcError(null, -32700, 'Parse error', 400);

    if (!principal.scopes.includes('write')) {
      const writeNames = new Set([
        ...writeTools.map((tool) => tool.name),
        ...deps.writeHandlers.map((handler) => handler.spec.name),
      ]);
      const blocked = toolCalls(parsed.value).find((call) => writeNames.has(call.name));
      if (blocked !== undefined) return insufficientScope(blocked.id, 'write');
    }

    recordMcpUsage(principal.userId, principal.clientId, now);
    const data = await loadUserData(principal.userId);
    const ctx = { ...todayFor(data.settings, env().defaultTimeZone, now), webApp: webAppLinks() };
    const server = buildMcpServer({ data, ctx, principal, writeHandlers: deps.writeHandlers });
    const response = await serveMcpExchange(server, request, parsed.value, {
      token: tokenHash,
      clientId: principal.clientId,
      scopes: principal.scopes,
      resource: new URL(mcpResourceUrl()),
    });
    log('mcp', 'request served', {
      user: shortId(principal.userId),
      client: shortId(principal.clientId),
      status: response.status,
      took: ms(startedAt),
    });
    return response;
  } catch (error) {
    // Infrastructure only (database, …): tool failures never reach here. The name, not the message.
    log('mcp', 'request failed', { kind: error instanceof Error ? error.name : 'unknown' });
    return jsonRpcError(null, -32603, 'Internal error', 500);
  }
}
