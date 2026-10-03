import {
  type AuthInfo,
  createMcpHandler,
  isLegacyRequest,
  type McpHttpHandler,
  type McpServer,
  WebStandardStreamableHTTPServerTransport,
} from '@modelcontextprotocol/server';
import { log } from '../log';

/** §17.4.2: body limit of `/mcp`. */
export const MCP_MAX_BODY_BYTES = 1024 * 1024;

/** The server built for each in-flight 2026-07-28 request, found by the shared handler's factory. */
const servers = new WeakMap<Request, McpServer>();
let modern: McpHttpHandler | null = null;

/**
 * Created on first use, not at import: `next build` imports the route, and the handler logs a
 * one-line warning about `json` mode when it is created.
 */
function modernHandler(): McpHttpHandler {
  modern ??= createMcpHandler(
    ({ requestInfo }) => {
      const server = requestInfo === undefined ? undefined : servers.get(requestInfo);
      if (server === undefined) throw new Error('No MCP server was built for this request');
      return server;
    },
    {
      legacy: 'reject',
      responseMode: 'json',
      maxRequestBodySize: MCP_MAX_BODY_BYTES,
      onerror: (error) => log('mcp', 'exchange refused', { kind: error.name }),
    },
  );
  return modern;
}

/**
 * Serves one already-authenticated exchange (decision 13). The body was read once by the route and is
 * handed over parsed. 2025-era clients (`initialize`, no per-request envelope) get a stateless
 * transport with JSON responses; 2026-07-28 clients go through `createMcpHandler` in `json` mode.
 * Either way the server instance serves this request and is dropped.
 */
export async function serveMcpExchange(
  server: McpServer,
  request: Request,
  body: unknown,
  authInfo: AuthInfo,
): Promise<Response> {
  if (await isLegacyRequest(request, body, { maxRequestBodySize: MCP_MAX_BODY_BYTES })) {
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
      maxRequestBodySize: MCP_MAX_BODY_BYTES,
    });
    await server.connect(transport);
    try {
      return await transport.handleRequest(request, { parsedBody: body, authInfo });
    } finally {
      await server.close();
    }
  }
  servers.set(request, server);
  try {
    return await modernHandler().fetch(request, { parsedBody: body, authInfo });
  } finally {
    servers.delete(request);
  }
}
