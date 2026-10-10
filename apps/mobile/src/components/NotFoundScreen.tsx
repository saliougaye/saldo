import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { EmptyState } from './EmptyState';
import { Screen } from './Screen';
import { BackButton } from './ScreenHeader';

/**
 * A detail or edit screen whose record is gone: deleted here, deleted on another device and
 * synced, or not synced yet. One screen for all of them, because the user can do the same
 * thing in every case — leave.
 *
 * `title` and `body` replace the copy for a screen that was never there: a link that matches no
 * route (`app/+not-found.tsx`).
 */
export function NotFoundScreen({ title, body }: { title?: string; body?: string } = {}) {
  const router = useRouter();
  const { t } = useTranslation();
  return (
    <Screen>
      <BackButton />
      <EmptyState
        kind="notFound"
        icon="inbox"
        title={title ?? t('common.notFoundTitle')}
        body={body ?? t('common.notFoundBody')}
        action={{
          // Not "Back": the header chevron already carries that name, and two buttons announced
          // the same way are one too many.
          label: t('common.goBack'),
          // A deep link can open this with nothing behind it; home is the only way out then.
          onPress: () => (router.canGoBack() ? router.back() : router.replace('/')),
        }}
      />
    </Screen>
  );
}
