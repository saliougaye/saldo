import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { users } from '../../../src/server/db/schema';
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
      registrationAllowed: true,
    });
  });

  it('always reports the registration flag', async () => {
    await harness.db.insert(users).values({ displayName: 'Ada' });
    const body = (await (await GET()).json()) as { registrationAllowed: unknown };
    expect(typeof body.registrationAllowed).toBe('boolean');
  });
});
