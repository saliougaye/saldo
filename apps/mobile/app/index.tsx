import { Redirect } from 'expo-router';
import { useDatabase } from '../src/db/DatabaseProvider';
import { useSettings } from '../src/db/hooks';

/**
 * Boot router: the lock screen wins over everything, then onboarding until settings exist with a
 * completion stamp (§6.29, §6.32).
 */
export default function Boot() {
  const settings = useSettings();
  const { kv } = useDatabase();
  const locked = kv.get('appLockEnabled') === 'true';

  if (locked) return <Redirect href="/lock" />;
  if (settings === null || settings.onboardingCompletedAt === null) {
    return <Redirect href="/cycle-day" />;
  }
  return <Redirect href="/(tabs)" />;
}
