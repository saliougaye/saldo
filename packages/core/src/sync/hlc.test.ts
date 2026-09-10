import { describe, expect, it } from 'vitest';
import { compareHlc, formatHlc, hlcNow, hlcReceive, initialHlcState, parseHlc } from './hlc';

const DEVICE = '7f3a1b2c';
const OTHER = '0a0b0c0d';

describe('formatHlc / parseHlc', () => {
  it('pads the wall clock to 15 digits and the counter to base36 4', () => {
    expect(formatHlc({ wallMs: 1775000000000, counter: 0, deviceId: DEVICE })).toBe(
      `001775000000000-0000-${DEVICE}`,
    );
    expect(formatHlc({ wallMs: 1, counter: 36, deviceId: DEVICE })).toBe(
      `000000000000001-0010-${DEVICE}`,
    );
  });

  it('round-trips', () => {
    const hlc = { wallMs: 1775000000123, counter: 41, deviceId: DEVICE };
    expect(parseHlc(formatHlc(hlc))).toEqual(hlc);
  });

  it('rejects malformed strings', () => {
    expect(() => parseHlc('nope')).toThrow(RangeError);
    expect(() => parseHlc('1775000000000-0000-dev')).toThrow(RangeError);
  });
});

describe('hlcNow', () => {
  it('uses the wall clock when it moved forward', () => {
    const first = hlcNow(initialHlcState(DEVICE), 1000);
    expect(first.hlc).toBe(`000000000001000-0000-${DEVICE}`);
    const second = hlcNow(first.state, 2000);
    expect(second.hlc).toBe(`000000000002000-0000-${DEVICE}`);
  });

  it('bumps the counter within the same millisecond', () => {
    const a = hlcNow(initialHlcState(DEVICE), 1000);
    const b = hlcNow(a.state, 1000);
    const c = hlcNow(b.state, 1000);
    expect([a.hlc, b.hlc, c.hlc].map((h) => parseHlc(h).counter)).toEqual([0, 1, 2]);
  });

  it('never goes backwards when the device clock does', () => {
    const a = hlcNow(initialHlcState(DEVICE), 5000);
    const b = hlcNow(a.state, 1000);
    expect(parseHlc(b.hlc).wallMs).toBe(5000);
    expect(parseHlc(b.hlc).counter).toBe(1);
    expect(a.hlc < b.hlc).toBe(true);
  });
});

describe('hlcReceive', () => {
  it('adopts a remote wall clock that is ahead', () => {
    const received = hlcReceive(initialHlcState(DEVICE), `000000000009000-0003-${OTHER}`, 1000);
    expect(parseHlc(received.hlc).wallMs).toBe(9000);
    expect(parseHlc(received.hlc).counter).toBe(4);
    expect(parseHlc(received.hlc).deviceId).toBe(DEVICE);
  });

  it('keeps the local wall clock when it is ahead of the remote', () => {
    const local = hlcNow(initialHlcState(DEVICE), 9000);
    const received = hlcReceive(local.state, `000000000001000-0000-${OTHER}`, 2000);
    expect(parseHlc(received.hlc).wallMs).toBe(9000);
    expect(parseHlc(received.hlc).counter).toBe(1);
  });

  it('takes the highest counter when both sides share a millisecond', () => {
    const local = hlcNow(initialHlcState(DEVICE), 1000);
    const received = hlcReceive(local.state, `000000000001000-0007-${OTHER}`, 1000);
    expect(parseHlc(received.hlc).counter).toBe(8);
  });

  it('always moves forward, so merges stay causal', () => {
    let state = initialHlcState(DEVICE);
    let previous = '';
    for (const [remoteWall, localWall] of [
      [5000, 1000],
      [1000, 6000],
      [6000, 6000],
      [2000, 2000],
    ] as const) {
      const step = hlcReceive(
        state,
        formatHlc({ wallMs: remoteWall, counter: 3, deviceId: OTHER }),
        localWall,
      );
      expect(step.hlc > previous).toBe(true);
      previous = step.hlc;
      state = step.state;
    }
  });
});

describe('compareHlc', () => {
  it('orders lexicographically, breaking ties by device', () => {
    expect(compareHlc(`000000000001000-0000-${DEVICE}`, `000000000002000-0000-${DEVICE}`)).toBe(-1);
    expect(compareHlc(`000000000002000-0000-${DEVICE}`, `000000000001000-0000-${DEVICE}`)).toBe(1);
    expect(compareHlc(`000000000001000-0000-${DEVICE}`, `000000000001000-0000-${DEVICE}`)).toBe(0);
    expect(compareHlc(`000000000001000-0000-${OTHER}`, `000000000001000-0000-${DEVICE}`)).toBe(-1);
  });
});
