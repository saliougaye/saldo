import type { SyncStatus } from './scheduler';

/** Error codes a retry cannot fix, which get their own wording. */
const CODE_KEYS: Record<string, string> = {
  schema_too_old: 'sync.schemaTooOld',
  schema_too_new: 'sync.schemaTooNew',
};

/**
 * What a pull to refresh says once its cycle is over, as a catalog key, or null for nothing.
 *
 * A cycle that worked says nothing: the rows it brought are already on screen. One that did not has
 * to say so, because Saldo carries on locally either way and a spinner that simply stops reads as
 * success.
 */
export function pullFeedbackKey(status: SyncStatus): string | null {
  switch (status.kind) {
    case 'idle':
    case 'syncing':
      return null;
    case 'session-expired':
      return 'sync.sessionExpired';
    case 'error':
      return CODE_KEYS[status.code] ?? 'sync.pullFailed';
  }
}
