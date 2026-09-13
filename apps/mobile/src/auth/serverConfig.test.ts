import { redirectUri } from './link';
import { readScheme, readServerUrl } from './serverConfig';

describe('readServerUrl', () => {
  it('normalises the address the build was given', () => {
    expect(readServerUrl({ serverUrl: 'saldo.example.com' })).toBe('https://saldo.example.com');
    expect(readServerUrl({ serverUrl: ' http://localhost:3000 ' })).toBe('http://localhost:3000');
  });

  it('is null when the build has no address, or an unusable one', () => {
    expect(readServerUrl({})).toBeNull();
    expect(readServerUrl({ serverUrl: '' })).toBeNull();
    expect(readServerUrl({ serverUrl: 'not a host' })).toBeNull();
    expect(readServerUrl({ serverUrl: 42 })).toBeNull();
    expect(readServerUrl(undefined)).toBeNull();
  });
});

describe('readScheme', () => {
  it('reads the scheme the build registered (§15 SALDO_SCHEME)', () => {
    expect(readScheme({ scheme: 'mymoney' })).toBe('mymoney');
    // Expo allows a list; the first entry is the one it treats as primary.
    expect(readScheme({ scheme: ['mymoney', 'saldo'] })).toBe('mymoney');
    expect(readScheme({ scheme: '  mymoney  ' })).toBe('mymoney');
  });

  it('falls back to the default scheme when the manifest carries no usable one', () => {
    expect(readScheme({})).toBe('saldo');
    expect(readScheme({ scheme: '   ' })).toBe('saldo');
    expect(readScheme({ scheme: 42 })).toBe('saldo');
    expect(readScheme({ scheme: [] })).toBe('saldo');
    expect(readScheme(null)).toBe('saldo');
    expect(readScheme(undefined)).toBe('saldo');
  });

  it('produces the redirect the operating system will actually route back', () => {
    expect(redirectUri(readScheme({ scheme: 'mymoney' }))).toBe('mymoney://auth/callback');
  });
});
