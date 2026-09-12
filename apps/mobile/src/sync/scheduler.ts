import { ApiClientError } from '../net/apiClient';
import { runSyncCycle, type SyncDeps, type SyncOutcome } from './client';

/** §8.5. */
export const BACKOFF_MS = [5_000, 15_000, 60_000, 300_000] as const;
export const FOREGROUND_INTERVAL_MS = 60_000;
export const WRITE_DEBOUNCE_MS = 2_000;

/** Codes that mean "this session is over", not "try again later". */
const SESSION_CODES = new Set(['no_session', 'session_expired', 'invalid_token', 'invalid_grant']);

export type SyncStatus =
  | { kind: 'idle'; lastSyncAt: number | null }
  | { kind: 'syncing' }
  | { kind: 'error'; code: string; message: string; retryAt: number }
  | { kind: 'session-expired' };

/**
 * True once the first cycle has finished, however it finished. Boot waits for this before deciding
 * that a signed-in device needs onboarding (§6.29): the account's own settings row may still be
 * on its way down, and seeding over it fails on the `settings.id` unique constraint.
 */
export function hasSyncSettled(status: SyncStatus): boolean {
  return status.kind === 'idle' ? status.lastSyncAt !== null : status.kind !== 'syncing';
}

export interface Scheduler {
  /**
   * Undoes `stop`. React mounts an effect twice in development — run, clean up, run — and the
   * cleanup stops this scheduler while the second run reuses the same memoised instance, so a stop
   * that could not be undone would make every later cycle a silent no-op.
   */
  start(): void;
  /** Runs a cycle unless one is already running, in which case it joins it. */
  syncNow(): Promise<SyncOutcome | null>;
  /** Coalesces bursts of local writes into one cycle (§8.5). */
  requestSync(): void;
  status(): SyncStatus;
  subscribe(listener: (status: SyncStatus) => void): () => void;
  stop(): void;
}

export interface SchedulerOptions {
  /** Null while the app is local-only or signed out, which makes every trigger a no-op. */
  deps: () => SyncDeps | null;
  /** The cycle to run. Injectable so this module's own tests exercise the scheduling, not sync. */
  runCycle?: (deps: SyncDeps) => Promise<SyncOutcome>;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (handle: ReturnType<typeof setTimeout>) => void;
}

/**
 * Serialises sync cycles. Never two at once (§8.5): two concurrent cycles would push the same rows
 * twice and race each other's cursor write. Failures walk `BACKOFF_MS`; an expired session parks
 * the app in `session-expired`, where local use carries on as normal.
 */
export function createScheduler(options: SchedulerOptions): Scheduler {
  const runCycle = options.runCycle ?? runSyncCycle;
  const now = options.now ?? Date.now;
  const setTimer = options.setTimer ?? setTimeout;
  const clearTimer = options.clearTimer ?? clearTimeout;

  let inFlight: Promise<SyncOutcome | null> | null = null;
  let failures = 0;
  let debounce: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let status: SyncStatus = { kind: 'idle', lastSyncAt: null };
  const listeners = new Set<(next: SyncStatus) => void>();

  const publish = (next: SyncStatus): void => {
    status = next;
    for (const listener of listeners) listener(next);
  };

  const cycle = async (): Promise<SyncOutcome | null> => {
    try {
      /**
       * Inside the `try`, and this matters more than it looks: assembling the dependencies reads
       * the device id out of SQLite and builds a clock, either of which can throw. Outside, a
       * throw here escaped as a rejected promise that every caller discards with `void` — no
       * status, no log, and `hasSyncSettled` false forever, which parks the boot screen on a
       * spinner that nothing will ever clear.
       */
      const deps = options.deps();
      if (deps === null) {
        // Nothing to sync with. Still a finished cycle: saying so is what lets the boot router
        // stop waiting.
        publish({ kind: 'idle', lastSyncAt: now() });
        return null;
      }
      publish({ kind: 'syncing' });
      const outcome = await runCycle(deps);
      failures = 0;
      publish({ kind: 'idle', lastSyncAt: now() });
      return outcome;
    } catch (error) {
      const code = error instanceof ApiClientError ? error.code : 'network_error';
      const message = error instanceof Error ? error.message : 'Sync failed';
      if (SESSION_CODES.has(code)) {
        publish({ kind: 'session-expired' });
        return null;
      }
      const delay = BACKOFF_MS[Math.min(failures, BACKOFF_MS.length - 1)] ?? 300_000;
      failures += 1;
      publish({ kind: 'error', code, message, retryAt: now() + delay });
      return null;
    }
  };

  const scheduler: Scheduler = {
    start() {
      stopped = false;
    },
    syncNow() {
      if (stopped) return Promise.resolve(null);
      inFlight ??= cycle().finally(() => {
        inFlight = null;
      });
      return inFlight;
    },
    requestSync() {
      if (stopped) return;
      if (debounce !== null) clearTimer(debounce);
      debounce = setTimer(() => {
        debounce = null;
        void scheduler.syncNow();
      }, WRITE_DEBOUNCE_MS);
    },
    status: () => status,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    stop() {
      stopped = true;
      if (debounce !== null) clearTimer(debounce);
      debounce = null;
      listeners.clear();
    },
  };
  return scheduler;
}
