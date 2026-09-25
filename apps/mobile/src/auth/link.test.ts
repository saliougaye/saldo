import {
  authorizeUrl,
  callbackParams,
  isInsecureAddress,
  normaliseServerUrl,
  redirectUri,
  serverLabel,
} from './link';

describe('normaliseServerUrl', () => {
  it('adds https, drops a trailing slash and rejects nonsense', () => {
    expect(normaliseServerUrl('saldo.example.com')).toBe('https://saldo.example.com');
    expect(normaliseServerUrl('https://saldo.example.com/')).toBe('https://saldo.example.com');
    expect(normaliseServerUrl('http://localhost:3000')).toBe('http://localhost:3000');
    expect(normaliseServerUrl('  saldo.example.com  ')).toBe('https://saldo.example.com');
    expect(normaliseServerUrl('not a url')).toBeNull();
    expect(normaliseServerUrl('')).toBeNull();
  });

  it('refuses a URL with a path, which would break every endpoint below it', () => {
    expect(normaliseServerUrl('https://saldo.example.com/app')).toBeNull();
  });

  it('allows plain http only to this machine, where nobody can sit in between', () => {
    expect(normaliseServerUrl('http://127.0.0.1:3000')).toBe('http://127.0.0.1:3000');
    expect(normaliseServerUrl('http://[::1]:3000')).toBe('http://[::1]:3000');
    // The Android emulator's name for the host machine.
    expect(normaliseServerUrl('http://10.0.2.2:3000')).toBe('http://10.0.2.2:3000');
    expect(normaliseServerUrl('HTTP://LOCALHOST:3000')).toBe('http://localhost:3000');
  });

  it('refuses plain http to anything else: the network could impersonate the server', () => {
    expect(normaliseServerUrl('http://saldo.example.com')).toBeNull();
    expect(normaliseServerUrl('http://192.168.1.20:3000')).toBeNull();
    expect(normaliseServerUrl('http://localhost.evil.com')).toBeNull();
  });
});

describe('isInsecureAddress', () => {
  it('names the plain-http addresses the field refuses, and nothing else', () => {
    expect(isInsecureAddress('http://saldo.example.com')).toBe(true);
    expect(isInsecureAddress(' http://192.168.1.20:3000 ')).toBe(true);
    expect(isInsecureAddress('http://localhost:3000')).toBe(false);
    expect(isInsecureAddress('saldo.example.com')).toBe(false);
    expect(isInsecureAddress('https://saldo.example.com/app')).toBe(false);
  });
});

describe('redirectUri', () => {
  it('is built from the scheme this build registered, not from a fixed one', () => {
    expect(redirectUri('saldo')).toBe('saldo://auth/callback');
    // A fork that sets `SALDO_SCHEME=mymoney` registers `mymoney://` and must be sent back there.
    expect(redirectUri('mymoney')).toBe('mymoney://auth/callback');
  });
});

describe('authorizeUrl', () => {
  it('builds the /auth/mobile link with every parameter', () => {
    const url = new URL(
      authorizeUrl('https://saldo.example.com', {
        redirectUri: 'saldo://auth/callback',
        state: 'st4te',
        mode: 'register',
      }),
    );
    expect(url.pathname).toBe('/auth/mobile');
    expect(url.searchParams.get('redirect_uri')).toBe('saldo://auth/callback');
    expect(url.searchParams.get('state')).toBe('st4te');
    expect(url.searchParams.get('mode')).toBe('register');
  });
});

describe('callbackParams', () => {
  it('reads the one-time token and the state back out of the redirect', () => {
    expect(callbackParams('saldo://auth/callback?ott=abc&state=st4te')).toEqual({
      ott: 'abc',
      state: 'st4te',
    });
  });

  it('returns null unless both are present', () => {
    expect(callbackParams('saldo://auth/callback?ott=abc')).toBeNull();
    expect(callbackParams('saldo://auth/callback?error=denied')).toBeNull();
    expect(callbackParams('not a url')).toBeNull();
  });
});

describe('serverLabel', () => {
  it('shows a server by its host', () => {
    expect(serverLabel('https://saldo.example.com')).toBe('saldo.example.com');
    expect(serverLabel('http://localhost:3000')).toBe('localhost:3000');
  });
});
