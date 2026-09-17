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
  it('settles even when there is nothing to sync with', async () => {
    const scheduler = createScheduler({ deps: () => null, now: () => 1_000 });
    await expect(scheduler.syncNow()).resolves.toBeNull();
    // Not silence. Boot blocks until the first cycle has settled, so a cycle that finds nothing to
    // do has to *say* it finished — leaving the status at its initial value parks the app on a
    // spinner with no way out.
    expect(scheduler.status()).toEqual({ kind: 'idle', lastSyncAt: 1_000 });
    expect(hasSyncSettled(scheduler.status())).toBe(true);
  });

  it('reports a failure to even assemble the cycle, rather than going quiet', async () => {
    const scheduler = createScheduler({
      deps: () => {
        throw new Error('no device id');
      },
      now: () => 2_000,
    });
    await expect(scheduler.syncNow()).resolves.toBeNull();
    const status = scheduler.status();
    // `deps()` used to run outside the try, so anything it threw escaped as a rejected promise
    // that the caller discarded with `void` — no status, no log, and a boot screen that waited
    // forever for a cycle that had already died.
    expect(status.kind).toBe('error');
    expect(hasSyncSettled(status)).toBe(true);
  });

  it('can be armed again after it was stopped', async () => {
    // React mounts effects twice in development: run, clean up, run. The cleanup stops the
    // scheduler, and the second run reuses the same memoised instance — so a stop that could not
    // be undone made every later cycle a no-op and nothing ever settled.
    const scheduler = createScheduler({ deps: () => NO_DEPS, runCycle: async () => NO_OUTCOME });
    scheduler.stop();
    await expect(scheduler.syncNow()).resolves.toBeNull();

    scheduler.start();
    await expect(scheduler.syncNow()).resolves.toEqual(NO_OUTCOME);
    expect(hasSyncSettled(scheduler.status())).toBe(true);
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
    const scheduler = createScheduler({
      deps: () => NO_DEPS,
      runCycle: async () => NO_OUTCOME,
      now: () => 1_000,
    });
    const unsubscribe = scheduler.subscribe((status) => seen.push(status));
    await scheduler.syncNow();
    expect(seen).toEqual([{ kind: 'syncing' }, { kind: 'idle', lastSyncAt: 1_000 }]);

    unsubscribe();
    scheduler.stop();
    await expect(scheduler.syncNow()).resolves.toBeNull();
    // Nothing after the unsubscribe, and the stopped scheduler ran no further cycle.
    expect(seen).toHaveLength(2);
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

describe('exclusive', () => {
  it('waits for the cycle in flight before running the task', async () => {
    const cycle = deferred<typeof NO_OUTCOME>();
    const scheduler = createScheduler({ deps: () => NO_DEPS, runCycle: () => cycle.promise });
    const order: string[] = [];
    void scheduler.syncNow().then(() => order.push('cycle'));

    const task = scheduler.exclusive(async () => {
      order.push('task');
      return 7;
    });
    await Promise.resolve();
    expect(order).toEqual([]);

    cycle.resolve(NO_OUTCOME);
    await expect(task).resolves.toBe(7);
    expect(order).toEqual(['cycle', 'task']);
  });

  it('starts no cycle while the task runs, and syncs normally afterwards', async () => {
    let cycles = 0;
    const scheduler = createScheduler({
      deps: () => NO_DEPS,
      runCycle: async () => {
        cycles += 1;
        return NO_OUTCOME;
      },
    });
    const gate = deferred<void>();
    const running = scheduler.exclusive(() => gate.promise);

    const joined = scheduler.syncNow();
    gate.resolve();
    await running;

    await expect(joined).resolves.toBeNull();
    expect(cycles).toBe(0);
    await scheduler.syncNow();
    expect(cycles).toBe(1);
  });

  it('lets cycles run again when the task fails', async () => {
    let cycles = 0;
    const scheduler = createScheduler({
      deps: () => NO_DEPS,
      runCycle: async () => {
        cycles += 1;
        return NO_OUTCOME;
      },
    });

    await expect(
      scheduler.exclusive(async () => {
        throw new Error('offline');
      }),
    ).rejects.toThrow('offline');

    await scheduler.syncNow();
    expect(cycles).toBe(1);
  });
});
