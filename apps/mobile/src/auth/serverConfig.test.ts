import { readServerUrl } from './serverConfig';

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
