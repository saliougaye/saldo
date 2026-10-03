import { oauthProviderAuthServerMetadata } from '@better-auth/oauth-provider';
import { auth } from '../auth/auth';
import { getDb } from '../db/client';
import { env } from '../env';
import { mcpEnabled } from '../settings/serverSettings';
import { mcpResourceUrl, OAUTH_SCOPES, oauthIssuer } from './urls';

const notFound = () => Response.json({ error: 'not_found' }, { status: 404 });

/**
 * RFC 9728 (§17.4.1). `scopes_supported` carries `offline_access` so that clients, which ask for what
 * this document lists when the 401 challenge names no scope, also get a refresh token.
 */
export function protectedResourceMetadata(publicUrl: string = env().publicUrl) {
  return {
    resource: mcpResourceUrl(publicUrl),
    authorization_servers: [oauthIssuer(publicUrl)],
    scopes_supported: [...OAUTH_SCOPES],
    bearer_methods_supported: ['header'],
  };
}

export async function protectedResourceMetadataResponse(): Promise<Response> {
  if (!(await mcpEnabled(getDb()))) return notFound();
  return Response.json(protectedResourceMetadata(), {
    headers: { 'cache-control': 'public, max-age=15' },
  });
}

/** RFC 8414, the plugin's own document (issuer `{PUBLIC_URL}/api/auth`), 404 while MCP is off. */
export async function authorizationServerMetadataResponse(request: Request): Promise<Response> {
  if (!(await mcpEnabled(getDb()))) return notFound();
  return oauthProviderAuthServerMetadata(auth())(request);
}
