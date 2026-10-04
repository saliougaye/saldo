import {
  type ArchivedOutput,
  type EntityName,
  getCurrency,
  type MinorDigits,
  readSettings,
  refusalMessage,
  type SavedOutput,
  type UserData,
  type WriteRefusal,
  type WriteSubject,
} from '@saldo/core';
import { getDb } from '../../db/client';
import { loadRow } from '../../userData/row';
import type { ToolResult } from '../types';

/** The handlers' «now»: `new Date()` in production, a fixed instant in tests. */
export type Clock = () => Date;

/** A write function's refusal as the tool error a model reads (§17.4.2): never an exception. */
export function refuse(
  subject: WriteSubject,
  refusal: WriteRefusal,
): { ok: false; message: string } {
  return { ok: false, message: refusalMessage(subject, refusal) };
}

export function minorDigitsOf(data: UserData): MinorDigits {
  return getCurrency(readSettings(data.settings).currency).minorDigits;
}

/** The stamp a live row carries now: the `updatedAt` a client sends back to change it again. */
export async function currentStamp(
  userId: string,
  entity: EntityName,
  id: string,
): Promise<string | null> {
  const found = await loadRow(getDb(), userId, entity, id);
  return found.status === 'found' && !found.deleted ? found.row.updatedAt : null;
}

/** A save's answer: the id and the version the write left, so the next edit can name it. */
export async function saved(
  subject: WriteSubject,
  entity: EntityName,
  userId: string,
  id: string,
  created: boolean,
): Promise<ToolResult<SavedOutput>> {
  const updatedAt = await currentStamp(userId, entity, id);
  if (updatedAt === null) return refuse(subject, { error: 'notFound' });
  return { ok: true, value: { id, updatedAt, created } };
}

/** An archive or restore's answer: the state the row is in now, and its version. */
export async function archivedState(
  subject: 'account' | 'category',
  userId: string,
  id: string,
): Promise<ToolResult<ArchivedOutput>> {
  const found = await loadRow(getDb(), userId, subject, id);
  if (found.status !== 'found' || found.deleted) return refuse(subject, { error: 'notFound' });
  return {
    ok: true,
    value: { id, archived: found.row.archivedAt !== null, updatedAt: found.row.updatedAt },
  };
}
