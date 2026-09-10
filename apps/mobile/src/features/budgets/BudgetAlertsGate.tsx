import * as Notifications from 'expo-notifications';
import { type ReactNode, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDatabase } from '../../db/DatabaseProvider';
import { alertKey, pendingBudgetAlerts } from './budgetAlerts';
import type { BudgetView } from './useBudgetProgress';

/**
 * Sends the local notifications of §5.8 when a budget crosses its threshold, once per budget per
 * period. The period is marked as alerted only after the notification is scheduled, so a failure
 * leaves the budget eligible to alert again rather than silently swallowing it.
 */
export function BudgetAlertsGate({
  views,
  children,
}: {
  views: readonly BudgetView[];
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const { kv } = useDatabase();

  useEffect(() => {
    const alerts = pendingBudgetAlerts(views, kv);
    if (alerts.length === 0) return;
    let cancelled = false;

    void (async () => {
      const permission = await Notifications.getPermissionsAsync();
      const granted = permission.granted || (await Notifications.requestPermissionsAsync()).granted;
      if (!granted || cancelled) return;
      for (const alert of alerts) {
        await Notifications.scheduleNotificationAsync({
          content: { title: t('budgets.alertTitle', { name: alert.name, pct: alert.percent }) },
          trigger: null,
        });
        const view = views.find((candidate) => candidate.budget.id === alert.budgetId);
        if (view !== undefined) kv.set(alertKey(alert.budgetId), view.range.start);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [views, kv, t]);

  return <>{children}</>;
}
