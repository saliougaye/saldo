/**
 * Which account the rows on this phone belong to. Written at sign-in, wiped with everything else
 * by a device reset, and never synced — it says something about this device, not about the data.
 */
export const DEVICE_ACCOUNT_KEY = 'accountId';

export type OwnershipVerdict =
  /** Same account as last time, or nothing to lose: sign in and keep what is here. */
  | 'keep'
  /** Somebody else's rows are on this phone: they have to go before the new account syncs. */
  | 'foreign-data'
  /**
   * Rows written before any account signed in on this phone (local-only, §6.29 step 0). They can
   * join the account — pushed, merged with what it holds — or be deleted for the server's copy.
   */
  | 'unowned-data';

/**
 * §9.5. Nothing on the phone records who wrote a row — `pendingChanges` selects on `sync_state`
 * alone — so signing a second account in would show it the first one's data *and push whatever was
 * still pending into its server rows*. This is the check that stops that, and it runs before the
 * session is installed, because `SyncProvider` starts a cycle the moment a user appears.
 *
 * `storedAccountId` is null on a fresh install, on a phone that started local-only, and on any
 * install that predates this check. None of that is evidence the rows belong to somebody else, so
 * they are not treated as foreign — but pushing them into an account is not a given either, so
 * the user is asked (`unowned-data`).
 *
 * An empty database is `keep` whatever the ids say: there is nothing to lose and no question worth
 * putting to somebody who has just signed in.
 */
export function ownershipVerdict(
  storedAccountId: string | null,
  incomingAccountId: string,
  hasLocalData: boolean,
): OwnershipVerdict {
  if (!hasLocalData) return 'keep';
  if (storedAccountId === null) return 'unowned-data';
  return storedAccountId === incomingAccountId ? 'keep' : 'foreign-data';
}
