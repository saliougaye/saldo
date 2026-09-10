import { type HlcState, type HlcString, hlcNow, hlcReceive, initialHlcState } from '@saldo/core';
import type { KvStore } from './kv';

export interface Clock {
  /** Timestamp for a local write. */
  now(): HlcString;
  /** Merges a timestamp pulled from the server and returns the resulting local timestamp. */
  receive(remote: HlcString): HlcString;
}

/**
 * HLC clock persisted in `kv` (§8.2), so timestamps keep increasing across restarts even when the
 * device wall clock jumps backwards.
 */
export function createClock(store: KvStore, wallClock: () => number = Date.now): Clock {
  const load = (): HlcState => store.getJson<HlcState>('hlc') ?? initialHlcState(store.deviceId());
  const save = (state: HlcState): void => {
    store.setJson('hlc', state);
  };
  return {
    now() {
      const step = hlcNow(load(), wallClock());
      save(step.state);
      return step.hlc;
    },
    receive(remote) {
      const step = hlcReceive(load(), remote, wallClock());
      save(step.state);
      return step.hlc;
    },
  };
}
