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
  it('requires https unless the origin is localhost', () => {
    expect(() => readEnv({ ...complete, PUBLIC_URL: 'http://saldo.example.com' })).toThrow(
      /PUBLIC_URL/,
    );
    expect(readEnv({ ...complete, PUBLIC_URL: 'http://localhost:3000' }).publicUrl).toBe(
      'http://localhost:3000',
    );
  });
});

describe('SETTINGS_ENCRYPTION_KEY', () => {
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
  it('reads an empty variable as unset, as a compose file writes it', () => {
    expect(readEnv({ ...complete, INSTANCE_NAME: '', REGISTRATION: '' }).instanceName).toBeNull();
    expect(readEnv({ ...complete, INSTANCE_NAME: '   ' }).instanceName).toBeNull();
    expect(readEnv({ ...complete, REGISTRATION: '' }).registration).toBeNull();
    expect(readEnv({ ...complete, SMTP_HOST: '' }).smtp).toBeNull();
  });
});

describe('SMTP_*', () => {
  const smtp = { SMTP_HOST: 'smtp.example.com', SMTP_FROM: 'Saldo <saldo@example.com>' };

  it('requires SMTP_FROM once SMTP_HOST is set, by name', () => {
    expect(() => readEnv({ ...complete, SMTP_HOST: 'smtp.example.com' })).toThrow(/SMTP_FROM/);
  });

  it('wants SMTP_USER and SMTP_PASSWORD together or not at all, each named', () => {
    expect(() => readEnv({ ...complete, ...smtp, SMTP_USER: 'mailer' })).toThrow(/SMTP_PASSWORD/);
    expect(() => readEnv({ ...complete, ...smtp, SMTP_PASSWORD: 'fake-password' })).toThrow(
      /SMTP_USER/,
    );
  });
});

describe('attachment storage', () => {
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

  it('asks vercel-blob for its token', () => {
    expect(() => readEnv({ ...complete, ATTACHMENT_STORAGE: 'vercel-blob' })).toThrow(
      /BLOB_READ_WRITE_TOKEN/,
    );
    expect(
      readEnv({ ...complete, ATTACHMENT_STORAGE: 'vercel-blob', BLOB_READ_WRITE_TOKEN: 'tok' })
        .attachmentStorage,
    ).toEqual({ kind: 'vercel-blob', token: 'tok' });
  });
});
