import { ApiClientError } from '../net/apiClient';
import {
  BACKOFF_MS,
  createScheduler,
  hasSyncSettled,
  type SyncStatus,
  WRITE_DEBOUNCE_MS,
} from './scheduler';

/** A deferred promise, so a test can hold a cycle open and start a second one. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Stands in for a whole cycle: the scheduler only ever calls it. */
const NO_DEPS = {} as Parameters<NonNullable<Parameters<typeof createScheduler>[0]['runCycle']>>[0];
const NO_OUTCOME = { pushed: 0, stale: 0, invalid: 0, pulled: 0, errors: 0 };

describe('createScheduler', () => {
  it('does nothing while there is no server', async () => {
    const scheduler = createScheduler({ deps: () => null });
    await expect(scheduler.syncNow()).resolves.toBeNull();
    expect(scheduler.status()).toEqual({ kind: 'idle', lastSyncAt: null });
  });

  it('joins a cycle that is already running instead of starting a second one', async () => {
    const gate = deferred<void>();
    let started = 0;
    const scheduler = createScheduler({
      deps: () => NO_DEPS,
      runCycle: async () => {
        started += 1;
        await gate.promise;
        return NO_OUTCOME;
      },
    });

    const first = scheduler.syncNow();
    const second = scheduler.syncNow();
    expect(scheduler.status()).toEqual({ kind: 'syncing' });
    gate.resolve();
    await Promise.all([first, second]);
    // Two triggers, one cycle: pushing the same rows twice would be a real bug.
    expect(started).toBe(1);
  });

  it('walks the backoff on repeated failures and reports the retry time', async () => {
    let clock = 1_000;
    const scheduler = createScheduler({
      now: () => clock,
      deps: () => NO_DEPS,
      runCycle: async () => {
        throw new ApiClientError(503, 'network_error', 'offline');
      },
    });

    await scheduler.syncNow();
    expect(scheduler.status()).toMatchObject({
      kind: 'error',
      code: 'network_error',
      retryAt: clock + BACKOFF_MS[0],
    });
    clock += 1;
    await scheduler.syncNow();
    expect(scheduler.status()).toMatchObject({ retryAt: clock + BACKOFF_MS[1] });
    clock += 1;
    await scheduler.syncNow();
    expect(scheduler.status()).toMatchObject({ retryAt: clock + BACKOFF_MS[2] });
    clock += 1;
    await scheduler.syncNow();
    // The last step is the cap, and it stays there.
    expect(scheduler.status()).toMatchObject({ retryAt: clock + BACKOFF_MS[3] });
  });

  it('parks on session-expired instead of retrying', async () => {
    const scheduler = createScheduler({
      deps: () => NO_DEPS,
      runCycle: async () => {
        throw new ApiClientError(401, 'session_expired', 'sign in again');
      },
    });
    await scheduler.syncNow();
    expect(scheduler.status()).toEqual({ kind: 'session-expired' });
  });

  it('reports a successful cycle as idle with the time it finished', async () => {
    const scheduler = createScheduler({
      now: () => 42,
      deps: () => NO_DEPS,
      runCycle: async () => NO_OUTCOME,
    });
    await expect(scheduler.syncNow()).resolves.toEqual(NO_OUTCOME);
    expect(scheduler.status()).toEqual({ kind: 'idle', lastSyncAt: 42 });
  });

  it('coalesces a burst of write requests into one cycle', () => {
    const timers: { fn: () => void; ms: number }[] = [];
    let cleared = 0;
    const scheduler = createScheduler({
      deps: () => null,
      setTimer: (fn, ms) => {
        timers.push({ fn, ms });
        return timers.length as unknown as ReturnType<typeof setTimeout>;
      },
      clearTimer: () => {
        cleared += 1;
      },
    });

    scheduler.requestSync();
    scheduler.requestSync();
    scheduler.requestSync();
    // Each request replaces the pending timer, so three writes cost one cycle.
    expect(timers).toHaveLength(3);
    expect(cleared).toBe(2);
    expect(timers[0]?.ms).toBe(WRITE_DEBOUNCE_MS);
  });

  it('publishes status to its subscribers and stops after stop()', async () => {
    const seen: SyncStatus[] = [];
    const scheduler = createScheduler({ deps: () => null });
    const unsubscribe = scheduler.subscribe((status) => seen.push(status));
    await scheduler.syncNow();
    unsubscribe();
    scheduler.stop();
    await expect(scheduler.syncNow()).resolves.toBeNull();
    expect(seen).toEqual([]);
  });
});

describe('hasSyncSettled', () => {
  it('is false before the first cycle and while one runs', () => {
    expect(hasSyncSettled({ kind: 'idle', lastSyncAt: null })).toBe(false);
    expect(hasSyncSettled({ kind: 'syncing' })).toBe(false);
  });

  it('is true once a cycle has finished, failed or lost the session', () => {
    expect(hasSyncSettled({ kind: 'idle', lastSyncAt: 1 })).toBe(true);
    expect(hasSyncSettled({ kind: 'error', code: 'network_error', message: 'x', retryAt: 1 })).toBe(
      true,
    );
    expect(hasSyncSettled({ kind: 'session-expired' })).toBe(true);
  });
});
