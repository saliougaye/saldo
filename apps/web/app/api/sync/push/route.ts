import { compareSchemaVersion, pushRequestSchema, SYNC_SCHEMA_VERSION } from '@saldo/core';
import { drainDeletedBlobs, enqueueDeletedBlobs } from '../../../../src/server/attachments/cleanup';
import { getDb } from '../../../../src/server/db/client';
import { ApiError, handle } from '../../../../src/server/http/errors';
import { readJson } from '../../../../src/server/http/json';
import { requireUser } from '../../../../src/server/http/requireUser';
import { log, ms, shortId } from '../../../../src/server/log';
import { getStore } from '../../../../src/server/storage';
import { applyPush } from '../../../../src/server/sync/push';

export const runtime = 'nodejs';

/** §18: the sync body cap. 500 entity rows fit well inside it. */
const MAX_BODY_BYTES = 5 * 1024 * 1024;

export function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const now = new Date();
    const startedAt = Date.now();
    const user = await requireUser(request);
    const body = await readJson(request, pushRequestSchema, MAX_BODY_BYTES);
    log('sync', `push from ${shortId(user.id)}`, {
      device: shortId(body.deviceId),
      changes: body.changes.length,
      schemaVersion: body.schemaVersion,
    });

    // §8.1: refuse rather than let rows the peer cannot represent diverge silently.
    const verdict = compareSchemaVersion(body.schemaVersion);
    if (verdict !== 'ok') {
      const code = verdict === 'peer-too-new' ? 'schema_too_new' : 'schema_too_old';
      const fix = verdict === 'peer-too-new' ? 'Update the server.' : 'Update the app.';
      throw new ApiError(
        409,
        code,
        `This server speaks sync schema ${SYNC_SCHEMA_VERSION}; the app speaks ${body.schemaVersion}. ${fix}`,
      );
    }

    const results = await applyPush(getDb(), user.id, body, now);
    // `stale` and `invalid` are the two the app cannot explain on its own: one means the server
    // held a newer row, the other that it refused the row outright.
    log('sync', `push from ${shortId(user.id)} answered in ${ms(startedAt)}`, {
      applied: results.filter((result) => result.status === 'applied').length,
      stale: results.filter((result) => result.status === 'stale').length,
      invalid: results.filter((result) => result.status === 'invalid').length,
    });

    // Blob housekeeping rides along with the push, and its failures stay here: a store that is
    // unreachable must not turn somebody's sync into an error (§10).
    void (async () => {
      const store = await getStore();
      if (store === null) return;
      await enqueueDeletedBlobs(getDb(), user.id, body.changes, now);
      await drainDeletedBlobs(getDb(), store, now);
    })().catch((error: unknown) => {
      console.error('[saldo] blob cleanup failed', error);
    });

    return Response.json({
      schemaVersion: SYNC_SCHEMA_VERSION,
      serverTime: now.toISOString(),
      results,
    });
  });
}
