import { protectedResourceMetadataResponse } from '../../../src/server/mcp/discovery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** §17.4.1, RFC 9728: where an MCP client learns which authorization server guards `/mcp`. */
export function GET(): Promise<Response> {
  return protectedResourceMetadataResponse();
}
