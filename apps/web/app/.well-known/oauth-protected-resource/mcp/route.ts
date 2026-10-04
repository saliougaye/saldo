import { protectedResourceMetadataResponse } from '../../../../src/server/mcp/discovery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The RFC 9728 path-aware form (`/.well-known/oauth-protected-resource/mcp`), same document. */
export function GET(): Promise<Response> {
  return protectedResourceMetadataResponse();
}
