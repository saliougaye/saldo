import { authorizeUrl, callbackParams, normaliseServerUrl, serverLabel } from './link';

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
