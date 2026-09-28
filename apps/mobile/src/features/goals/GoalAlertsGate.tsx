import type { GoalView } from '@saldo/core';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDatabase } from '../../db/DatabaseProvider';
import { useSettings } from '../../db/hooks';
import { useAppLocale } from '../../i18n/useAppLocale';
import { useHiddenMoney } from '../hidden/hiddenAmounts';
import { usePeriod } from '../period/PeriodProvider';
import { goalAlertKey, pendingGoalAlerts } from './goalAlerts';

/**
 * «Obiettivo {name} raggiunto» (§5.14), once per goal, with the permission flow of the budget
 * alerts. The amount follows hidden mode: a lock-screen banner is what hiding is for.
 */
export function GoalAlertsGate({ views }: { views: readonly GoalView[] }) {
  const { t } = useTranslation();
  const { kv } = useDatabase();
  const { format: money } = useHiddenMoney();
  const locale = useAppLocale();
  const settings = useSettings();
  const { today } = usePeriod();
  const currency = settings?.currency ?? 'EUR';

  useEffect(() => {
    const pending = pendingGoalAlerts(views, kv);
    if (pending.length === 0) return;
    let cancelled = false;
    void (async () => {
      const permission = await Notifications.getPermissionsAsync();
      const granted = permission.granted || (await Notifications.requestPermissionsAsync()).granted;
      if (!granted || cancelled) return;
      for (const view of pending) {
        // Marked first: this effect re-runs on every write, and a second run must not find the
        // goal still pending while the first is awaiting the scheduler.
        kv.set(goalAlertKey(view.account.id), today);
        await Notifications.scheduleNotificationAsync({
          content: {
            title: t('goals.reachedTitle', {
              name: view.account.name,
              amount: money(view.progress.target, currency, locale),
            }),
          },
          trigger: null,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [views, kv, t, money, currency, locale, today]);

  return null;
}
