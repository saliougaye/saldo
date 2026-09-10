import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { useServer } from '../auth/ServerProvider';
import { db } from '../db/client';
import { createClock } from '../db/clock';
import { useDatabase } from '../db/DatabaseProvider';
import { runMaterialiser } from '../db/recurrenceService';
import { usePeriod } from '../features/period/PeriodProvider';
import {
  createScheduler,
  FOREGROUND_INTERVAL_MS,
  type Scheduler,
  type SyncStatus,
} from './scheduler';

export interface SyncValue {
  status: SyncStatus;
  /** Null while the app is local-only: every trigger is then a no-op. */
  scheduler: Scheduler | null;
}

const IDLE: SyncStatus = { kind: 'idle', lastSyncAt: null };

const SyncContext = createContext<SyncValue>({ status: IDLE, scheduler: null });

/**
 * Wires the scheduler to the app's lifecycle (§8.5): a cycle on mount, one on every return to the
 * foreground, and one a minute while the app is in front. Mounted under `PeriodProvider` because
 * the materialiser it runs after a pull needs `cycleStartDay`.
 */
export function SyncProvider({ children }: { children: ReactNode }) {
  const { kv, repos } = useDatabase();
  const { api, user } = useServer();
  const { today, def } = usePeriod();
  const [status, setStatus] = useState<SyncStatus>(IDLE);

  const scheduler = useMemo(() => {
    if (api === null) return null;
    return createScheduler({
      deps: () => ({
        db,
        kv,
        // A second clock instance over the same `kv` is safe: the HLC state is read and written
        // there on every step, so there is nothing cached in the object to fork.
        clock: createClock(kv),
        api,
        deviceId: kv.deviceId(),
        // A pulled recurrence may owe occurrences; the materialiser is idempotent.
        materialise: () => runMaterialiser(db, repos, today, def),
      }),
    });
  }, [api, kv, repos, today, def]);

  useEffect(() => {
    // No scheduler means local-only; no user means signed out, and a cycle would only 401.
    if (scheduler === null || user === null) {
      setStatus(IDLE);
      return;
    }
    const unsubscribe = scheduler.subscribe(setStatus);
    void scheduler.syncNow();
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') void scheduler.syncNow();
    }, FOREGROUND_INTERVAL_MS);
    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') void scheduler.syncNow();
    });
    return () => {
      unsubscribe();
      clearInterval(interval);
      appState.remove();
      scheduler.stop();
    };
  }, [scheduler, user]);

  const value = useMemo<SyncValue>(() => ({ status, scheduler }), [status, scheduler]);
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncValue {
  return useContext(SyncContext);
}
