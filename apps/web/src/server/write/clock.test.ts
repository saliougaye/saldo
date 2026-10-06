import { parseHlc } from '@saldo/core';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { advanceClock } from './clock';

let harness: TestDatabase;
const NOW = new Date('2026-09-29T10:00:00.000Z');

beforeAll(async () => {
  harness = await createTestDatabase();
});
afterEach(async () => {
  await harness.reset();
});
afterAll(async () => {
  await harness.close();
});

describe('advanceClock', () => {
  it('keeps the same instance id and keeps increasing across calls', async () => {
    const [first] = await harness.db.transaction((tx) => advanceClock(tx, NOW, [null]));
    const [second] = await harness.db.transaction((tx) => advanceClock(tx, NOW, [null]));
    if (first === undefined || second === undefined) throw new Error('no stamp');
    expect(second > first).toBe(true);
    expect(parseHlc(second).deviceId).toBe(parseHlc(first).deviceId);
  });
});
