import { authorizationServerMetadataResponse } from '../../../../../src/server/mcp/discovery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** RFC 8414's path-insertion form for the issuer `{PUBLIC_URL}/api/auth`: what MCP clients compute. */
export function GET(request: Request): Promise<Response> {
  return authorizationServerMetadataResponse(request);
}
