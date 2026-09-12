import { Redirect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useServer } from '../src/auth/ServerProvider';
import { decideBoot } from '../src/boot/decide';
import { LoadingScreen } from '../src/components/LoadingScreen';
import { UnreachableScreen } from '../src/components/UnreachableScreen';
import { useDatabase } from '../src/db/DatabaseProvider';
import { useSettingsQuery } from '../src/db/hooks';
import { log } from '../src/log';
import { useSync } from '../src/sync/SyncProvider';

/**
 * Boot router (§6.29, §6.32). It decides nothing itself: `decideBoot` does, as a pure function
 * with its own tests, because both times this logic lived in the screen it grew a way to strand
 * somebody — a spinner nothing could clear, then an onboarding offered to an account that already
 * had everything.
 */
export default function Boot() {
  const { settings, loaded } = useSettingsQuery();
  const { status } = useServer();
  const { kv } = useDatabase();
  const { status: syncStatus, scheduler } = useSync();
  const { t } = useTranslation();

  const decision = decideBoot({
    locked: kv.get('appLockEnabled') === 'true',
    session: status,
    settingsLoaded: loaded,
    onboardingCompletedAt: settings?.onboardingCompletedAt,
    hasSettings: settings !== null,
    hasScheduler: scheduler !== null,
    syncStatus,
  });
  log('boot', decision.kind, {
    session: status,
    sync: syncStatus.kind,
    settings: settings !== null,
  });

  switch (decision.kind) {
    case 'lock':
      return <Redirect href="/lock" />;
    case 'loading':
      return <LoadingScreen />;
    case 'welcome':
      return <Redirect href="/welcome" />;
    case 'waiting-for-sync':
      return <LoadingScreen label={t('sync.firstSync')} />;
    case 'sync-unreachable':
      return (
        <UnreachableScreen
          detail={decision.code}
          onRetry={() => {
            void scheduler?.syncNow();
          }}
        />
      );
    case 'onboarding':
      return <Redirect href="/period" />;
    case 'tabs':
      return <Redirect href="/(tabs)" />;
  }
}
