import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../components/Toast';
import { useDatabase } from '../../db/DatabaseProvider';
import { useSettingsQuery } from '../../db/hooks';
import { DATA_RESET_NOTICE_KEY } from '../../db/wipe';
import { startOver } from '../../navigation/history';

/**
 * §8.6. A sync can empty this phone because the account's data was deleted on another device.
 * The tabs are then showing data that no longer exists: say why, and — if no settings are left —
 * hand back to the boot router, which waits for the cycle and opens onboarding or the tabs.
 *
 * Runs on every settings change rather than only when they vanish: if the other device has
 * already started again, the wipe and the pull of its new settings can land together, and the
 * toast is still owed.
 */
export function useLeaveWhenDataGone(): void {
  const router = useRouter();
  const { kv } = useDatabase();
  const toast = useToast();
  const { t } = useTranslation();
  const { settings, loaded } = useSettingsQuery();

  useEffect(() => {
    if (kv.get(DATA_RESET_NOTICE_KEY) !== null) {
      kv.remove(DATA_RESET_NOTICE_KEY);
      toast.show(t('deleteData.deletedElsewhere'));
    }
    if (loaded && settings === null) startOver(router, '/');
  }, [settings, loaded, kv, toast, t, router]);
}
