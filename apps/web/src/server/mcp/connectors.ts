import { and, count, countDistinct, desc, eq, gte } from 'drizzle-orm';
import { getDb } from '../db/client';
import {
  mcpUsage,
  oauthAccessToken,
  oauthClient,
  oauthConsent,
  oauthRefreshToken,
  user,
} from '../db/schema';
import { log, shortId } from '../log';
// TODO(0.4a-1 merge): import from @saldo/core
import type { ToolScope } from './toolScope';
import { forgetMcpUsage } from './usage';

/** One row of «Autorizzate» on `/profile/connectors` (§17.4.3). */
export type Connector = {
  clientId: string;
  /** The name the client registered itself with; its id when it gave none. */
  name: string;
  redirectHost: string;
  /** Only the granted tool scopes («Lettura», «Scrittura»); `offline_access` is not shown. */
  scopes: ToolScope[];
  authorizedAt: Date;
  lastUsedAt: Date | null;
  calls: number;
};

const toolScopes = (scopes: readonly string[]): ToolScope[] =>
  scopes.filter((scope): scope is ToolScope => scope === 'read' || scope === 'write');

function hostOf(uris: readonly string[]): string {
  const first = uris[0];
  return first !== undefined && URL.canParse(first) ? new URL(first).host : '';
}

/** The user's consents, newest first, with what `mcp_usage` knows. */
export async function listConnectors(userId: string): Promise<Connector[]> {
  const rows = await getDb()
    .select({
      clientId: oauthConsent.clientId,
      scopes: oauthConsent.scopes,
      authorizedAt: oauthConsent.createdAt,
      name: oauthClient.name,
      redirectUris: oauthClient.redirectUris,
      lastUsedAt: mcpUsage.lastUsedAt,
      calls: mcpUsage.calls,
    })
    .from(oauthConsent)
    .innerJoin(oauthClient, eq(oauthClient.clientId, oauthConsent.clientId))
    .leftJoin(
      mcpUsage,
      and(eq(mcpUsage.clientId, oauthConsent.clientId), eq(mcpUsage.userId, oauthConsent.userId)),
    )
    .where(eq(oauthConsent.userId, userId))
    .orderBy(desc(oauthConsent.createdAt));
  return rows.map((row) => ({
    clientId: row.clientId,
    name: row.name ?? row.clientId,
    redirectHost: hostOf(row.redirectUris),
    scopes: toolScopes(row.scopes),
    authorizedAt: row.authorizedAt,
    lastUsedAt: row.lastUsedAt,
    calls: row.calls ?? 0,
  }));
}

/**
 * «Revoca accesso» (§17.4.1): the pair's consent and every token, in one transaction, so the client's
 * next request is a 401 and it has to be authorized again. Its usage goes too.
 */
export async function revokeConnector(userId: string, clientId: string): Promise<void> {
  await getDb().transaction(async (tx) => {
    await tx
      .delete(oauthAccessToken)
      .where(and(eq(oauthAccessToken.userId, userId), eq(oauthAccessToken.clientId, clientId)));
    await tx
      .delete(oauthRefreshToken)
      .where(and(eq(oauthRefreshToken.userId, userId), eq(oauthRefreshToken.clientId, clientId)));
    await tx
      .delete(oauthConsent)
      .where(and(eq(oauthConsent.userId, userId), eq(oauthConsent.clientId, clientId)));
    await tx
      .delete(mcpUsage)
      .where(and(eq(mcpUsage.userId, userId), eq(mcpUsage.clientId, clientId)));
  });
  forgetMcpUsage(userId, clientId);
  log('mcp', 'app revoked', { user: shortId(userId), client: shortId(clientId) });
}

const WEEK_MS = 7 * 86_400_000;

/** `/admin/mcp`'s three numbers (§17.4.3): aggregates only, no names. */
export async function mcpAdminStats(now: Date): Promise<{
  usersWithConnectors: number;
  totalUsers: number;
  connectorsAuthorized: number;
  connectorsUsedLast7Days: number;
}> {
  const db = getDb();
  const [users] = await db.select({ n: count() }).from(user);
  const [consents] = await db
    .select({ connectors: count(), users: countDistinct(oauthConsent.userId) })
    .from(oauthConsent);
  const [used] = await db
    .select({ n: count() })
    .from(mcpUsage)
    .innerJoin(
      oauthConsent,
      and(eq(oauthConsent.userId, mcpUsage.userId), eq(oauthConsent.clientId, mcpUsage.clientId)),
    )
    .where(gte(mcpUsage.lastUsedAt, new Date(now.getTime() - WEEK_MS)));
  return {
    usersWithConnectors: consents?.users ?? 0,
    totalUsers: users?.n ?? 0,
    connectorsAuthorized: consents?.connectors ?? 0,
    connectorsUsedLast7Days: used?.n ?? 0,
  };
}
