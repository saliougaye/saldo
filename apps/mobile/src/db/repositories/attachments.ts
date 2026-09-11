import {
  type Attachment,
  attachmentSchema,
  MAX_ATTACHMENTS_PER_TRANSACTION,
  newId,
} from '@saldo/core';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { attachments } from '../schema';
import { insertStamp, isoNow, type RepositoryContext, toEntity, updateStamp } from './support';

/** Whether this device's copy of the bytes has reached the server (§10). Never synced. */
export type BlobState = 'local_only' | 'synced' | 'failed';

/** What the repository returns: the entity plus the two columns that stay on this device. */
export interface LocalAttachment extends Attachment {
  localUri: string | null;
  blobState: BlobState;
}

type AttachmentInput = Omit<Attachment, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> & {
  id?: string;
  localUri: string | null;
};

export class TooManyAttachmentsError extends Error {
  constructor(transactionId: string) {
    super(`Transaction ${transactionId} already has ${MAX_ATTACHMENTS_PER_TRANSACTION}`);
    this.name = 'TooManyAttachmentsError';
  }
}

export interface AttachmentsRepository {
  create(input: AttachmentInput): LocalAttachment;
  byId(id: string): LocalAttachment | null;
  /** Live attachments of one transaction, oldest first — the order they were added. */
  listFor(transactionId: string): LocalAttachment[];
  /** Tombstone, so the other devices converge on the deletion (§7). */
  remove(id: string): void;
  /** Tombstones every attachment of a transaction; called when the transaction goes (§10). */
  removeFor(transactionId: string): void;
  /** Device-local, so it changes no HLC and pushes nothing. */
  setLocalUri(id: string, localUri: string | null): void;
  setBlobState(id: string, blobState: BlobState): void;
  /** Rows whose bytes are on this device and not yet on the server, oldest first. */
  pendingUploads(limit: number): LocalAttachment[];
}

function toLocal(row: typeof attachments.$inferSelect): LocalAttachment {
  const { localUri, blobState, ...rest } = row;
  return { ...toEntity(rest), localUri, blobState };
}

export function createAttachmentsRepository(context: RepositoryContext): AttachmentsRepository {
  const { db } = context;
  const read = (id: string): LocalAttachment | null => {
    const [row] = db.select().from(attachments).where(eq(attachments.id, id)).all();
    return row === undefined ? null : toLocal(row);
  };

  const repository: AttachmentsRepository = {
    create(input) {
      const { localUri, ...fields } = input;
      // §10 caps a transaction at five, and the cap is enforced here rather than in the screen so
      // a second entry point cannot quietly exceed it.
      if (repository.listFor(input.transactionId).length >= MAX_ATTACHMENTS_PER_TRANSACTION) {
        throw new TooManyAttachmentsError(input.transactionId);
      }
      const entity = attachmentSchema.parse({
        ...fields,
        id: input.id ?? newId(),
        ...insertStamp(context),
      });
      db.insert(attachments)
        .values({ ...entity, localUri, blobState: 'local_only', syncState: 1 })
        .run();
      return { ...entity, localUri, blobState: 'local_only' };
    },

    byId: read,

    listFor(transactionId) {
      return db
        .select()
        .from(attachments)
        .where(and(eq(attachments.transactionId, transactionId), isNull(attachments.deletedAt)))
        .orderBy(asc(attachments.createdAt))
        .all()
        .map(toLocal);
    },

    remove(id) {
      db.update(attachments)
        .set({ deletedAt: (context.nowIso ?? isoNow)(), ...updateStamp(context) })
        .where(eq(attachments.id, id))
        .run();
    },

    removeFor(transactionId) {
      for (const row of repository.listFor(transactionId)) repository.remove(row.id);
    },

    setLocalUri(id, localUri) {
      // No HLC and no pending flag: where a file sits in this app's sandbox is nobody else's
      // business, and saying so would push a row that has not actually changed.
      db.update(attachments).set({ localUri }).where(eq(attachments.id, id)).run();
    },

    setBlobState(id, blobState) {
      db.update(attachments).set({ blobState }).where(eq(attachments.id, id)).run();
    },

    pendingUploads(limit) {
      return db
        .select()
        .from(attachments)
        .where(and(isNull(attachments.deletedAt), eq(attachments.blobState, 'local_only')))
        .orderBy(asc(attachments.createdAt))
        .limit(limit)
        .all()
        .map(toLocal)
        .filter((row) => row.localUri !== null);
    },
  };
  return repository;
}
