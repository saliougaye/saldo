import { parseHlc } from '@saldo/core';
import { createClock } from './clock';
import { createKvStore } from './kv';
import { createTestDatabase } from './testing';

function setup(wallMs = 1_775_000_000_000) {
  const store = createKvStore(createTestDatabase());
  let now = wallMs;
  const clock = createClock(store, () => now);
  return { clock, store, advance: (ms: number) => (now += ms) };
}

describe('createClock', () => {
  it('issues increasing timestamps', () => {
    const { clock } = setup();
    const a = clock.now();
    const b = clock.now();
    expect(a < b).toBe(true);
    expect(parseHlc(a).deviceId).toBe(parseHlc(b).deviceId);
  });

  it('persists its state, so a restart cannot repeat a timestamp', () => {
    const { clock, store } = setup();
    const before = clock.now();
    const restarted = createClock(store, () => 1);
    expect(restarted.now() > before).toBe(true);
  });

  it('uses the stored device id as the tiebreaker', () => {
    const { clock, store } = setup();
    expect(parseHlc(clock.now()).deviceId).toBe(store.deviceId());
  });

  it('merges a remote timestamp and moves past it', () => {
    const { clock } = setup(1000);
    const merged = clock.receive('000000009999999-0005-otherdev');
    expect(parseHlc(merged).wallMs).toBe(9999999);
    expect(clock.now() > merged).toBe(true);
  });
});
