import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from '../../../../src/server/auth/auth';

export const runtime = 'nodejs';

/**
 * Every Better Auth endpoint — the passkey ceremonies, sessions, sign-out, the one-time token the
 * app exchanges — is served from this one catch-all.
 *
 * The instance is resolved per request rather than at module scope: `next build` imports this file
 * to collect page data, and building the instance there would read a configuration the build does
 * not have.
 */
export const { GET, POST } = toNextJsHandler((request: Request) => auth().handler(request));
