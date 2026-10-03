import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from '../../../../src/server/auth/auth';
import { oauthGate } from '../../../../src/server/mcp/oauthGate';

export const runtime = 'nodejs';

/**
 * Every Better Auth endpoint — the passkey ceremonies, sessions, sign-out, the one-time token the
 * app exchanges, and (§17.4.1) the OAuth endpoints MCP clients use — is served from this one
 * catch-all. `oauthGate` decides first which OAuth paths exist and whether MCP is on.
 *
 * The instance is resolved per request rather than at module scope: `next build` imports this file
 * to collect page data, and building the instance there would read a configuration the build does
 * not have.
 */
const handlers = toNextJsHandler((request: Request) => auth().handler(request));

export async function GET(request: Request): Promise<Response> {
  return (await oauthGate(request)) ?? handlers.GET(request);
}

export async function POST(request: Request): Promise<Response> {
  return (await oauthGate(request)) ?? handlers.POST(request);
}
