import { formatHlc } from '@saldo/core';
import type { RepositoryDatabase } from './repositories/support';
import { settings } from './schema';

/**
 * «Porta nell’account» (§9.3 step 8): the phone's rows join an account that may already hold its
 * own. Everything else merges by id, but `settings` is one row with a fixed id, and the phone's
 * copy — stamped at a local onboarding — would almost always be newer than the account's, so the
 * first push would replace the account's currency, period and language on every device.
 *
 * So the phone's settings are restamped with the oldest possible HLC and left pending: an account
 * with settings keeps them (the push is stale, the pull applies them over this row), and an account
 * without any receives the phone's on the first push.
 */
export function yieldSettingsToAccount(db: RepositoryDatabase, deviceId: string): void {
  db.update(settings)
    .set({ updatedAt: formatHlc({ wallMs: 0, counter: 0, deviceId }), syncState: 1 })
    .run();
}
