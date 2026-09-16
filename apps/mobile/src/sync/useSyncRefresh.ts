import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../components/Toast';
import { pullFeedbackKey } from './pullFeedback';
import { useSync } from './syncContext';

export interface SyncRefresh {
  refreshing: boolean;
  onRefresh: () => void;
}

/**
 * Pull to refresh (§8.5). A pull runs a cycle now, or joins the one already running, and the
 * spinner stays until that cycle is over. Null when there is nothing to sync with — a local-only
 * build, or signed out — so the screen offers no pull rather than one that does nothing.
 *
 * The spinner follows the pull, not the sync status: the scheduler also syncs every minute on its
 * own, and a spinner that appeared at the top of the screen each time would push the content down
 * under the user's thumb. Nothing is refetched afterwards; `useLiveQuery` already redraws on the
 * rows the cycle wrote.
 *
 * Reads `syncContext`, not `SyncProvider`: `Screen` reaches this hook, and the provider's module
 * opens the database on import.
 */
export function useSyncRefresh(): SyncRefresh | null {
  const { scheduler, canSync } = useSync();
  const toast = useToast();
  const { t } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    if (scheduler === null) return;
    setRefreshing(true);
    scheduler
      .syncNow()
      .then(() => {
        const key = pullFeedbackKey(scheduler.status());
        if (key !== null) toast.show(t(key));
      })
      // The cycle publishes its own failures, so this is only for one that escaped even that.
      .catch(() => toast.show(t('sync.pullFailed')))
      .finally(() => setRefreshing(false));
  }, [scheduler, toast, t]);

  if (scheduler === null || !canSync) return null;
  return { refreshing, onRefresh };
}
