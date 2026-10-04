import { type EntityName, onboardingSeed } from '@saldo/core';
import type { ServerDatabase } from '../db/types';
import { loadRow } from '../userData/row';
import { unstamped } from './rows';
import { writeChanges } from './writeChanges';

export const FIXTURE_NOW = new Date('2026-09-29T10:00:00.000Z');

/** An onboarded account with two accounts (`acc-main`, `acc-savings`) and the groceries seed. */
export async function seedOnboarded(db: ServerDatabase, userId: string): Promise<void> {
  const seed = onboardingSeed({
    periodKind: 'month',
    cycleStartDay: 27,
    currency: 'EUR',
    language: 'system',
    theme: 'system',
    completedAt: FIXTURE_NOW.toISOString(),
    timeZone: 'Europe/Rome',
    account: { name: 'Conto', type: 'checking', openingBalance: 100000, icon: 'landmark' },
    selectedCategoryKeys: ['groceries'],
    translate: (key) => key,
  });
  const meta = { createdAt: FIXTURE_NOW.toISOString(), deletedAt: null };
  if (seed.account === null) throw new Error('fixture needs an account');
  await writeChanges(
    db,
    userId,
    [
      { entity: 'settings', id: 'settings', data: { ...seed.settings, ...meta } },
      { entity: 'account', id: 'acc-main', data: { ...seed.account, ...meta } },
      {
        entity: 'account',
        id: 'acc-savings',
        data: {
          ...seed.account,
          name: 'Risparmi',
          type: 'savings',
          openingBalance: 0,
          sortOrder: 1,
          ...meta,
        },
      },
      ...seed.categories.map((category) => ({
        entity: 'category' as const,
        id: category.id,
        data: { ...category, ...meta },
      })),
    ],
    FIXTURE_NOW,
  );
}

/** The stamp a row carries now: what a read tool hands an MCP client as `updatedAt`. */
export async function stampOf(
  db: ServerDatabase,
  userId: string,
  entity: EntityName,
  id: string,
): Promise<string> {
  const found = await loadRow(db, userId, entity, id);
  if (found.status !== 'found') throw new Error(`no ${entity}/${id}`);
  return found.row.updatedAt;
}

/**
 * Another device edits the row — `patch` applied, a newer stamp — as a phone's push leaves it.
 * Returns the new stamp.
 */
export async function bumpRow(
  db: ServerDatabase,
  userId: string,
  entity: EntityName,
  id: string,
  patch: Record<string, unknown> = {},
): Promise<string> {
  const found = await loadRow(db, userId, entity, id);
  if (found.status !== 'found') throw new Error(`no ${entity}/${id}`);
  await writeChanges(
    db,
    userId,
    [{ entity, id, data: { ...unstamped(found.row), ...patch, deletedAt: found.row.deletedAt } }],
    FIXTURE_NOW,
  );
  return stampOf(db, userId, entity, id);
}
