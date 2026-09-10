import { Redirect } from 'expo-router';
import { LoadingScreen } from '../src/components/LoadingScreen';
import { useDatabase } from '../src/db/DatabaseProvider';
import { useSettingsQuery } from '../src/db/hooks';

/**
 * Boot router: the lock screen wins over everything, then onboarding until settings exist with a
 * completion stamp (§6.29, §6.32).
 *
 * It waits for the settings query to resolve first. `useLiveQuery` begins with an empty result, so
 * deciding immediately would send an already-onboarded user to onboarding — and `<Redirect>` is
 * not reversible once it has fired.
 */
export default function Boot() {
  const { settings, loaded } = useSettingsQuery();
  const { kv } = useDatabase();

  if (!loaded) return <LoadingScreen />;
  if (kv.get('appLockEnabled') === 'true') return <Redirect href="/lock" />;
  if (settings === null || settings.onboardingCompletedAt === null) {
    return <Redirect href="/cycle-day" />;
  }
  return <Redirect href="/(tabs)" />;
}
