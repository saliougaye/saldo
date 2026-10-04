import { it as italian, makeTranslator } from '@saldo/i18n';
import { describe, expect, it } from 'vitest';
import type { Connector } from '../../server/mcp/connectors';
import {
  CONNECTORS_PATH,
  claudeCodeCommand,
  clientInitial,
  connectorRows,
  connectorsNotice,
  LAST_USED_KEYS,
  lastUsed,
  mcpEndpoint,
  mcpRemoteCommand,
  orderedScopes,
  PROTECTED_RESOURCE_PATH,
} from './connectorsView';

const connector = (over: Partial<Connector> = {}): Connector => ({
  clientId: 'c1',
  name: 'Claude Code',
  redirectHost: 'localhost',
  scopes: ['read', 'write'],
  authorizedAt: new Date('2026-10-01T08:00:00.000Z'),
  lastUsedAt: null,
  calls: 0,
  ...over,
});

/** Noon in Rome (CEST, UTC+2) on 3 October 2026. */
const NOW = new Date('2026-10-03T10:00:00.000Z');
const ROME = 'Europe/Rome';

describe('mcpEndpoint', () => {
  it('is PUBLIC_URL followed by /mcp, whatever trailing slash it came with', () => {
    expect(mcpEndpoint('https://saldo.example.com')).toBe('https://saldo.example.com/mcp');
    expect(mcpEndpoint('https://saldo.example.com/')).toBe('https://saldo.example.com/mcp');
  });
});

describe('the client lines', () => {
  it('writes the exact Claude Code and mcp-remote commands (§17.4.3)', () => {
    const endpoint = 'https://saldo.example.com/mcp';
    expect(claudeCodeCommand(endpoint)).toBe(
      'claude mcp add --transport http saldo https://saldo.example.com/mcp',
    );
    expect(mcpRemoteCommand(endpoint)).toBe('npx mcp-remote https://saldo.example.com/mcp');
    expect(PROTECTED_RESOURCE_PATH).toBe('/.well-known/oauth-protected-resource');
  });
});

describe('orderedScopes', () => {
  it('puts read before write and keeps each once', () => {
    expect(orderedScopes(['write', 'read'])).toEqual(['read', 'write']);
    expect(orderedScopes(['write', 'write'])).toEqual(['write']);
    expect(orderedScopes(['read'])).toEqual(['read']);
  });
});

describe('clientInitial', () => {
  it('is the first character of the name, upper case, emoji included', () => {
    expect(clientInitial('claude code')).toBe('C');
    expect(clientInitial('  éclair')).toBe('É');
    expect(clientInitial('😀 bot')).toBe('😀');
  });

  it('is a question mark for a name with nothing in it', () => {
    expect(clientInitial('   ')).toBe('?');
  });
});

describe('lastUsed', () => {
  it('is never for a connector that has not called yet', () => {
    expect(lastUsed(null, NOW, ROME)).toEqual({ kind: 'never' });
  });

  it('says today and yesterday in the user’s zone, not the server’s', () => {
    expect(lastUsed(new Date('2026-10-03T06:00:00.000Z'), NOW, ROME)).toEqual({ kind: 'today' });
    // 23:00 on 2 October in Rome.
    expect(lastUsed(new Date('2026-10-02T21:00:00.000Z'), NOW, ROME)).toEqual({
      kind: 'yesterday',
    });
    // 00:30 on 3 October in Rome, still 2 October in UTC.
    expect(lastUsed(new Date('2026-10-02T22:30:00.000Z'), NOW, ROME)).toEqual({ kind: 'today' });
  });

  it('gives the instant itself for anything older, for the page to format', () => {
    expect(lastUsed(new Date('2026-09-28T19:14:00.000Z'), NOW, ROME)).toEqual({
      kind: 'on',
      iso: '2026-09-28T19:14:00.000Z',
    });
  });
});

describe('LAST_USED_KEYS', () => {
  it('names strings that exist in the source catalog', () => {
    const t = makeTranslator(italian);
    for (const style of ['row', 'fact'] as const) {
      for (const key of Object.values(LAST_USED_KEYS[style])) expect(t(key)).not.toBe(key);
    }
  });
});

describe('connectorRows', () => {
  it('lists the most recently used first, then the never used by newest authorization', () => {
    const rows = connectorRows(
      [
        connector({ clientId: 'old-unused', authorizedAt: new Date('2026-09-01T08:00:00.000Z') }),
        connector({ clientId: 'used-earlier', lastUsedAt: new Date('2026-10-01T08:00:00.000Z') }),
        connector({ clientId: 'new-unused', authorizedAt: new Date('2026-10-02T08:00:00.000Z') }),
        connector({ clientId: 'used-now', lastUsedAt: new Date('2026-10-03T09:58:00.000Z') }),
      ],
      null,
      NOW,
      ROME,
    );
    expect(rows.map((row) => row.clientId)).toEqual([
      'used-now',
      'used-earlier',
      'new-unused',
      'old-unused',
    ]);
  });

  it('carries what a row and the panel show, and marks the selected one', () => {
    const [row] = connectorRows(
      [
        connector({
          clientId: 'id with/slash',
          name: 'claude',
          scopes: ['write', 'read'],
          redirectHost: 'claude.ai',
          lastUsedAt: new Date('2026-10-02T19:14:00.000Z'),
          calls: 37,
        }),
      ],
      'id with/slash',
      NOW,
      ROME,
    );
    expect(row).toEqual({
      clientId: 'id with/slash',
      name: 'claude',
      initial: 'C',
      redirectHost: 'claude.ai',
      scopes: ['read', 'write'],
      authorizedIso: '2026-10-01T08:00:00.000Z',
      lastUsed: { kind: 'yesterday' },
      calls: 37,
      href: `${CONNECTORS_PATH}?connector=id%20with%2Fslash`,
      selected: true,
    });
  });

  it('selects nothing for an id that names no connector', () => {
    expect(connectorRows([connector()], 'gone', NOW, ROME).some((row) => row.selected)).toBe(false);
  });
});

describe('connectorsNotice', () => {
  it('is nothing while MCP is on', () => {
    expect(connectorsNotice({ enabled: true, lockedByEnv: false, admin: true })).toBeNull();
  });

  it('tells a member that the administrator switched it off', () => {
    expect(connectorsNotice({ enabled: false, lockedByEnv: false, admin: false })).toBe('off');
    expect(connectorsNotice({ enabled: false, lockedByEnv: true, admin: false })).toBe('off');
  });

  it('tells an admin they switched it off, or that the environment did', () => {
    expect(connectorsNotice({ enabled: false, lockedByEnv: false, admin: true })).toBe('offAdmin');
    expect(connectorsNotice({ enabled: false, lockedByEnv: true, admin: true })).toBe(
      'offAdminEnv',
    );
  });
});
