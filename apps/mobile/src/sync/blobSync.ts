import { z } from 'zod';
import type { LocalAttachment, Repositories } from '../db/repositories';
import { log, ms, shortId } from '../log';
import { type ApiClient, ApiClientError } from '../net/apiClient';

/** §10: what the server answers when asked where to put the bytes. */
export const uploadIntentSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('direct') }),
  z.object({
    mode: z.literal('presigned'),
    url: z.string(),
    method: z.enum(['PUT', 'POST']),
    headers: z.record(z.string(), z.string()),
    expiresIn: z.number(),
  }),
]);

export interface BlobSyncDeps {
  repos: Repositories;
  api: ApiClient;
  /** Injected so this module is testable without a device filesystem. */
  readBytes: (uri: string) => Uint8Array | null;
  storeBytes: (
    id: string,
    mimeType: LocalAttachment['mimeType'],
    bytes: Uint8Array,
  ) => Promise<{ uri: string; sha256: string }>;
  /** Presigned uploads bypass the API client, so the raw fetch is injected too. */
  fetchImpl?: (request: Request) => Promise<Response>;
}

export interface BlobSyncOutcome {
  uploaded: number;
  failed: number;
  /** True when the server keeps no attachments: there is nothing to retry later (§10). */
  noStorage: boolean;
}

/** How many blobs one cycle moves. Small: each is up to 10 MB. */
export const MAX_BLOBS_PER_CYCLE = 5;

async function uploadOne(deps: BlobSyncDeps, row: LocalAttachment): Promise<void> {
  const bytes = row.localUri === null ? null : deps.readBytes(row.localUri);
  if (bytes === null) {
    // The row says the file is here and it is not. Nothing to upload and nothing to retry.
    throw new ApiClientError(410, 'no_local_file', 'The local file is gone');
  }
  const intent = await deps.api.post(
    `/api/attachments/${row.id}/upload-intent`,
    { size: row.byteSize, mimeType: row.mimeType },
    uploadIntentSchema,
  );
  log('blobs', `uploading ${shortId(row.id)} ${row.byteSize} bytes via ${intent.mode}`);

  if (intent.mode === 'direct') {
    await deps.api.putBinary(`/api/attachments/${row.id}`, bytes, {
      'content-type': row.mimeType,
      'x-content-sha256': row.sha256,
    });
    return;
  }

  const fetchImpl = deps.fetchImpl ?? ((request: Request) => fetch(request));
  const response = await fetchImpl(
    new Request(intent.url, {
      method: intent.method,
      headers: intent.headers,
      // Copied for the same reason as in the API client: `bytes` may be a view.
      body: new Uint8Array(bytes),
    }),
  );
  if (!response.ok) {
    throw new ApiClientError(response.status, 'upload_failed', 'The store refused the upload');
  }
  // The server never saw those bytes, so it checks with the store that they arrived whole.
  await deps.api.post(`/api/attachments/${row.id}/complete`, {}, z.object({}).loose());
}

/**
 * Sends the blobs this device holds and the server does not (§10). Called **after** a sync cycle,
 * because the upload is refused until the row itself has been pushed — the server will not take
 * bytes for a row it has never heard of.
 */
export async function uploadPendingBlobs(deps: BlobSyncDeps): Promise<BlobSyncOutcome> {
  const outcome: BlobSyncOutcome = { uploaded: 0, failed: 0, noStorage: false };
  const startedAt = Date.now();
  const pending = deps.repos.attachments.pendingUploads(MAX_BLOBS_PER_CYCLE);
  if (pending.length === 0) return outcome;
  log('blobs', `${pending.length} attachments to send`);
  for (const row of pending) {
    try {
      await uploadOne(deps, row);
      deps.repos.attachments.setBlobState(row.id, 'synced');
      outcome.uploaded += 1;
    } catch (error) {
      const code = error instanceof ApiClientError ? error.code : null;
      if (code === 'no_storage') {
        // Not a failure of this row: the server keeps no attachments at all, so every other row
        // would fail the same way. Leave them local and stop.
        log('blobs', 'this server keeps no attachments, the bytes stay on the phone');
        outcome.noStorage = true;
        break;
      }
      if (code === 'not_found') {
        // The row has not been pushed yet; the next cycle pushes it and this one retries then.
        log('blobs', `${shortId(row.id)} has no row on the server yet, retrying next cycle`);
        break;
      }
      log('blobs', `${shortId(row.id)} failed to upload`, {
        code: code ?? 'unknown',
        error: String(error),
      });
      deps.repos.attachments.setBlobState(row.id, 'failed');
      outcome.failed += 1;
    }
  }
  log('blobs', `upload pass finished in ${ms(startedAt)}`, { ...outcome });
  return outcome;
}

/**
 * Fetches one attachment's bytes on demand — a thumbnail or the viewer asking for something this
 * device does not have (§10). The hash is verified here: with a presigned upload the server never
 * saw the bytes, so the downloader is the one that can tell whether they are the right ones.
 */
export async function downloadBlob(deps: BlobSyncDeps, id: string): Promise<boolean> {
  const row = deps.repos.attachments.byId(id);
  if (row === null || row.localUri !== null) {
    log('blobs', `no download for ${shortId(id)}`, {
      reason: row === null ? 'no such row' : 'already on this device',
    });
    return false;
  }
  const startedAt = Date.now();
  const bytes = await deps.api.getBinary(`/api/attachments/${id}`);
  const stored = await deps.storeBytes(id, row.mimeType, bytes);
  if (stored.sha256 !== row.sha256) {
    // Whatever came back is not what this attachment is. Keep nothing rather than cache a lie.
    log('blobs', `${shortId(id)} came back with the wrong hash`, {
      expected: row.sha256.slice(0, 8),
      got: stored.sha256.slice(0, 8),
    });
    throw new ApiClientError(422, 'hash_mismatch', 'The downloaded bytes do not match the row');
  }
  deps.repos.attachments.setLocalUri(id, stored.uri);
  log('blobs', `${shortId(id)} downloaded, ${bytes.length} bytes in ${ms(startedAt)}`);
  return true;
}
