import { serveMcp } from '../../src/server/mcp/endpoint';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * §17.4.2: `POST {PUBLIC_URL}/mcp`, Streamable HTTP, stateless, JSON responses. GET and DELETE answer
 * 405 (404 while MCP is off, like everything else here). The whole flow is `serveMcp`.
 */
export function POST(request: Request): Promise<Response> {
  return serveMcp(request);
}

export function GET(request: Request): Promise<Response> {
  return serveMcp(request);
}

export function DELETE(request: Request): Promise<Response> {
  return serveMcp(request);
}
