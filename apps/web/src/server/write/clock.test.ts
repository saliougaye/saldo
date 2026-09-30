import { isHlc, parseHlc } from '@saldo/core';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { advanceClock, lockClock, mintStamps, saveClock } from './clock';

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
  it('mints one increasing stamp per row, all from the same instance', async () => {
    const stamps = await harness.db.transaction((tx) => advanceClock(tx, NOW, [null, null, null]));
    expect(stamps).toHaveLength(3);
    for (const stamp of stamps) expect(isHlc(stamp)).toBe(true);
    expect([...stamps].sort()).toEqual(stamps);
    expect(new Set(stamps.map((stamp) => parseHlc(stamp).deviceId)).size).toBe(1);
  });

  it('keeps the same instance id and keeps increasing across calls', async () => {
    const [first] = await harness.db.transaction((tx) => advanceClock(tx, NOW, [null]));
    const [second] = await harness.db.transaction((tx) => advanceClock(tx, NOW, [null]));
    if (first === undefined || second === undefined) throw new Error('no stamp');
    expect(second > first).toBe(true);
    expect(parseHlc(second).deviceId).toBe(parseHlc(first).deviceId);
  });

  it('stamps after a row a phone wrote with a clock ahead of the server', async () => {
    const ahead = `${String(NOW.getTime() + 3_600_000).padStart(15, '0')}-0005-phone`;
    const [stamp] = await harness.db.transaction((tx) => advanceClock(tx, NOW, [ahead]));
    if (stamp === undefined) throw new Error('no stamp');
    expect(stamp > ahead).toBe(true);
  });
});

describe('lockClock / mintStamps / saveClock', () => {
  it('compose to the same result as advanceClock', async () => {
    const stamps = await harness.db.transaction(async (tx) => {
      const state = await lockClock(tx);
      const minted = mintStamps(state, NOW, [null, null]);
      await saveClock(tx, minted.state);
      return minted.stamps;
    });
    expect(stamps).toHaveLength(2);
    for (const stamp of stamps) expect(isHlc(stamp)).toBe(true);
    expect([...stamps].sort()).toEqual(stamps);
  });

  it('mintStamps does not persist by itself: only saveClock does', async () => {
    const before = await harness.db.transaction((tx) => lockClock(tx));
    await harness.db.transaction(async (tx) => {
      const state = await lockClock(tx);
      mintStamps(state, NOW, [null]);
      // No saveClock call: the minted stamp must not be persisted.
    });
    const after = await harness.db.transaction((tx) => lockClock(tx));
    expect(after).toEqual(before);
  });
});
