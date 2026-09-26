import { eq } from 'drizzle-orm';
import type { Repositories } from './repositories';
import { type RepositoryDatabase, SYNCED } from './repositories/support';
import { settings } from './schema';

/**
 * Gives a phone that onboarded before `settings.timeZone` existed its device's zone (D37), so the
 * server stops falling back to `DEFAULT_TIME_ZONE` for it. Returns whether it wrote.
 *
 * Runs after a pull (`afterPull` in the sync cycle), never at boot: before the pull the local row
 * may be older than the account's, and rewriting it with a fresh HLC would revert a change made on
 * another device. Only a **synced** row is touched: a pending one may be the row «Porta
 * nell’account» stamped with the oldest HLC so the account's settings win
 * (`yieldSettingsToAccount`), and it is filled after the cycle that settles it.
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
