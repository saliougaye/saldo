import { Redirect } from 'expo-router';
import { useServer } from '../src/auth/ServerProvider';
import { LoadingScreen } from '../src/components/LoadingScreen';
import { useDatabase } from '../src/db/DatabaseProvider';
import { useSettingsQuery } from '../src/db/hooks';

/**
 * Boot router (§6.29, §6.32). The lock screen wins over everything; then a session is required,
 * because the account and its data are the user's own server's; then onboarding until settings
 * exist with a completion stamp.
 *
 * It waits for both reads to resolve first. `useLiveQuery` begins with an empty result and the
 * stored session is read asynchronously, so deciding early would bounce a signed-in, onboarded
 * user back to the start — and `<Redirect>` is not reversible once it has fired.
 */
export default function Boot() {
  const { settings, loaded } = useSettingsQuery();
  const { status } = useServer();
  const { kv } = useDatabase();

  if (kv.get('appLockEnabled') === 'true') return <Redirect href="/lock" />;
  if (status === 'loading' || !loaded) return <LoadingScreen />;
  if (status === 'signed-out') return <Redirect href="/welcome" />;
  if (settings === null || settings.onboardingCompletedAt === null) {
    return <Redirect href="/period" />;
  }
  return <Redirect href="/(tabs)" />;
}
