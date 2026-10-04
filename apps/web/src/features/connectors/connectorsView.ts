import { diffDays, type ToolScope } from '@saldo/core';
import { localDateOf, wallClock } from '@saldo/i18n';
import type { Connector } from '../../server/mcp/connectors';

/**
 * Profilo › Connettori (§17.4.3). Server-only: it reads the clock through `@saldo/i18n`'s root,
 * which carries the catalogs — a client component gets what it needs from here as props.
 */
export const CONNECTORS_PATH = '/profile/connectors';

/** The parameter that carries the connector open in the panel: `?connector={clientId}`. */
export const CONNECTOR_PARAM = 'connector';

/** The two documents an MCP client reads to find the rest (RFC 9728, RFC 8414). */
export const PROTECTED_RESOURCE_PATH = '/.well-known/oauth-protected-resource';
export const AUTHORIZATION_SERVER_PATH = '/.well-known/oauth-authorization-server';

/** `{PUBLIC_URL}/mcp`, the resource every token is bound to (§17.4.1). */
export function mcpEndpoint(publicUrl: string): string {
  return `${publicUrl.replace(/\/+$/, '')}/mcp`;
}

/** The line Claude Code takes, exactly as §17.4.3 gives it. */
export function claudeCodeCommand(endpoint: string): string {
  return `claude mcp add --transport http saldo ${endpoint}`;
}

/** For a terminal with no browser: `mcp-remote` runs the OAuth flow on its behalf. */
export function mcpRemoteCommand(endpoint: string): string {
  return `npx mcp-remote ${endpoint}`;
}

/** The tabs under «Collega». */
export type ClientTab = 'claudeCode' | 'claude' | 'other';

const SCOPE_ORDER: readonly ToolScope[] = ['read', 'write'];

/** The granted scopes as chips read them: read before write, each once. */
export function orderedScopes(scopes: readonly ToolScope[]): ToolScope[] {
  return SCOPE_ORDER.filter((scope) => scopes.includes(scope));
}

/** The client's tile: the first character of the name it registered with (Decision 3). */
export function clientInitial(name: string): string {
  const first = Array.from(name.trim())[0];
  return first === undefined ? '?' : first.toLocaleUpperCase();
}

export type LastUsed =
  | { kind: 'never' }
  | { kind: 'today' }
  | { kind: 'yesterday' }
  | { kind: 'on'; iso: string };

/**
 * «Ultimo uso» in the user's zone (§17.1.5): today and yesterday by name, an older day as the
 * instant for the page to format. A zone `Intl` does not know reads as UTC, as `instantFormatter` does.
 */
export function lastUsed(at: Date | null, now: Date, timeZone: string): LastUsed {
  if (at === null) return { kind: 'never' };
  const day = wallClock(timeZone, at) ?? wallClock('UTC', at);
  const today = wallClock(timeZone, now) ?? wallClock('UTC', now);
  if (day === null || today === null) return { kind: 'on', iso: at.toISOString() };
  const ago = diffDays(localDateOf(day), localDateOf(today));
  if (ago === 0) return { kind: 'today' };
  if (ago === 1) return { kind: 'yesterday' };
  return { kind: 'on', iso: at.toISOString() };
}

/** The strings of `lastUsed` other than a date: «usato oggi» on a row, «oggi» beside «Ultimo uso». */
export const LAST_USED_KEYS = {
  row: {
    never: 'web.connectors.neverUsed',
    today: 'web.connectors.usedToday',
    yesterday: 'web.connectors.usedYesterday',
  },
  fact: {
    never: 'web.connectors.lastUsedNever',
    today: 'web.connectors.lastUsedToday',
    yesterday: 'web.connectors.lastUsedYesterday',
  },
} as const satisfies Record<'row' | 'fact', Record<Exclude<LastUsed['kind'], 'on'>, string>>;

export interface ConnectorRowView {
  clientId: string;
  /** As the client registered itself: shown, never translated. */
  name: string;
  initial: string;
  redirectHost: string;
  scopes: ToolScope[];
  authorizedIso: string;
  lastUsed: LastUsed;
  calls: number;
  /** The same page with this connector in the panel. */
  href: string;
  selected: boolean;
}

const usedAt = (connector: Connector): number | null =>
  connector.lastUsedAt === null ? null : connector.lastUsedAt.getTime();

/** One row per consent: the most recently used first, then the never used, newest authorization first. */
export function connectorRows(
  connectors: readonly Connector[],
  selectedId: string | null,
  now: Date,
  timeZone: string,
): ConnectorRowView[] {
  return [...connectors]
    .sort((a, b) => {
      const ua = usedAt(a);
      const ub = usedAt(b);
      if (ua !== ub) {
        if (ua === null) return 1;
        if (ub === null) return -1;
        return ub - ua;
      }
      return b.authorizedAt.getTime() - a.authorizedAt.getTime();
    })
    .map((connector) => ({
      clientId: connector.clientId,
      name: connector.name,
      initial: clientInitial(connector.name),
      redirectHost: connector.redirectHost,
      scopes: orderedScopes(connector.scopes),
      authorizedIso: connector.authorizedAt.toISOString(),
      lastUsed: lastUsed(connector.lastUsedAt, now, timeZone),
      calls: connector.calls,
      href: `${CONNECTORS_PATH}?${CONNECTOR_PARAM}=${encodeURIComponent(connector.clientId)}`,
      selected: connector.clientId === selectedId,
    }));
}

/** What replaces «Collega» while MCP is off (Decision 7); `null` while it is on. */
export type ConnectorsNotice = 'off' | 'offAdmin' | 'offAdminEnv' | null;

export function connectorsNotice(input: {
  enabled: boolean;
  lockedByEnv: boolean;
  admin: boolean;
}): ConnectorsNotice {
  if (input.enabled) return null;
  if (!input.admin) return 'off';
  return input.lockedByEnv ? 'offAdminEnv' : 'offAdmin';
}
