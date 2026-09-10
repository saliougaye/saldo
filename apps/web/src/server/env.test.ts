import { afterEach, describe, expect, it } from 'vitest';
import { readEnv, resetEnvCache } from './env';

afterEach(() => {
  resetEnvCache();
});

const complete = {
  PUBLIC_URL: 'https://saldo.example.com',
  WEBAUTHN_RP_ID: 'saldo.example.com',
  WEBAUTHN_RP_NAME: 'Saldo',
  JWT_SECRET: 'c2VjcmV0LXNlY3JldC1zZWNyZXQtc2VjcmV0LXNlY3JldC0=',
  DATABASE_URL: 'postgres://u:p@db:5432/saldo',
  STORAGE_DIR: '/data/attachments',
  REGISTRATION: 'first-user',
  APP_REDIRECT_SCHEMES: 'saldo, saldo-dev',
};

describe('readEnv', () => {
  it('parses a complete environment and splits the redirect schemes', () => {
    const env = readEnv(complete);
    expect(env.publicUrl).toBe('https://saldo.example.com');
    expect(env.registration).toBe('first-user');
    expect(env.appRedirectSchemes).toEqual(['saldo', 'saldo-dev']);
  });

  it('defaults registration to first-user and the schemes to saldo', () => {
    const { REGISTRATION, APP_REDIRECT_SCHEMES, ...rest } = complete;
    const env = readEnv(rest);
    expect(env.registration).toBe('first-user');
    expect(env.appRedirectSchemes).toEqual(['saldo']);
  });

  it('rejects a short secret, a bad url and an unknown registration mode', () => {
    expect(() => readEnv({ ...complete, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
    expect(() => readEnv({ ...complete, PUBLIC_URL: 'not-a-url' })).toThrow(/PUBLIC_URL/);
    expect(() => readEnv({ ...complete, REGISTRATION: 'sometimes' })).toThrow(/REGISTRATION/);
  });

  it('requires https unless the origin is localhost', () => {
    expect(() => readEnv({ ...complete, PUBLIC_URL: 'http://saldo.example.com' })).toThrow(
      /PUBLIC_URL/,
    );
    expect(readEnv({ ...complete, PUBLIC_URL: 'http://localhost:3000' }).publicUrl).toBe(
      'http://localhost:3000',
    );
  });

  it('reports every missing variable at once', () => {
    expect(() => readEnv({})).toThrow(/PUBLIC_URL[\s\S]*JWT_SECRET/);
  });

  it('drops a trailing slash from the public url so origins compare equal', () => {
    expect(readEnv({ ...complete, PUBLIC_URL: 'https://saldo.example.com/' }).publicUrl).toBe(
      'https://saldo.example.com',
    );
  });
});
