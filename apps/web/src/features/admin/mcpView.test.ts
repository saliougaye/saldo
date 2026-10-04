import { describe, expect, it } from 'vitest';
import { insecurePublicUrl, lockedVariable, MCP_ADMIN_PATH, offWarning } from './mcpView';

const stats = (over: Partial<Parameters<typeof offWarning>[0]> = {}) => ({
  usersWithConnectors: 3,
  totalUsers: 4,
  connectorsAuthorized: 5,
  connectorsUsedLast7Days: 4,
  ...over,
});

describe('MCP_ADMIN_PATH', () => {
  it('is the page of its own §17.4.3 gives the switch', () => {
    expect(MCP_ADMIN_PATH).toBe('/admin/mcp');
  });
});

describe('offWarning', () => {
  it('names how many users and connectors stop', () => {
    expect(offWarning(stats())).toEqual({ kind: 'some', users: 3, connectors: 5 });
  });

  it('says nothing stops when no connector is authorized', () => {
    expect(
      offWarning(
        stats({ usersWithConnectors: 0, connectorsAuthorized: 0, connectorsUsedLast7Days: 0 }),
      ),
    ).toEqual({ kind: 'none' });
  });
});

describe('lockedVariable', () => {
  it('names the variable and its value when the environment sets it', () => {
    expect(lockedVariable({ value: false, source: 'env', envVar: 'MCP_ENABLED' })).toBe(
      'MCP_ENABLED=false',
    );
    expect(lockedVariable({ value: true, source: 'env', envVar: 'MCP_ENABLED' })).toBe(
      'MCP_ENABLED=true',
    );
  });

  it('is nothing when the panel decides', () => {
    expect(lockedVariable({ value: true, source: 'database', envVar: null })).toBeNull();
    expect(lockedVariable({ value: true, source: 'default', envVar: null })).toBeNull();
  });
});

describe('insecurePublicUrl', () => {
  it('accepts https and the loopback addresses MCP clients allow over http', () => {
    expect(insecurePublicUrl('https://saldo.example.com')).toBe(false);
    expect(insecurePublicUrl('http://localhost:3000')).toBe(false);
    expect(insecurePublicUrl('http://127.0.0.1:3000')).toBe(false);
    expect(insecurePublicUrl('http://[::1]:3000')).toBe(false);
  });

  it('flags plain http anywhere else', () => {
    expect(insecurePublicUrl('http://saldo.lan')).toBe(true);
    expect(insecurePublicUrl('http://192.168.1.20:3000')).toBe(true);
  });
});
