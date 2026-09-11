import { afterEach, describe, expect, it } from 'vitest';
import { resetEnvCache } from '../env';
import { getStore, isValidKey, objectKey, resetStoreCache } from './index';

const base = {
  PUBLIC_URL: 'https://saldo.example.com',
  WEBAUTHN_RP_ID: 'saldo.example.com',
  WEBAUTHN_RP_NAME: 'Saldo',
  JWT_SECRET: 'x'.repeat(44),
  DATABASE_URL: 'postgres://saldo:saldo@localhost:5432/saldo',
};

function withEnv(extra: Record<string, string>) {
  resetEnvCache();
  resetStoreCache();
  for (const [key, value] of Object.entries({ ...base, ...extra })) process.env[key] = value;
}

afterEach(() => {
  for (const key of [
    ...Object.keys(base),
    'ATTACHMENT_STORAGE',
    'STORAGE_DIR',
    'S3_BUCKET',
    'S3_REGION',
    'S3_ACCESS_KEY_ID',
    'S3_SECRET_ACCESS_KEY',
  ]) {
    delete process.env[key];
  }
  resetEnvCache();
  resetStoreCache();
});

describe('getStore', () => {
  it('is null when the server keeps no attachments, which is a supported state', async () => {
    withEnv({ ATTACHMENT_STORAGE: 'none' });
    expect(await getStore()).toBeNull();
  });

  it('builds the disk driver', async () => {
    withEnv({ ATTACHMENT_STORAGE: 'fs', STORAGE_DIR: '/tmp/saldo-blobs' });
    expect((await getStore())?.name).toBe('fs');
  });

  it('builds the s3 driver, which can presign both ways', async () => {
    withEnv({
      ATTACHMENT_STORAGE: 's3',
      S3_BUCKET: 'saldo',
      S3_REGION: 'auto',
      S3_ACCESS_KEY_ID: 'key',
      S3_SECRET_ACCESS_KEY: 'secret',
    });
    const store = await getStore();
    expect(store?.name).toBe('s3');
    expect(typeof store?.presignPut).toBe('function');
    expect(typeof store?.presignGet).toBe('function');
  });

  it('leaves the disk driver without presigning: a filesystem has no URLs', async () => {
    withEnv({ ATTACHMENT_STORAGE: 'fs', STORAGE_DIR: '/tmp/saldo-blobs' });
    const store = await getStore();
    expect(store?.presignPut).toBeUndefined();
    expect(store?.presignGet).toBeUndefined();
  });

  it('is memoised', async () => {
    withEnv({ ATTACHMENT_STORAGE: 'fs', STORAGE_DIR: '/tmp/saldo-blobs' });
    expect(await getStore()).toBe(await getStore());
  });
});

describe('objectKey', () => {
  it('puts the owner in the key', () => {
    expect(objectKey('user-1', 'att-1')).toBe('user-1/att-1');
    expect(isValidKey(objectKey('user-1', 'att-1'))).toBe(true);
  });

  it('rejects anything that could climb out of a directory or a prefix', () => {
    expect(isValidKey('../escape')).toBe(false);
    expect(isValidKey('user-1/../../escape')).toBe(false);
    expect(isValidKey('user-1')).toBe(false);
    expect(isValidKey('user-1/att-1/extra')).toBe(false);
    expect(isValidKey('user 1/att-1')).toBe(false);
  });
});
