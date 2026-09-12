import { Redirect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useServer } from '../src/auth/ServerProvider';
import { LoadingScreen } from '../src/components/LoadingScreen';
import { useDatabase } from '../src/db/DatabaseProvider';
import { useSettingsQuery } from '../src/db/hooks';
import { log } from '../src/log';
import { useSync } from '../src/sync/SyncProvider';
import { hasSyncSettled } from '../src/sync/scheduler';

/**
 * Boot router (§6.29, §6.32). The lock screen wins over everything; then a session is required,
 * because the account and its data are the user's own server's; then onboarding until settings
 * exist with a completion stamp.
 *
 * It waits for both reads to resolve first. `useLiveQuery` begins with an empty result and the
 * stored session is read asynchronously, so deciding early would bounce a signed-in, onboarded
 * user back to the start — and `<Redirect>` is not reversible once it has fired.
 *
 * With no settings row it also waits for the first sync cycle to settle: a device joining an
 * existing account has its settings on the way down, and sending it through onboarding meanwhile
 * ends in a second seed hitting `UNIQUE constraint failed: settings.id` (§8.3).
 *
 * Every branch logs which one it took. This screen is the one that looks identical whether it is
 * waiting half a second for a query or forever for a sync that will never settle, and the two are
 * told apart only by what it says it is waiting for.
 */
export default function Boot() {
  const { settings, loaded } = useSettingsQuery();
  const { status } = useServer();
  const { kv } = useDatabase();
  const { status: syncStatus, scheduler } = useSync();
  const { t } = useTranslation();

  if (kv.get('appLockEnabled') === 'true') {
    log('boot', 'locked, going to the lock screen');
    return <Redirect href="/lock" />;
  }
  if (status === 'loading' || !loaded) {
    log('boot', 'waiting for the session and the settings row', {
      session: status,
      settingsLoaded: loaded,
    });
    return <LoadingScreen />;
  }
  if (status === 'signed-out') {
    log('boot', 'signed out, going to the welcome screen');
    return <Redirect href="/welcome" />;
  }
  if (settings === null) {
    // A null scheduler is a local-only build: there is nothing to wait for.
    if (scheduler !== null && !hasSyncSettled(syncStatus)) {
      log('boot', 'no settings row yet, waiting for the first sync to settle', {
        syncStatus: syncStatus.kind,
      });
      return <LoadingScreen label={t('sync.firstSync')} />;
    }
    log('boot', 'no settings row, starting onboarding', { syncStatus: syncStatus.kind });
    return <Redirect href="/period" />;
  }
  if (settings.onboardingCompletedAt === null) {
    log('boot', 'onboarding not finished, resuming it');
    return <Redirect href="/period" />;
  }
  log('boot', 'ready, going to the tabs');
  return <Redirect href="/(tabs)" />;
}
