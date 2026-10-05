import { describe, expect, it } from 'vitest';
import { insecurePublicUrl } from './mcpView';

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
