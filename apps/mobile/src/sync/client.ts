import {
  compareSchemaVersion,
  DATA_RESET_CODE,
  dataEpochResponseSchema,
  MAX_CHANGES_PER_PULL,
  MAX_CHANGES_PER_PUSH,
  pullResponseSchema,
  pushResponseSchema,
  SYNC_SCHEMA_VERSION,
} from '@saldo/core';
import type { Clock } from '../db/clock';
import type { KvStore } from '../db/kv';
import type { RepositoryDatabase } from '../db/repositories/support';
import { DATA_RESET_NOTICE_KEY, hasLocalData, SYNC_EPOCH_KEY, wipeAccountData } from '../db/wipe';
import { log, ms, shortId } from '../log';
import { type ApiClient, ApiClientError } from '../net/apiClient';
import { isSyncedEntity } from './entities';
import { applyPull, markInvalid, markPushed, pendingChanges } from './localStore';

export interface SyncOutcome {
  pushed: number;
  stale: number;
  invalid: number;
  pulled: number;
  errors: number;
}

export interface SyncDeps {
  db: RepositoryDatabase;
  kv: KvStore;
  clock: Clock;
  api: ApiClient;
  deviceId: string;
  /** Runs after a successful cycle: pulled recurrences may owe occurrences (§8.5). */
  materialise?: () => void;
  /**
   * Moves attachment bytes (§10). Runs **after** the rows, because the server refuses blobs for a
   * row it has not been pushed, and its failures are swallowed: a blob that will not upload must
   * not make the whole cycle look broken.
   */
  syncBlobs?: () => Promise<void>;
  /**
   * Deletes this phone's attachment files. Called when the account's data turns out to have been
   * deleted on another device (§8.6); absent in tests that have no files.
   */
  deleteAttachmentFiles?: () => void;
}

function assertSameSchema(peer: number): void {
  const verdict = compareSchemaVersion(peer);
  if (verdict === 'ok') return;
  // §8.1: stop rather than exchange rows one side cannot represent.
  throw new ApiClientError(
    409,
    verdict === 'peer-too-old' ? 'schema_too_old' : 'schema_too_new',
    verdict === 'peer-too-old'
      ? 'The server is older than this app'
      : 'This app is older than the server',
  );
}

/**
 * The generation of the account's data this phone holds (§8.6). Asked of the server once — on the
 * first cycle after signing in — and remembered, so every later push and pull can be refused if
 * the data has been deleted since.
 */
async function knownEpoch(deps: SyncDeps): Promise<number> {
  const stored = Number.parseInt(deps.kv.get(SYNC_EPOCH_KEY) ?? '', 10);
  if (Number.isInteger(stored) && stored >= 0) return stored;
  const { epoch } = await deps.api.get('/api/data', dataEpochResponseSchema);
  deps.kv.set(SYNC_EPOCH_KEY, String(epoch));
  return epoch;
}

/**
 * One cycle (§8.5): push everything pending in batches, then pull until the server says there is
 * nothing left. Push first, so a row this device just wrote wins its own conflict instead of being
 * overwritten by the copy the server still holds.
 *
 * §8.6: if the server says the account's data was deleted since this phone last synced, the phone
 * drops everything it holds — pending writes included, since they belong to the deleted data — and
 * runs the cycle again from nothing. Once, so a server that keeps refusing surfaces as an error.
 */
export async function runSyncCycle(deps: SyncDeps): Promise<SyncOutcome> {
  try {
    return await runOnce(deps);
  } catch (error) {
    if (!(error instanceof ApiClientError) || error.code !== DATA_RESET_CODE) throw error;
    log('sync', 'the account data was deleted on another device, emptying this phone');
    const { epoch } = await deps.api.get('/api/data', dataEpochResponseSchema);
    // Before the wipe: the tabs react to the rows disappearing and read this as they do. Only when
    // there was something to delete — a phone that signed out of one account and into another
    // holds the old account's epoch and nothing else, and nobody deleted anything of this one.
    if (hasLocalData(deps.db)) deps.kv.set(DATA_RESET_NOTICE_KEY, 'true');
    deps.deleteAttachmentFiles?.();
    wipeAccountData(deps.db, epoch);
    return runOnce(deps);
  }
}

async function runOnce(deps: SyncDeps): Promise<SyncOutcome> {
  const outcome: SyncOutcome = { pushed: 0, stale: 0, invalid: 0, pulled: 0, errors: 0 };
  const startedAt = Date.now();
  log('sync', 'cycle started', { device: shortId(deps.deviceId) });
  const epoch = await knownEpoch(deps);

  for (;;) {
    const batch = pendingChanges(deps.db, MAX_CHANGES_PER_PUSH);
    if (batch.length === 0) break;
    log('sync', `pushing ${batch.length} changes`);
    const response = await deps.api.post(
      '/api/sync/push',
      { schemaVersion: SYNC_SCHEMA_VERSION, deviceId: deps.deviceId, epoch, changes: batch },
      pushResponseSchema,
    );
    assertSameSchema(response.schemaVersion);
    let acknowledged = 0;
    for (const result of response.results) {
      if (!isSyncedEntity(result.entity)) continue;
      const pushed = batch.find(
        (change) => change.id === result.id && change.entity === result.entity,
      );
      if (pushed === undefined) continue;
      acknowledged += 1;
      if (result.status === 'invalid') {
        markInvalid(deps.db, result.entity, result.id);
        outcome.invalid += 1;
        continue;
      }
      // `stale` is not a failure: the server holds a newer row and the pull below will bring it.
      markPushed(deps.db, result.entity, result.id, pushed.updatedAt);
      if (result.status === 'stale') outcome.stale += 1;
      else outcome.pushed += 1;
    }
    log('sync', `the server acknowledged ${acknowledged} of ${batch.length}`, {
      pushed: outcome.pushed,
      stale: outcome.stale,
      invalid: outcome.invalid,
    });
    // Nothing acknowledged means nothing moved; looping again would spin forever on the same batch.
    if (acknowledged === 0) {
      // Worth a line of its own: it is the one exit that leaves rows pending with no error to show
      // for it, so a device that never converges looks identical to one with nothing to send.
      log('sync', 'nothing was acknowledged, stopping the push');
      break;
    }
  }

  let since = Number.parseInt(deps.kv.get('syncCursor') ?? '0', 10);
  if (!Number.isFinite(since) || since < 0) since = 0;
  for (;;) {
    const page = await deps.api.get(
      `/api/sync/pull?since=${since}&limit=${MAX_CHANGES_PER_PULL}&epoch=${epoch}`,
      pullResponseSchema,
    );
    assertSameSchema(page.schemaVersion);
    log('sync', `pulled ${page.changes.length} changes from cursor ${since}`, {
      nextSince: page.nextSince,
      hasMore: page.hasMore,
    });
    if (page.changes.length > 0) {
      const applied = applyPull({
        db: deps.db,
        kv: deps.kv,
        clock: deps.clock,
        changes: page.changes,
        nextSince: page.nextSince,
      });
      outcome.pulled += applied.applied;
      outcome.errors += applied.errors;
      // A row the server sent and this device could not write. Silent otherwise: the cycle still
      // succeeds, and the missing row only shows up as a screen that disagrees with another phone.
      if (applied.errors > 0) log('sync', `${applied.errors} pulled rows could not be applied`);
    }
    // Guard against a server that keeps saying `hasMore` without moving the cursor.
    if (!page.hasMore || page.nextSince <= since) break;
    since = page.nextSince;
  }

  deps.materialise?.();
  await deps.syncBlobs?.().catch((error: unknown) => {
    // Swallowed on purpose (see `syncBlobs`), which is exactly why it needs saying out loud: the
    // cycle will report success with the bytes still on the phone.
    log('sync', 'the blob pass failed and the cycle carried on', { error: String(error) });
  });
  log('sync', `cycle finished in ${ms(startedAt)}`, { ...outcome });
  return outcome;
}
