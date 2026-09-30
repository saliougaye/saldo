import { describe, expect, it } from 'vitest';
import { isRelativePath } from './mailCallbackGuard';

describe('isRelativePath', () => {
  it('accepts a path on this site', () => {
    expect(isRelativePath('/recover')).toBe(true);
    expect(isRelativePath('/profile/passkeys?recovered')).toBe(true);
  });

  it('refuses another origin, scheme or protocol-relative address', () => {
    expect(isRelativePath('saldo://steal')).toBe(false);
    expect(isRelativePath('https://example.org/')).toBe(false);
    expect(isRelativePath('//example.org/')).toBe(false);
    expect(isRelativePath('/\\example.org/')).toBe(false);
  });

  // Browsers drop tabs and newlines from a URL before reading it: `/\t/host` becomes `//host`.
  it('refuses control characters a browser would strip into `//host`', () => {
    expect(isRelativePath('/\t/example.org/')).toBe(false);
    expect(isRelativePath('/\n/example.org/')).toBe(false);
    expect(isRelativePath('/\r/example.org/')).toBe(false);
  });
});
