import { SYNC_SCHEMA_VERSION } from '@saldo/core';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { resetEnvCache } from '../../../src/server/env';
import { resetStoreCache } from '../../../src/server/storage';
import { createTestDatabase, type TestDatabase } from '../../../src/server/test/harness';
import { createTestSession } from '../../../src/server/test/session';
import { GET } from './route';

let harness: TestDatabase;

beforeAll(async () => {
  harness = await createTestDatabase();
});

afterEach(async () => {
  await harness.reset();
});

afterAll(async () => {
  await harness.close();
});

describe('GET /api/health', () => {
  it('identifies the app and the api version', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      app: 'saldo',
      apiVersion: 1,
      schemaVersion: SYNC_SCHEMA_VERSION,
      registrationAllowed: true,
    });
  });

  it('always reports the registration flag', async () => {
    await createTestSession(harness.db);
    const body = (await (await GET()).json()) as { registrationAllowed: unknown };
    expect(typeof body.registrationAllowed).toBe('boolean');
  });

  it('says attachments are off when the server keeps none (§10)', async () => {
    const body = (await (await GET()).json()) as { attachmentsEnabled: unknown };
    expect(body.attachmentsEnabled).toBe(false);
  });

  it('says attachments are on once a store is configured', async () => {
    resetEnvCache();
    resetStoreCache();
    process.env.ATTACHMENT_STORAGE = 'fs';
    process.env.STORAGE_DIR = '/tmp/saldo-health-blobs';
    try {
      const body = (await (await GET()).json()) as { attachmentsEnabled: unknown };
      expect(body.attachmentsEnabled).toBe(true);
    } finally {
      delete process.env.ATTACHMENT_STORAGE;
      delete process.env.STORAGE_DIR;
      resetEnvCache();
      resetStoreCache();
    }
  });
});
