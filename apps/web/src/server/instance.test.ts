import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { serverSettings } from './db/schema';
import { describeInstance, instanceInfo } from './instance';
import { createTestDatabase, type TestDatabase } from './test/harness';

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

describe('instanceInfo', () => {
  it('is the passkey relying-party name when nothing names the instance', async () => {
    await expect(instanceInfo(harness.db)).resolves.toMatchObject({ name: 'Saldo test' });
  });

  it('uses the name saved in the table when the environment has none', async () => {
    await harness.db
      .insert(serverSettings)
      .values({ key: 'instanceName', value: 'Casa Gaye', updatedAt: new Date(), updatedBy: null });
    const info = await instanceInfo(harness.db);
    expect(info.name).toBe('Casa Gaye');
    expect(info.host).toBe('localhost:3000');
  });
});

describe('describeInstance', () => {
  it('puts a resolved name next to the host and the version', () => {
    expect(describeInstance('Casa Gaye')).toMatchObject({
      name: 'Casa Gaye',
      host: 'localhost:3000',
    });
  });
});
