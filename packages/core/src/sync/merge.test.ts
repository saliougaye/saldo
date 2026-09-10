import { describe, expect, it } from 'vitest';
import { formatHlc, type HlcState, hlcNow, hlcReceive } from './hlc';
import { mergeRecord, type SyncRecord, shouldApplyRemote } from './merge';

const record = (updatedAt: string, value: string): SyncRecord & { value: string } => ({
  id: 'row-1',
  updatedAt,
  deletedAt: null,
  value,
});

const A = '001775000000000-0000-device-a';
const B = '001775000000001-0000-device-b';
const SAME_WALL_A = '001775000000000-0000-device-a';
const SAME_WALL_B = '001775000000000-0000-device-b';

describe('shouldApplyRemote', () => {
  it('applies a remote row that is newer, and nothing else', () => {
    expect(shouldApplyRemote(B, A)).toBe(true);
    expect(shouldApplyRemote(A, B)).toBe(false);
    expect(shouldApplyRemote(A, A)).toBe(false);
  });

  it('applies a remote row when there is no local one', () => {
    expect(shouldApplyRemote(A, null)).toBe(true);
  });

  it('breaks a wall-clock tie by device id, deterministically on both sides', () => {
    expect(shouldApplyRemote(SAME_WALL_B, SAME_WALL_A)).toBe(true);
    expect(shouldApplyRemote(SAME_WALL_A, SAME_WALL_B)).toBe(false);
  });
});

describe('mergeRecord', () => {
  it('keeps the winner whole — no field-level merge', () => {
    expect(mergeRecord(record(A, 'local'), record(B, 'remote')).value).toBe('remote');
    expect(mergeRecord(record(B, 'local'), record(A, 'remote')).value).toBe('local');
    expect(mergeRecord(null, record(A, 'remote')).value).toBe('remote');
  });

  it('lets a tombstone win like any other write', () => {
    const tombstone = { ...record(B, 'remote'), deletedAt: '2026-09-10T10:00:00.000Z' };
    expect(mergeRecord(record(A, 'local'), tombstone).deletedAt).not.toBeNull();
    // …and lets a later undelete win over it.
    const undeleted = record('001775000000002-0000-device-a', 'local');
    expect(mergeRecord(undeleted, tombstone).deletedAt).toBeNull();
  });
});

/** Deterministic PRNG: §3.2 forbids hidden randomness, and a flaky property test is useless. */
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

describe('convergence', () => {
  it('converges for random interleavings of two replicas', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const random = lcg(seed);
      const clocks: Record<'a' | 'b', HlcState> = {
        a: { wallMs: 0, counter: 0, deviceId: 'device-a' },
        b: { wallMs: 0, counter: 0, deviceId: 'device-b' },
      };
      const replicas: Record<'a' | 'b', Map<string, SyncRecord & { value: number }>> = {
        a: new Map(),
        b: new Map(),
      };
      const outbox: { from: 'a' | 'b'; record: SyncRecord & { value: number } }[] = [];
      let wall = 1_700_000_000_000;

      const write = (side: 'a' | 'b', id: string, value: number) => {
        // Wall clocks drift in both directions, which is the whole point of an HLC.
        wall += Math.floor(random() * 5) - 2;
        const step = hlcNow(clocks[side], wall);
        clocks[side] = step.state;
        const next = { id, updatedAt: step.hlc, deletedAt: null, value };
        replicas[side].set(id, next);
        outbox.push({ from: side, record: next });
      };

      const deliver = (index: number) => {
        const message = outbox.splice(index, 1)[0];
        if (message === undefined) return;
        const to = message.from === 'a' ? 'b' : 'a';
        clocks[to] = hlcReceive(clocks[to], message.record.updatedAt, wall).state;
        const merged = mergeRecord(replicas[to].get(message.record.id) ?? null, message.record);
        replicas[to].set(message.record.id, merged);
      };

      for (let step = 0; step < 60; step += 1) {
        const id = `row-${Math.floor(random() * 4)}`;
        if (outbox.length > 0 && random() < 0.45) {
          deliver(Math.floor(random() * outbox.length));
        } else {
          write(random() < 0.5 ? 'a' : 'b', id, step);
        }
      }
      while (outbox.length > 0) deliver(0);

      const snapshot = (side: 'a' | 'b') =>
        [...replicas[side].entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([id, row]) => `${id}:${row.updatedAt}:${row.value}`);
      expect(snapshot('a')).toEqual(snapshot('b'));
    }
  });

  it('is order-independent: the same writes delivered backwards land on the same row', () => {
    const writes = [record(A, 'first'), record(B, 'second')];
    const merge = (rows: (SyncRecord & { value: string })[]) =>
      rows.reduce<(SyncRecord & { value: string }) | null>(
        (local, remote) => mergeRecord(local, remote),
        null,
      );
    expect(merge(writes)).toEqual(merge([...writes].reverse()));
    expect(formatHlc({ wallMs: 1, counter: 0, deviceId: 'x' })).toBe('000000000000001-0000-x');
  });
});
