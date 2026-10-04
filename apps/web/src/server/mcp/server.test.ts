import {
  assistantInstructions,
  emptyUserData,
  readTools,
  type ToolContext,
  type WriteToolSpec,
} from '@saldo/core';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { buildMcpServer } from './server';
import type { McpPrincipal } from './token';
import { MCP_MAX_BODY_BYTES, serveMcpExchange } from './transport';
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

const INIT = {
  protocolVersion: '2025-11-25',
  capabilities: {},
  clientInfo: { name: 'test', version: '1.0.0' },
};

describe('buildMcpServer', () => {
  it('sends the core instructions in initialize, as «saldo»', async () => {
    const { result } = await rpc(reader, 'initialize', INIT);
    expect(result?.instructions).toBe(assistantInstructions(data, ctx));
    expect(result?.serverInfo).toMatchObject({ name: 'saldo' });
  });

  it('lists the read tools to a read token, and no write tool', async () => {
    const { result } = await rpc(reader, 'tools/list');
    const tools = (result?.tools ?? []) as Array<{
      name: string;
      annotations?: Record<string, unknown>;
    }>;
    expect(tools.map((tool) => tool.name).sort()).toEqual(
      readTools.map((tool) => tool.name).sort(),
    );
    expect(tools.every((tool) => tool.annotations?.openWorldHint === false)).toBe(true);
  });

  it('adds the write tools for a write token', async () => {
    const { result } = await rpc(writer, 'tools/list');
    const names = ((result?.tools ?? []) as Array<{ name: string }>).map((tool) => tool.name);
    expect(names).toContain('echo_test');
    expect(names).toContain('throw_test');
  });

  it('answers a read tool with structuredContent and the same JSON as text', async () => {
    const { result } = await rpc(reader, 'tools/call', { name: 'get_preferences', arguments: {} });
    expect(result?.isError).not.toBe(true);
    const content = result?.content as Array<{ type: string; text: string }>;
    expect(content[0]?.type).toBe('text');
    expect(JSON.parse(content[0]?.text ?? 'null')).toEqual(result?.structuredContent);
  });

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

  it('keeps the body limit at 1 MB', () => {
    expect(MCP_MAX_BODY_BYTES).toBe(1_048_576);
  });
});
