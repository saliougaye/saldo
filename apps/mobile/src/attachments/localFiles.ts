import { MAX_ATTACHMENT_BYTES } from '@saldo/core';
import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

export type AttachmentMime = 'image/jpeg' | 'image/png' | 'application/pdf';

const EXTENSIONS: Record<AttachmentMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/pdf': 'pdf',
};

export function extensionFor(mimeType: AttachmentMime): string {
  return EXTENSIONS[mimeType];
}

/**
 * `${documentDirectory}attachments/` (§10). Documents, not cache: these files are the user's data
 * until they have reached the server, and a cache is something the system may reclaim.
 */
function directory(): Directory {
  const dir = new Directory(Paths.document, 'attachments');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

export function fileFor(id: string, mimeType: AttachmentMime): File {
  return new File(directory(), `${id}.${extensionFor(mimeType)}`);
}

export class AttachmentTooLargeError extends Error {
  constructor(readonly byteSize: number) {
    super(`Attachment is ${byteSize} bytes, over the ${MAX_ATTACHMENT_BYTES} limit`);
    this.name = 'AttachmentTooLargeError';
  }
}

export interface StoredBytes {
  uri: string;
  byteSize: number;
  sha256: string;
}

/**
 * Hex SHA-256 of the bytes themselves — the same digest §10 has the server and the peer check.
 *
 * `Crypto.digest` is typed as taking a `BufferSource`, but the native side accepts **only a typed
 * array**: an `ArrayBuffer` fails with `NotTypedArrayException`. Copying into a fresh `Uint8Array`
 * satisfies that and also hashes the right bytes — `bytesSync()` returns a view onto a larger
 * buffer, and handing over `bytes.buffer` would digest whatever else that buffer holds.
 */
export async function sha256Of(bytes: Uint8Array): Promise<string> {
  const exact = new Uint8Array(bytes);
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, exact);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Copies bytes into this app's attachment directory under the id they will keep, and measures
 * them. The size is checked *after* compression, because compression is what decides it.
 *
 * The hash is computed **before** anything is written: a failure here used to leave the file on
 * disk with no row pointing at it, because the caller's cleanup only covers what happens after
 * this function returns.
 */
export async function storeBytes(
  id: string,
  mimeType: AttachmentMime,
  bytes: Uint8Array,
): Promise<StoredBytes> {
  if (bytes.byteLength > MAX_ATTACHMENT_BYTES) {
    throw new AttachmentTooLargeError(bytes.byteLength);
  }
  const sha256 = await sha256Of(bytes);
  const target = fileFor(id, mimeType);
  if (target.exists) target.delete();
  target.create();
  target.write(bytes);
  return { uri: target.uri, byteSize: bytes.byteLength, sha256 };
}

/** Reads a stored attachment back, or null when this device does not have its bytes. */
export function readBytes(uri: string): Uint8Array | null {
  const file = new File(uri);
  return file.exists ? file.bytesSync() : null;
}

export function deleteFile(uri: string | null): void {
  if (uri === null) return;
  const file = new File(uri);
  if (file.exists) file.delete();
}
