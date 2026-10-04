import { authorizationServerMetadataResponse } from '../../../src/server/mcp/discovery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** §17.4.1, RFC 8414 at the root, as the spec names it. */
export function GET(request: Request): Promise<Response> {
  return authorizationServerMetadataResponse(request);
}
