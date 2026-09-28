import { describe, expect, it } from 'vitest';
import { passkeyProvider } from './provider';

describe('passkeyProvider', () => {
  it('names the authenticators people actually use', () => {
    expect(passkeyProvider('fbfc3007-154e-4ecc-8c0b-6e020557d7bd')).toBe('iCloud Keychain');
    expect(passkeyProvider('ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4')).toBe('Google Password Manager');
    expect(passkeyProvider('adce0002-35bc-c60a-648b-0b25f1f05503')).toBe('Chrome on Mac');
  });

  it('reads an AAGUID in any case and with any spacing', () => {
    expect(passkeyProvider('  FBFC3007-154E-4ECC-8C0B-6E020557D7BD ')).toBe('iCloud Keychain');
  });

  it('answers null for one it does not know, and for none at all', () => {
    expect(passkeyProvider('00000000-0000-0000-0000-000000000000')).toBeNull();
    expect(passkeyProvider(null)).toBeNull();
    expect(passkeyProvider('')).toBeNull();
  });
});
