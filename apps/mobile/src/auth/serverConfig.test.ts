import { redirectUri } from './link';
import { readScheme } from './serverConfig';

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
