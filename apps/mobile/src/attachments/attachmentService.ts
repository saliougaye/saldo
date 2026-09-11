import { newId } from '@saldo/core';
import type { LocalAttachment, Repositories } from '../db/repositories';
import type { CapturedFile } from './capture';
import { deleteFile, storeBytes } from './localFiles';

/**
 * Turns something the user picked into an attachment: the bytes go into this app's directory under
 * the id the row will carry, and the row records what they are (§10).
 *
 * The file is written first and the row second, so a failure leaves an orphan file rather than a
 * row pointing at bytes that do not exist — the first is invisible, the second would show up as a
 * broken thumbnail on every device.
 */
export async function addAttachment(
  repos: Repositories,
  transactionId: string,
  captured: CapturedFile,
): Promise<LocalAttachment> {
  const id = newId();
  const stored = await storeBytes(id, captured.mimeType, captured.bytes);
  try {
    return repos.attachments.create({
      id,
      transactionId,
      mimeType: captured.mimeType,
      byteSize: stored.byteSize,
      sha256: stored.sha256,
      width: captured.width,
      height: captured.height,
      localUri: stored.uri,
    });
  } catch (error) {
    deleteFile(stored.uri);
    throw error;
  }
}

/**
 * Tombstones the row and drops this device's copy. The blob on the server, if there is one, is the
 * server's to clean up once every device has seen the tombstone (§10).
 */
export function removeAttachment(repos: Repositories, id: string): void {
  const row = repos.attachments.byId(id);
  if (row === null) return;
  repos.attachments.remove(id);
  deleteFile(row.localUri);
}
