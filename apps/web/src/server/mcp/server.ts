import { type CallToolResult, McpServer } from '@modelcontextprotocol/server';
import {
  type AnyReadTool,
  assistantInstructions,
  readTools,
  type ToolContext,
  type UserData,
} from '@saldo/core';
import { APP_VERSION } from '../version';
import type { McpPrincipal } from './token';
import type { AnyWriteToolHandler } from './types';

/** §17.4.2: `structuredContent`, and the same JSON as `content[0].text` for clients that read only text. */
export function toolResult(value: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value };
}

/** A refused write, readable by the model; never an exception, never a 500. */
export function toolError(message: string): CallToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

function registerReadTool(
  server: McpServer,
  tool: AnyReadTool,
  data: UserData,
  ctx: ToolContext,
): void {
  server.registerTool(
    tool.name,
    {
      title: tool.title,
      description: tool.description,
      inputSchema: tool.input,
      outputSchema: tool.output,
      annotations: tool.annotations,
    },
    async (input) => toolResult(tool.run(data, ctx, input)),
  );
}

function registerWriteTool(
  server: McpServer,
  handler: AnyWriteToolHandler,
  principal: McpPrincipal,
  ctx: ToolContext,
): void {
  const { spec } = handler;
  server.registerTool(
    spec.name,
    {
      title: spec.title,
      description: spec.description,
      inputSchema: spec.input,
      outputSchema: spec.output,
      annotations: spec.annotations,
    },
    async (input) => {
      const result = await handler.handle(principal, input, ctx);
      return result.ok ? toolResult(result.value) : toolError(result.message);
    },
  );
}

/**
 * One server per request (§17.4.2), from core's catalogue, holding this user's data and «today».
 * Tools are filtered by scope here, so a `read` token never even lists a write tool. The SDK
 * validates input and output against each tool's schemas and turns any error into an `isError`
 * result. Nothing to subscribe to: `listChanged` is off.
 */
export function buildMcpServer(args: {
  data: UserData;
  ctx: ToolContext;
  principal: McpPrincipal;
  writeHandlers: readonly AnyWriteToolHandler[];
}): McpServer {
  const { data, ctx, principal, writeHandlers } = args;
  const server = new McpServer(
    { name: 'saldo', version: APP_VERSION },
    {
      instructions: assistantInstructions(data, ctx),
      capabilities: { tools: { listChanged: false } },
    },
  );
  if (principal.scopes.includes('read')) {
    for (const tool of readTools) registerReadTool(server, tool, data, ctx);
  }
  if (principal.scopes.includes('write')) {
    for (const handler of writeHandlers) registerWriteTool(server, handler, principal, ctx);
  }
  return server;
}
