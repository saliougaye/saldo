import { describe, expect, it } from 'vitest';
import { validateRedirectUri } from './redirect';

describe('validateRedirectUri', () => {
  it('accepts an allow-listed scheme and rejects anything else', () => {
    expect(validateRedirectUri('saldo://auth/callback', ['saldo'])).toBe('saldo://auth/callback');
    expect(() => validateRedirectUri('https://evil.example/cb', ['saldo'])).toThrow(/redirect_uri/);
    expect(() => validateRedirectUri('not a uri', ['saldo'])).toThrow(/redirect_uri/);
  });

  it('is case-sensitive about the scheme, as URL parsing lower-cases it', () => {
    expect(validateRedirectUri('SALDO://auth/callback', ['saldo'])).toBe('SALDO://auth/callback');
    expect(() => validateRedirectUri('saldo2://auth/callback', ['saldo'])).toThrow();
  });
});
