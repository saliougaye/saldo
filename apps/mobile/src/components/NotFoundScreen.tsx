import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { EmptyState } from './EmptyState';
import { Screen } from './Screen';
import { BackButton } from './ScreenHeader';

/**
 * A detail or edit screen whose record is gone: deleted here, deleted on another device and
 * synced, or not synced yet. One screen for all of them, because the user can do the same
 * thing in every case — leave.
 */
export function NotFoundScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  return (
    <Screen>
      <BackButton />
      <EmptyState
        kind="notFound"
        icon="inbox"
        title={t('common.notFoundTitle')}
        body={t('common.notFoundBody')}
        action={{
          label: t('common.back'),
          // A deep link can open this with nothing behind it; home is the only way out then.
          onPress: () => (router.canGoBack() ? router.back() : router.replace('/')),
        }}
      />
    </Screen>
  );
}
