import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useDatabase } from '../../db/DatabaseProvider';
import { shouldRelock } from './relock';

export { LOCK_AFTER_BACKGROUND_MS, shouldRelock } from './relock';

/**
 * Sends the app to the lock screen when it returns from more than a minute in the background
 * (§6.32). Cold starts are handled by the boot router, which checks the same flag.
 */
export function useAppLock(): void {
  const router = useRouter();
  const { kv } = useDatabase();
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    const onChange = (status: AppStateStatus): void => {
      const enabled = kv.get('appLockEnabled') === 'true';
      if (status === 'background' || status === 'inactive') {
        backgroundedAt.current ??= Date.now();
        return;
      }
      if (status === 'active') {
        if (shouldRelock(enabled, backgroundedAt.current, Date.now())) router.replace('/lock');
        backgroundedAt.current = null;
      }
    };
    const subscription = AppState.addEventListener('change', onChange);
    return () => subscription.remove();
  }, [kv, router]);
}
