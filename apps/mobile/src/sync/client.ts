import {
  compareSchemaVersion,
  MAX_CHANGES_PER_PULL,
  MAX_CHANGES_PER_PUSH,
  pullResponseSchema,
  pushResponseSchema,
  SYNC_SCHEMA_VERSION,
} from '@saldo/core';
import type { Clock } from '../db/clock';
import type { KvStore } from '../db/kv';
import type { RepositoryDatabase } from '../db/repositories/support';
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
 * One cycle (§8.5): push everything pending in batches, then pull until the server says there is
 * nothing left. Push first, so a row this device just wrote wins its own conflict instead of being
 * overwritten by the copy the server still holds.
 */
export async function runSyncCycle(deps: SyncDeps): Promise<SyncOutcome> {
  const outcome: SyncOutcome = { pushed: 0, stale: 0, invalid: 0, pulled: 0, errors: 0 };

  for (;;) {
    const batch = pendingChanges(deps.db, MAX_CHANGES_PER_PUSH);
    if (batch.length === 0) break;
    const response = await deps.api.post(
      '/api/sync/push',
      { schemaVersion: SYNC_SCHEMA_VERSION, deviceId: deps.deviceId, changes: batch },
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
    // Nothing acknowledged means nothing moved; looping again would spin forever on the same batch.
    if (acknowledged === 0) break;
  }

  let since = Number.parseInt(deps.kv.get('syncCursor') ?? '0', 10);
  if (!Number.isFinite(since) || since < 0) since = 0;
  for (;;) {
    const page = await deps.api.get(
      `/api/sync/pull?since=${since}&limit=${MAX_CHANGES_PER_PULL}`,
      pullResponseSchema,
    );
    assertSameSchema(page.schemaVersion);
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
    }
    // Guard against a server that keeps saying `hasMore` without moving the cursor.
    if (!page.hasMore || page.nextSince <= since) break;
    since = page.nextSince;
  }

  deps.materialise?.();
  return outcome;
}
