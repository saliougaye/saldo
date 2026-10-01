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
  // 32 bytes of 'A': obviously fake.
  SETTINGS_ENCRYPTION_KEY: Buffer.alloc(32, 'A').toString('base64'),
  STORAGE_DIR: '/data/attachments',
  REGISTRATION: 'first-user',
  APP_REDIRECT_SCHEMES: 'saldo, saldo-dev',
};

describe('readEnv', () => {
  it('defaults the fallback time zone to UTC, and rejects one Intl does not know', () => {
    expect(readEnv(complete).defaultTimeZone).toBe('UTC');
    expect(readEnv({ ...complete, DEFAULT_TIME_ZONE: 'Europe/Rome' }).defaultTimeZone).toBe(
      'Europe/Rome',
    );
    expect(() => readEnv({ ...complete, DEFAULT_TIME_ZONE: 'Europe/Atlantis' })).toThrow(
      /DEFAULT_TIME_ZONE/,
    );
  });

  it('parses a complete environment and splits the redirect schemes', () => {
    const env = readEnv(complete);
    expect(env.publicUrl).toBe('https://saldo.example.com');
    expect(env.registration).toBe('first-user');
    expect(env.appRedirectSchemes).toEqual(['saldo', 'saldo-dev']);
  });

  it('leaves registration null when unset (the resolver defaults it) and the schemes to saldo', () => {
    const { REGISTRATION, APP_REDIRECT_SCHEMES, ...rest } = complete;
    const env = readEnv(rest);
    expect(env.registration).toBeNull();
    expect(env.appRedirectSchemes).toEqual(['saldo']);
  });

  it('defaults trustedProxies to empty, and splits a configured list', () => {
    expect(readEnv(complete).trustedProxies).toEqual([]);
    expect(
      readEnv({ ...complete, TRUSTED_PROXIES: '10.0.0.5, 172.28.0.0/16' }).trustedProxies,
    ).toEqual(['10.0.0.5', '172.28.0.0/16']);
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

describe('SETTINGS_ENCRYPTION_KEY', () => {
  it('decodes a 32-byte base64 key into a Buffer', () => {
    const { settingsKey } = readEnv(complete);
    expect(Buffer.isBuffer(settingsKey)).toBe(true);
    expect(settingsKey).toHaveLength(32);
  });

  it('is required, by name', () => {
    const { SETTINGS_ENCRYPTION_KEY: _dropped, ...rest } = complete;
    expect(() => readEnv(rest)).toThrow(/SETTINGS_ENCRYPTION_KEY/);
  });

  it('refuses a value that is not base64, or not 32 bytes, by name', () => {
    expect(() => readEnv({ ...complete, SETTINGS_ENCRYPTION_KEY: 'not base64 at all!' })).toThrow(
      /SETTINGS_ENCRYPTION_KEY/,
    );
    const short = Buffer.alloc(16, 'A').toString('base64');
    const long = Buffer.alloc(33, 'A').toString('base64');
    expect(() => readEnv({ ...complete, SETTINGS_ENCRYPTION_KEY: short })).toThrow(
      /SETTINGS_ENCRYPTION_KEY/,
    );
    expect(() => readEnv({ ...complete, SETTINGS_ENCRYPTION_KEY: long })).toThrow(
      /SETTINGS_ENCRYPTION_KEY/,
    );
  });
});

describe('REGISTRATION and INSTANCE_NAME', () => {
  it('reads a set registration mode', () => {
    expect(readEnv({ ...complete, REGISTRATION: 'invite' }).registration).toBe('invite');
  });

  it('leaves the instance name null when unset, and trims a set one', () => {
    expect(readEnv(complete).instanceName).toBeNull();
    expect(readEnv({ ...complete, INSTANCE_NAME: '  Casa Gaye ' }).instanceName).toBe('Casa Gaye');
  });

  it('reads an empty variable as unset, as a compose file writes it', () => {
    expect(readEnv({ ...complete, INSTANCE_NAME: '', REGISTRATION: '' }).instanceName).toBeNull();
    expect(readEnv({ ...complete, INSTANCE_NAME: '   ' }).instanceName).toBeNull();
    expect(readEnv({ ...complete, REGISTRATION: '' }).registration).toBeNull();
    expect(readEnv({ ...complete, SMTP_HOST: '' }).smtp).toBeNull();
  });

  it('refuses a too-long instance name, by name', () => {
    expect(() => readEnv({ ...complete, INSTANCE_NAME: 'x'.repeat(61) })).toThrow(/INSTANCE_NAME/);
    expect(readEnv({ ...complete, INSTANCE_NAME: 'x'.repeat(60) }).instanceName).toHaveLength(60);
  });
});

describe('SMTP_*', () => {
  const smtp = { SMTP_HOST: 'smtp.example.com', SMTP_FROM: 'Saldo <saldo@example.com>' };

  it('is null when SMTP_HOST is unset, whatever else is set', () => {
    expect(readEnv(complete).smtp).toBeNull();
    expect(readEnv({ ...complete, SMTP_PORT: '2525' }).smtp).toBeNull();
  });

  it('takes the whole group from the environment, port defaulting to 587', () => {
    expect(readEnv({ ...complete, ...smtp }).smtp).toEqual({
      host: 'smtp.example.com',
      port: 587,
      user: null,
      password: null,
      from: 'Saldo <saldo@example.com>',
    });
    expect(
      readEnv({
        ...complete,
        ...smtp,
        SMTP_PORT: '465',
        SMTP_USER: 'mailer',
        SMTP_PASSWORD: 'fake-password',
      }).smtp,
    ).toEqual({
      host: 'smtp.example.com',
      port: 465,
      user: 'mailer',
      password: 'fake-password',
      from: 'Saldo <saldo@example.com>',
    });
  });

  it('requires SMTP_FROM once SMTP_HOST is set, by name', () => {
    expect(() => readEnv({ ...complete, SMTP_HOST: 'smtp.example.com' })).toThrow(/SMTP_FROM/);
  });

  it('wants SMTP_USER and SMTP_PASSWORD together or not at all, each named', () => {
    expect(() => readEnv({ ...complete, ...smtp, SMTP_USER: 'mailer' })).toThrow(/SMTP_PASSWORD/);
    expect(() => readEnv({ ...complete, ...smtp, SMTP_PASSWORD: 'fake-password' })).toThrow(
      /SMTP_USER/,
    );
  });

  it('refuses a port that is not 1-65535, by name', () => {
    for (const port of ['0', '65536', 'abc', '25.5']) {
      expect(() => readEnv({ ...complete, ...smtp, SMTP_PORT: port })).toThrow(/SMTP_PORT/);
    }
  });
});

describe('attachment storage', () => {
  it('defaults to none, and then asks for nothing', () => {
    const { STORAGE_DIR: _dropped, ...withoutStorage } = complete;
    expect(readEnv(withoutStorage).attachmentStorage).toEqual({ kind: 'none' });
  });

  it('asks fs for a directory, by name', () => {
    expect(() =>
      readEnv({ ...complete, ATTACHMENT_STORAGE: 'fs', STORAGE_DIR: undefined }),
    ).toThrow(/STORAGE_DIR/);
    expect(
      readEnv({ ...complete, ATTACHMENT_STORAGE: 'fs', STORAGE_DIR: '/data/blobs' })
        .attachmentStorage,
    ).toEqual({ kind: 'fs', dir: '/data/blobs' });
  });

  it('asks s3 for a bucket, a region and credentials', () => {
    expect(() => readEnv({ ...complete, ATTACHMENT_STORAGE: 's3' })).toThrow(/S3_BUCKET/);
    const s3 = {
      ...complete,
      ATTACHMENT_STORAGE: 's3',
      S3_BUCKET: 'saldo',
      S3_REGION: 'auto',
      S3_ACCESS_KEY_ID: 'key',
      S3_SECRET_ACCESS_KEY: 'secret',
    };
    expect(readEnv(s3).attachmentStorage).toEqual({
      kind: 's3',
      bucket: 'saldo',
      region: 'auto',
      endpoint: null,
      accessKeyId: 'key',
      secretAccessKey: 'secret',
      forcePathStyle: false,
    });
  });

  it('takes the endpoint and path style that make R2 and MinIO work', () => {
    const config = readEnv({
      ...complete,
      ATTACHMENT_STORAGE: 's3',
      S3_BUCKET: 'saldo',
      S3_REGION: 'auto',
      S3_ACCESS_KEY_ID: 'key',
      S3_SECRET_ACCESS_KEY: 'secret',
      S3_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
      S3_FORCE_PATH_STYLE: 'true',
    }).attachmentStorage;
    expect(config).toMatchObject({
      endpoint: 'https://account.r2.cloudflarestorage.com',
      forcePathStyle: true,
    });
  });

  it('asks vercel-blob for its token', () => {
    expect(() => readEnv({ ...complete, ATTACHMENT_STORAGE: 'vercel-blob' })).toThrow(
      /BLOB_READ_WRITE_TOKEN/,
    );
    expect(
      readEnv({ ...complete, ATTACHMENT_STORAGE: 'vercel-blob', BLOB_READ_WRITE_TOKEN: 'tok' })
        .attachmentStorage,
    ).toEqual({ kind: 'vercel-blob', token: 'tok' });
  });

  it('refuses a storage kind it does not know', () => {
    expect(() => readEnv({ ...complete, ATTACHMENT_STORAGE: 'dropbox' })).toThrow();
  });
});
