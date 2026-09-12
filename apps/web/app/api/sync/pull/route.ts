import { MAX_CHANGES_PER_PULL, SYNC_SCHEMA_VERSION } from '@saldo/core';
import { z } from 'zod';
import { getDb } from '../../../../src/server/db/client';
import { ApiError, handle } from '../../../../src/server/http/errors';
import { requireUser } from '../../../../src/server/http/requireUser';
import { log, ms, shortId } from '../../../../src/server/log';
import { readPull } from '../../../../src/server/sync/pull';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  since: z.coerce.number().int().nonnegative().default(0),
  limit: z.coerce.number().int().positive().max(MAX_CHANGES_PER_PULL).default(MAX_CHANGES_PER_PULL),
});

export function GET(request: Request): Promise<Response> {
  return handle(async () => {
    const user = await requireUser(request);
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      since: url.searchParams.get('since') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
    });
    if (!parsed.success) {
      throw new ApiError(400, 'invalid_query', 'since and limit must be non-negative integers');
    }
    const startedAt = Date.now();
    const page = await readPull(getDb(), user.id, parsed.data);
    // The cursor is the whole story of a pull: a device that keeps asking from the same `since` is
    // a device whose cursor never advanced, and it will pull the same page forever.
    log('sync', `pull for ${shortId(user.id)} from ${parsed.data.since} in ${ms(startedAt)}`, {
      changes: page.changes.length,
      nextSince: page.nextSince,
      hasMore: page.hasMore,
    });
    return Response.json({ schemaVersion: SYNC_SCHEMA_VERSION, ...page });
  });
}
