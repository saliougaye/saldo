import { requireAttachment } from '../../../../../src/server/attachments/row';
import { getDb } from '../../../../../src/server/db/client';
import { ApiError, handle } from '../../../../../src/server/http/errors';
import { requireUser } from '../../../../../src/server/http/requireUser';
import { getStore, objectKey } from '../../../../../src/server/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * §10, the second half of a presigned upload. The server never saw the bytes, so all it can do is
 * ask the store whether they arrived and whether there are as many as the row promised. The hash
 * is checked by whoever downloads them.
 */
export function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const user = await requireUser(request);
    const { id } = await context.params;
    const row = await requireAttachment(getDb(), user.id, id);

    const store = await getStore();
    if (store === null) {
      throw new ApiError(409, 'no_storage', 'This server keeps no attachments');
    }

    const size = await store.head(objectKey(user.id, id));
    if (size === null || size !== row.byteSize) {
      // The client retries: an interrupted upload leaves either nothing or a short object.
      throw new ApiError(409, 'not_uploaded', 'The bytes did not arrive, or are incomplete');
    }
    return new Response(null, { status: 204 });
  });
}
