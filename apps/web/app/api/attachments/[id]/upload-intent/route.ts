import { MAX_ATTACHMENT_BYTES } from '@saldo/core';
import { z } from 'zod';
import { requireAttachment } from '../../../../../src/server/attachments/row';
import { getDb } from '../../../../../src/server/db/client';
import { ApiError, handle } from '../../../../../src/server/http/errors';
import { requireUser } from '../../../../../src/server/http/requireUser';
import { getStore, objectKey } from '../../../../../src/server/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  size: z.number().int().positive().max(MAX_ATTACHMENT_BYTES),
  mimeType: z.string().min(1),
});

/**
 * §10, the first half of an upload: the client asks *where* to put the bytes and the server
 * answers with the only mode it can serve. This exists because a serverless request body caps at
 * a few megabytes while an attachment may be 10 MB — so on S3 the client uploads directly, and on
 * a disk it uploads through here.
 */
export function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const user = await requireUser(request);
    const { id } = await context.params;
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(400, 'invalid_body', 'size and mimeType are required');
    }

    const row = await requireAttachment(getDb(), user.id, id);
    // The row is the authority on what this attachment is: an intent that disagrees with it would
    // put bytes behind a hash and a size nobody will ever match.
    if (parsed.data.size !== row.byteSize) {
      throw new ApiError(413, 'size_mismatch', 'That is not the size this attachment declared');
    }
    if (parsed.data.mimeType !== row.mimeType) {
      throw new ApiError(415, 'type_mismatch', 'That is not the type this attachment declared');
    }

    const store = await getStore();
    if (store === null) {
      throw new ApiError(409, 'no_storage', 'This server keeps no attachments');
    }

    const key = objectKey(user.id, id);
    const meta = { size: row.byteSize, mimeType: row.mimeType };
    if (store.presignPut !== undefined) {
      const target = await store.presignPut(key, meta);
      return Response.json({ mode: 'presigned', ...target });
    }
    return Response.json({ mode: 'direct' });
  });
}
