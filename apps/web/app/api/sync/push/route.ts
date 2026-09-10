import { compareSchemaVersion, pushRequestSchema, SYNC_SCHEMA_VERSION } from '@saldo/core';
import { getDb } from '../../../../src/server/db/client';
import { ApiError, handle } from '../../../../src/server/http/errors';
import { readJson } from '../../../../src/server/http/json';
import { requireUser } from '../../../../src/server/http/requireUser';
import { applyPush } from '../../../../src/server/sync/push';

export const runtime = 'nodejs';

/** §18: the sync body cap. 500 entity rows fit well inside it. */
const MAX_BODY_BYTES = 5 * 1024 * 1024;

export function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const now = new Date();
    const user = await requireUser(request, now);
    const body = await readJson(request, pushRequestSchema, MAX_BODY_BYTES);

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
    return Response.json({
      schemaVersion: SYNC_SCHEMA_VERSION,
      serverTime: now.toISOString(),
      results,
    });
  });
}
