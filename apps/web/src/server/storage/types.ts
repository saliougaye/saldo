/**
 * `{userId}/{attachmentId}`: the owner is part of the key, so one bucket is one flat namespace and
 * a mistake in a query cannot hand somebody another user's blob.
 */
export function objectKey(userId: string, attachmentId: string): string {
  return `${userId}/${attachmentId}`;
}

/** Ids are ULIDs or UUIDs, so this is deliberately narrow: no dots, no slashes beyond the one. */
const KEY = /^[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/;

export function isValidKey(key: string): boolean {
  return KEY.test(key);
}

export class InvalidKeyError extends Error {
  constructor(key: string) {
    super(`Not a valid object key: ${key}`);
    this.name = 'InvalidKeyError';
  }
}

export interface ObjectMeta {
  size: number;
  mimeType: string;
}

export interface PresignedTarget {
  url: string;
  method: 'PUT' | 'POST';
  headers: Record<string, string>;
  /** Seconds the URL stays usable. */
  expiresIn: number;
}

export type StoreName = 'fs' | 's3' | 'vercel-blob';

/**
 * Where attachment blobs live (§10). Implementations are chosen by `ATTACHMENT_STORAGE` and the
 * app never learns which one answered — adding a backend is a file here, not a new build of the
 * mobile app.
 *
 * Bytes rather than streams: the cap is 10 MB, every SDK accepts a buffer, and the hash has to be
 * computed over the whole body anyway.
 */
export interface AttachmentStore {
  readonly name: StoreName;
  put(key: string, bytes: Uint8Array, meta: ObjectMeta): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  /** Size in bytes, or null when there is no such object. Confirms a presigned upload happened. */
  head(key: string): Promise<number | null>;
  delete(key: string): Promise<void>;
  /** Only stores that can hand out direct URLs implement these (§10). */
  presignPut?(key: string, meta: ObjectMeta): Promise<PresignedTarget>;
  presignGet?(key: string): Promise<string>;
}
