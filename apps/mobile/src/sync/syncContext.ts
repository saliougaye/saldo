import { createContext, useContext } from 'react';
import type { Scheduler, SyncStatus } from './scheduler';

export interface SyncValue {
  status: SyncStatus;
  /** Null while the app is local-only: every trigger is then a no-op. */
  scheduler: Scheduler | null;
  /**
   * True when a cycle asked for by hand would actually run: there is a scheduler and somebody is
   * signed in. Signed out, the scheduler still exists but a cycle would only 401.
   */
  canSync: boolean;
}

export const IDLE: SyncStatus = { kind: 'idle', lastSyncAt: null };

/**
 * The context on its own, apart from `SyncProvider`. The provider has to import the database and
 * the server connection; a component that only reads the context — `Screen`, through pull to
 * refresh — must not, or every test that renders a screen opens SQLite on import.
 */
export const SyncContext = createContext<SyncValue>({
  status: IDLE,
  scheduler: null,
  canSync: false,
});

export function useSync(): SyncValue {
  return useContext(SyncContext);
}
