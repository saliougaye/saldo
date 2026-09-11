import { createHash } from 'node:crypto';
import { requireAttachment } from '../../../../src/server/attachments/row';
import { getDb } from '../../../../src/server/db/client';
import { ApiError, handle } from '../../../../src/server/http/errors';
import { requireUser } from '../../../../src/server/http/requireUser';
import { getStore, objectKey } from '../../../../src/server/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** §10: the direct upload, for a store with no URLs of its own. */
export function PUT(
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

    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.byteLength !== row.byteSize) {
      throw new ApiError(413, 'size_mismatch', 'The body is not the size this attachment declared');
    }
    // Verified here because here the server *has* the bytes. A presigned upload cannot do this,
    // which is why whoever downloads them checks the same hash again (§10).
    const digest = createHash('sha256').update(bytes).digest('hex');
    if (digest !== row.sha256) {
      throw new ApiError(422, 'hash_mismatch', 'The body does not match the recorded hash');
    }

    await store.put(objectKey(user.id, id), bytes, {
      size: row.byteSize,
      mimeType: row.mimeType,
    });
    return new Response(null, { status: 204 });
  });
}

/**
 * §10: download. A store that can sign URLs gets out of the way with a redirect; the others are
 * proxied, which is also what keeps a Vercel Blob URL — public to anyone holding it — from ever
 * reaching a client.
 */
export function GET(
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

    const key = objectKey(user.id, id);
    if (store.presignGet !== undefined) {
      return Response.redirect(await store.presignGet(key), 302);
    }
    const bytes = await store.get(key);
    if (bytes === null) {
      throw new ApiError(404, 'not_uploaded', 'The bytes of this attachment are not here');
    }
    // `Uint8Array<ArrayBufferLike>` is not a `BodyInit`; its buffer is.
    return new Response(bytes.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        // No Content-Disposition: the filename would be user input, and nothing here needs one.
        'Content-Type': row.mimeType,
        'Content-Length': String(bytes.byteLength),
        'Cache-Control': 'private, max-age=0, no-store',
      },
    });
  });
}
