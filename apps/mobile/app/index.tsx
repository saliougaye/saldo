import { Redirect } from 'expo-router';
import { useServer } from '../src/auth/ServerProvider';
import { LoadingScreen } from '../src/components/LoadingScreen';
import { useDatabase } from '../src/db/DatabaseProvider';
import { useSettingsQuery } from '../src/db/hooks';
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
 */
export default function Boot() {
  const { settings, loaded } = useSettingsQuery();
  const { status } = useServer();
  const { kv } = useDatabase();
  const { status: syncStatus, scheduler } = useSync();

  if (kv.get('appLockEnabled') === 'true') return <Redirect href="/lock" />;
  if (status === 'loading' || !loaded) return <LoadingScreen />;
  if (status === 'signed-out') return <Redirect href="/welcome" />;
  if (settings === null) {
    // A null scheduler is a local-only build: there is nothing to wait for.
    if (scheduler !== null && !hasSyncSettled(syncStatus)) return <LoadingScreen />;
    return <Redirect href="/period" />;
  }
  if (settings.onboardingCompletedAt === null) return <Redirect href="/period" />;
  return <Redirect href="/(tabs)" />;
}
