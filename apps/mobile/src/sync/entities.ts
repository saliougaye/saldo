import type { EntityName } from '@saldo/core';
import {
  accounts,
  attachments,
  budgets,
  categories,
  recurrences,
  settings,
  tags,
  transactions,
} from '../db/schema';

/** Entity name (the wire vocabulary of §8.1) to local table. */
export const SYNCED_TABLES = {
  settings,
  account: accounts,
  category: categories,
  tag: tags,
  transaction: transactions,
  recurrence: recurrences,
  budget: budgets,
  attachment: attachments,
} as const;

/**
 * Columns that exist only on this device and must never reach the wire (§10): where the file sits
 * in this app's sandbox, and whether *this* device has uploaded it. Neither means anything to
 * another device, and the path is a detail of an installation nobody else should learn.
 */
export const LOCAL_ONLY_COLUMNS: Partial<Record<SyncedEntityName, readonly string[]>> = {
  attachment: ['localUri', 'blobState'],
};

export type SyncedEntityName = keyof typeof SYNCED_TABLES;

export const SYNCED_ENTITY_NAMES = Object.keys(SYNCED_TABLES) as SyncedEntityName[];

export function isSyncedEntity(name: EntityName | string): name is SyncedEntityName {
  return name in SYNCED_TABLES;
}
