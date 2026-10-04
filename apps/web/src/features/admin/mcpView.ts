import type { mcpAdminStats } from '../../server/mcp/connectors';
import type { Resolved } from '../../server/settings/resolve';

/** Admin › MCP (§17.4.3): a sub-navigation entry of its own, after Impostazioni. */
export const MCP_ADMIN_PATH = '/admin/mcp';

export type McpStats = Awaited<ReturnType<typeof mcpAdminStats>>;

/** What the inline confirmation says before switching off (Decision 13). */
export type OffWarning = { kind: 'none' } | { kind: 'some'; users: number; connectors: number };

export function offWarning(stats: McpStats): OffWarning {
  if (stats.connectorsAuthorized === 0) return { kind: 'none' };
  return { kind: 'some', users: stats.usersWithConnectors, connectors: stats.connectorsAuthorized };
}

/** `MCP_ENABLED=false` when the environment locks the switch; `null` when the panel decides. */
export function lockedVariable(setting: Resolved<boolean>): string | null {
  if (setting.source !== 'env') return null;
  return `${setting.envVar ?? 'MCP_ENABLED'}=${String(setting.value)}`;
}

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * MCP clients refuse to authorize over plain `http` anywhere but on the same machine (§17.4.4):
 * true when `PUBLIC_URL` is such an address, so the page can say so.
 */
export function insecurePublicUrl(publicUrl: string): boolean {
  const url = new URL(publicUrl);
  if (url.protocol === 'https:') return false;
  return !LOOPBACK.has(url.hostname);
}
