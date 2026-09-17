import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { deleteAllAttachmentFiles, readBytes, storeBytes } from '../attachments/localFiles';
import { useServer } from '../auth/ServerProvider';
import { db } from '../db/client';
import { createClock } from '../db/clock';
import { useDatabase } from '../db/DatabaseProvider';
import { runMaterialiser } from '../db/recurrenceService';
import { usePeriod } from '../features/period/PeriodProvider';
import { log } from '../log';
import { uploadPendingBlobs } from './blobSync';
import { createScheduler, FOREGROUND_INTERVAL_MS, type SyncStatus } from './scheduler';
import { IDLE, SyncContext, type SyncValue } from './syncContext';

export { type SyncValue, useSync } from './syncContext';

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
        syncBlobs: async () => {
          if (api === null) return;
          await uploadPendingBlobs({ repos, api, readBytes, storeBytes });
        },
        deleteAttachmentFiles: deleteAllAttachmentFiles,
      }),
    });
  }, [api, kv, repos, today, def]);

  useEffect(() => {
    // No scheduler means local-only; no user means signed out, and a cycle would only 401.
    if (scheduler === null || user === null) {
      log('sync', 'no cycle to run', {
        scheduler: scheduler === null ? 'none' : 'ready',
        signedIn: user !== null,
      });
      setStatus(IDLE);
      return;
    }
    // React mounts this twice in development, and the cleanup below stops the scheduler; the
    // instance is memoised, so without this the second mount would hold a permanently stopped one.
    scheduler.start();
    log('sync', 'scheduler armed, running the first cycle');
    const unsubscribe = scheduler.subscribe((next) => {
      // Every transition, because the boot router blocks on this status and a cycle that never
      // leaves `syncing` is the difference between a slow start and a permanent spinner.
      log('sync', `status: ${next.kind}`, next.kind === 'error' ? { code: next.code } : undefined);
      setStatus(next);
    });
    scheduler.syncNow().catch((error: unknown) => {
      // The cycle publishes its own failures, so reaching here means something escaped even that.
      // It used to be discarded silently, which is how a dead cycle looked like a slow one.
      log('sync', 'the first cycle threw outside the cycle', { error: String(error) });
    });
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') void scheduler.syncNow();
    }, FOREGROUND_INTERVAL_MS);
    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') void scheduler.syncNow();
    });
    return () => {
      // Worth seeing: if this prints repeatedly without a cycle finishing in between, the
      // scheduler is being rebuilt and no cycle will ever settle.
      log('sync', 'scheduler torn down');
      unsubscribe();
      clearInterval(interval);
      appState.remove();
      scheduler.stop();
    };
  }, [scheduler, user]);

  const canSync = scheduler !== null && user !== null;
  const value = useMemo<SyncValue>(
    () => ({ status, scheduler, canSync }),
    [status, scheduler, canSync],
  );
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}
