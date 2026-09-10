/**
 * Hybrid logical clock (§8.2). `{wallMs padded to 15}-{counter base36 padded to 4}-{deviceId}`,
 * so lexicographic order is causal order and `deviceId` breaks ties.
 *
 * Pure by design (§3.2): the wall clock is an argument, never read inside. The caller owns
 * persistence — on mobile the state lives in the `kv` table so it survives restarts.
 */
export interface Hlc {
  wallMs: number;
  counter: number;
  deviceId: string;
}

/** Serialised HLC, as stored in `updatedAt`. */
export type HlcString = string;

export interface HlcState {
  wallMs: number;
  counter: number;
  deviceId: string;
}

export interface HlcStep {
  hlc: HlcString;
  state: HlcState;
}

const WALL_DIGITS = 15;
const COUNTER_DIGITS = 4;
const HLC_RE = /^(\d{15})-([0-9a-z]{4})-([0-9A-Za-z_-]+)$/;

export function initialHlcState(deviceId: string): HlcState {
  return { wallMs: 0, counter: 0, deviceId };
}

export function formatHlc(hlc: Hlc): HlcString {
  const wall = String(hlc.wallMs).padStart(WALL_DIGITS, '0');
  const counter = hlc.counter.toString(36).padStart(COUNTER_DIGITS, '0');
  return `${wall}-${counter}-${hlc.deviceId}`;
}

/** Whether a string is a well-formed HLC. Used by the sync protocol schemas. */
export function isHlc(value: string): boolean {
  return HLC_RE.test(value);
}

export function parseHlc(value: HlcString): Hlc {
  const match = HLC_RE.exec(value);
  if (!match) throw new RangeError(`Invalid HLC: ${value}`);
  const wall = match[1] ?? '';
  const counter = match[2] ?? '';
  const deviceId = match[3] ?? '';
  return { wallMs: Number(wall), counter: Number.parseInt(counter, 36), deviceId };
}

/** Next timestamp for a local write. */
export function hlcNow(state: HlcState, wallMs: number): HlcStep {
  const wall = Math.max(wallMs, state.wallMs);
  const counter = wall === state.wallMs ? state.counter + 1 : 0;
  const next: HlcState = { wallMs: wall, counter, deviceId: state.deviceId };
  return { hlc: formatHlc(next), state: next };
}

/** Merges a remote timestamp into the local clock, then returns the next local timestamp. */
export function hlcReceive(state: HlcState, remote: HlcString, wallMs: number): HlcStep {
  const parsed = parseHlc(remote);
  const wall = Math.max(wallMs, state.wallMs, parsed.wallMs);
  let counter: number;
  if (wall === state.wallMs && wall === parsed.wallMs) {
    counter = Math.max(state.counter, parsed.counter) + 1;
  } else if (wall === state.wallMs) {
    counter = state.counter + 1;
  } else if (wall === parsed.wallMs) {
    counter = parsed.counter + 1;
  } else {
    counter = 0;
  }
  const next: HlcState = { wallMs: wall, counter, deviceId: state.deviceId };
  return { hlc: formatHlc(next), state: next };
}

export function compareHlc(a: HlcString, b: HlcString): -1 | 0 | 1 {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
