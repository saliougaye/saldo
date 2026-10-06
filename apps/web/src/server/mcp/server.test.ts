import { emptyUserData, type ToolContext, type WriteToolSpec } from '@saldo/core';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { buildMcpServer } from './server';
import type { McpPrincipal } from './token';
import { serveMcpExchange } from './transport';
import { defineWriteToolHandler } from './types';

const data = emptyUserData();
const ctx: ToolContext = { today: '2026-10-03', timeZone: 'Europe/Rome' };
const reader: McpPrincipal = { userId: 'u-1', clientId: 'c-1', scopes: ['read'] };
const writer: McpPrincipal = { ...reader, scopes: ['read', 'write'] };

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
      ? { ok: false, message: 'Refused: no means no' }
      : { ok: true, value: { echoed: input.text } },
});
const thrower = defineWriteToolHandler({
  spec: { ...echoSpec, name: 'throw_test' },
  handle: async () => {
    throw new Error('boom');
  },
});

const LEGACY_HEADERS = {
  'content-type': 'application/json',
  accept: 'application/json, text/event-stream',
  'mcp-protocol-version': '2025-11-25',
};

async function rpc(principal: McpPrincipal, method: string, params: unknown = {}) {
  const body = { jsonrpc: '2.0', id: 1, method, params };
  const request = new Request('http://localhost:3000/mcp', {
    method: 'POST',
    headers: LEGACY_HEADERS,
    body: JSON.stringify(body),
  });
  const server = buildMcpServer({ data, ctx, principal, writeHandlers: [echo, thrower] });
  const response = await serveMcpExchange(server, request, body, {
    token: 'hash',
    clientId: principal.clientId,
    scopes: principal.scopes,
  });
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('application/json');
  return (await response.json()) as {
    result?: Record<string, unknown>;
    error?: { message: string };
  };
}

describe('buildMcpServer', () => {
  it('turns invalid input into a tool error, not a protocol error', async () => {
    const { result, error } = await rpc(reader, 'tools/call', {
      name: 'list_transactions',
      arguments: { limit: 100_000 },
    });
    expect(error).toBeUndefined();
    expect(result?.isError).toBe(true);
  });

  it('answers a write tool, its refusal as a tool error, and a throw as a tool error', async () => {
    const ok = await rpc(writer, 'tools/call', { name: 'echo_test', arguments: { text: 'hi' } });
    expect(ok.result?.structuredContent).toEqual({ echoed: 'hi' });
    const refused = await rpc(writer, 'tools/call', {
      name: 'echo_test',
      arguments: { text: 'no' },
    });
    expect(refused.result).toMatchObject({
      isError: true,
      content: [{ type: 'text', text: 'Refused: no means no' }],
    });
    const thrown = await rpc(writer, 'tools/call', {
      name: 'throw_test',
      arguments: { text: 'x' },
    });
    expect(thrown.result?.isError).toBe(true);
  });
});
