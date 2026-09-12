import type { SyncStatus } from '../sync/scheduler';

/** What the boot router should do. One of these, and nothing else, decides the first screen. */
export type BootDecision =
  /** §6.32: the lock outranks everything, including not being signed in. */
  | { kind: 'lock' }
  /** The session or the settings row is still being read. Short, and wordless. */
  | { kind: 'loading' }
  /** §6.29 step 0: no session, so no account, so nothing else can be decided. */
  | { kind: 'welcome' }
  /** Signed in, no settings here yet, and the account has not finished being asked about. */
  | { kind: 'waiting-for-sync' }
  /**
   * Signed in, no settings here, and the server could not be reached to find out whether the
   * account has any. Neither onboarding nor the tabs is safe, so the app says so and offers to try
   * again.
   */
  | { kind: 'sync-unreachable'; code: string }
  /** The account really is empty, or its onboarding was never finished. */
  | { kind: 'onboarding' }
  | { kind: 'tabs' };

export interface BootInput {
  locked: boolean;
  session: 'loading' | 'signed-out' | 'signed-in';
  /** False until the settings query has produced its first result. */
  settingsLoaded: boolean;
  /** Null when this device holds no settings row. */
  onboardingCompletedAt: string | null | undefined;
  hasSettings: boolean;
  /** False on a local-only build, where there is no sync to wait for. */
  hasScheduler: boolean;
  syncStatus: SyncStatus;
}

/**
 * Whether the first cycle has told us anything about the account yet.
 *
 * This is deliberately **not** `hasSyncSettled`. That one answers "is the attempt over", which is
 * what the spinner needs; this one answers "do we know what this account holds", which is what the
 * decision below needs. A cycle that failed has settled and knows nothing, and the difference
 * between the two is an account being sent back through onboarding it finished months ago.
 */
function firstSync(status: SyncStatus): 'pending' | 'answered' | 'failed' {
  switch (status.kind) {
    case 'syncing':
      return 'pending';
    case 'idle':
      return status.lastSyncAt === null ? 'pending' : 'answered';
    case 'error':
      return 'failed';
    case 'session-expired':
      // The account exists and this device simply cannot reach it right now. Onboarding would
      // seed over rows that are sitting on the server.
      return 'failed';
  }
}

/**
 * §6.29, §6.32. Pure, because every version of this that lived inside the screen grew a way to
 * strand somebody: first a spinner nothing could clear, then an onboarding offered to an account
 * that had years of data waiting on its server.
 *
 * The rule that matters: **onboarding needs evidence, not the absence of evidence.** An empty
 * database on this phone is not proof the account is new — it is equally what a phone that has
 * never synced looks like. Only a cycle that came back says which.
 */
export function decideBoot(input: BootInput): BootDecision {
  if (input.locked) return { kind: 'lock' };
  if (input.session === 'loading' || !input.settingsLoaded) return { kind: 'loading' };
  if (input.session === 'signed-out') return { kind: 'welcome' };

  if (!input.hasSettings) {
    // A local-only build has no server to ask, so its empty database is all the evidence there is.
    if (!input.hasScheduler) return { kind: 'onboarding' };
    const answer = firstSync(input.syncStatus);
    if (answer === 'pending') return { kind: 'waiting-for-sync' };
    if (answer === 'failed') {
      return {
        kind: 'sync-unreachable',
        code: input.syncStatus.kind === 'error' ? input.syncStatus.code : input.syncStatus.kind,
      };
    }
    // The cycle came back and brought no settings: the account really is new.
    return { kind: 'onboarding' };
  }

  // Settings are here. Whether they arrived by sync or by onboarding does not matter any more —
  // what is left is whether the person ever finished.
  return input.onboardingCompletedAt === null || input.onboardingCompletedAt === undefined
    ? { kind: 'onboarding' }
    : { kind: 'tabs' };
}
