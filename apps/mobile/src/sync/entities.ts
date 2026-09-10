import type { EntityName } from '@saldo/core';
import {
  accounts,
  budgets,
  categories,
  recurrences,
  settings,
  tags,
  transactions,
} from '../db/schema';

/**
 * Entity name (the wire vocabulary of §8.1) to local table. `attachment` is absent on purpose:
 * phase 08 owns it, and the server already accepts the name, so nothing here changes when it lands.
 */
export const SYNCED_TABLES = {
  settings,
  account: accounts,
  category: categories,
  tag: tags,
  transaction: transactions,
  recurrence: recurrences,
  budget: budgets,
} as const;

export type SyncedEntityName = keyof typeof SYNCED_TABLES;

export const SYNCED_ENTITY_NAMES = Object.keys(SYNCED_TABLES) as SyncedEntityName[];

export function isSyncedEntity(name: EntityName | string): name is SyncedEntityName {
  return name in SYNCED_TABLES;
}
