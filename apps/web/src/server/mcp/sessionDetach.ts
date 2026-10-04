import type { BetterAuthPlugin } from 'better-auth';
import { createAuthMiddleware } from 'better-auth/api';
import { eq } from 'drizzle-orm';
import { oauthAccessToken, oauthRefreshToken } from '../db/schema';
import type { ServerDatabase } from '../db/types';
import { hashOAuthToken } from './oauthToken';

/**
 * Decision 4: an MCP client must not stop when its user signs out of the web (or when that browser
 * session lapses). The plugin records the browser session a code was issued in on every token it
 * mints, and on `session.delete` it revokes all of them (its back-channel logout plan, installed
 * unconditionally). Saldo has no use for that link — no OpenID Connect, no `sid`, no back-channel
 * logout — so right after `/oauth2/token` answers, the tokens it just issued are detached from the
 * session. A refresh carries the refresh token's (now empty) session over, so the link never returns.
 */
export function mcpTokensOutliveSessions(db: ServerDatabase) {
  return {
    id: 'saldo-mcp-tokens-outlive-sessions',
    hooks: {
      after: [
        {
          matcher: (context: { path?: string }) => context.path === '/oauth2/token',
          handler: createAuthMiddleware(async (ctx) => {
            const returned: unknown = ctx.context.returned;
            if (typeof returned !== 'object' || returned === null) return;
            const access: unknown = Reflect.get(returned, 'access_token');
            const refresh: unknown = Reflect.get(returned, 'refresh_token');
            if (typeof access === 'string') {
              await db
                .update(oauthAccessToken)
                .set({ sessionId: null })
                .where(eq(oauthAccessToken.token, hashOAuthToken(access)));
            }
            if (typeof refresh === 'string') {
              await db
                .update(oauthRefreshToken)
                .set({ sessionId: null })
                .where(eq(oauthRefreshToken.token, hashOAuthToken(refresh)));
            }
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
}
