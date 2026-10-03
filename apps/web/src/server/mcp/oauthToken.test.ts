import { describe, expect, it } from 'vitest';
import { bearerToken, hashOAuthToken } from './oauthToken';

describe('hashOAuthToken', () => {
  it('is SHA-256, base64url, unpadded — the plugin’s own default', () => {
    // sha256("abc") = ba7816bf…20015ad
    expect(hashOAuthToken('abc')).toBe('ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0');
  });
});

describe('bearerToken', () => {
  const withHeader = (value: string | null) =>
    new Request('http://localhost:3000/mcp', {
      method: 'POST',
      headers: value === null ? {} : { authorization: value },
    });

  it('reads an RFC 6750 bearer from the Authorization header', () => {
    expect(bearerToken(withHeader('Bearer abc.DEF-123_~+/='))).toBe('abc.DEF-123_~+/=');
    expect(bearerToken(withHeader('bearer xyz'))).toBe('xyz');
  });

  it('is undefined for no header, another scheme, or an empty token', () => {
    expect(bearerToken(withHeader(null))).toBeUndefined();
    expect(bearerToken(withHeader('Basic abc'))).toBeUndefined();
    expect(bearerToken(withHeader('Bearer '))).toBeUndefined();
    expect(bearerToken(withHeader('Bearer a b'))).toBeUndefined();
  });
});
