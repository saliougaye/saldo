import { SYNC_SCHEMA_VERSION } from '@saldo/core';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../../../src/server/test/harness';
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
      inviteRequired: false,
    });
  });
});
