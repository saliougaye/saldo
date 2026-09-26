import { eq } from 'drizzle-orm';
import type { Repositories } from './repositories';
import { type RepositoryDatabase, SYNCED } from './repositories/support';
import { settings } from './schema';

/**
 * Gives a phone that onboarded before `settings.timeZone` existed its device's zone (D37), so the
 * server stops falling back to `DEFAULT_TIME_ZONE` for it. Returns whether it wrote.
 *
 * Only a **synced** row is touched. A pending one may be the row «Porta nell’account» stamped with
 * the oldest HLC so the account's settings win (`yieldSettingsToAccount`); updating it would give it
 * a fresh HLC and make the phone's settings win instead. After the sync, the next boot fills it.
 */
export function backfillTimeZone(
  db: RepositoryDatabase,
  repos: Repositories,
  zone: string,
): boolean {
  const [row] = db
    .select({ timeZone: settings.timeZone, syncState: settings.syncState })
    .from(settings)
    .where(eq(settings.id, 'settings'))
    .all();
  if (row === undefined || row.timeZone !== null || row.syncState !== SYNCED) return false;
  repos.settings.update({ timeZone: zone });
  return true;
}
