import { compareHlc, type HlcString } from './hlc';

/** The three fields every synced row carries (§8.1). */
export interface SyncRecord {
  id: string;
  updatedAt: HlcString;
  deletedAt: string | null;
}

/**
 * §8.1: whole-row last-writer-wins. `updatedAt` is an HLC, so this is a total order every replica
 * computes the same way — which is what makes convergence independent of delivery order. Equal
 * timestamps mean the same write (the device id is inside the HLC), so the local row stays.
 */
export function shouldApplyRemote(remote: HlcString, local: HlcString | null): boolean {
  if (local === null) return true;
  return compareHlc(remote, local) > 0;
}

/**
 * The winning row, whole. No field-level merge: a tombstone and an edit are both just writes, and
 * whichever is later wins — including an undelete that comes after a delete.
 */
export function mergeRecord<T extends SyncRecord>(local: T | null, remote: T): T {
  if (local === null) return remote;
  return shouldApplyRemote(remote.updatedAt, local.updatedAt) ? remote : local;
}
