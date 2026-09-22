import { addDays, CREDIT_REMINDER_HOUR, creditChargeReminders } from '@saldo/core';
import * as Notifications from 'expo-notifications';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAccountsQuery, useSettings, useTransactionsInRangeQuery } from '../../db/hooks';
import { useAppLocale } from '../../i18n/useAppLocale';
import { log } from '../../log';
import { useHiddenMoney } from '../hidden/hiddenAmounts';
import { usePeriod } from '../period/PeriodProvider';
import { isReminderId, reminderId, reminderPayload, reminderTrigger } from './cardReminders';
import { SETTLEMENT_LOOKAHEAD_DAYS } from './settlement';

interface PlannedReminder {
  identifier: string;
  at: Date;
  title: string;
  accountId: string;
}

/**
 * Keeps one local notification per credit card on its charge day (§5.3): "Carta {name}: {amount}
 * da saldare oggi", at 09:00. Which cards get one is `creditChargeReminders`; this only turns the
 * answer into scheduled requests, and keeps them honest as the card, its transactions or its
 * days change: every change cancels this gate's requests and schedules the current set again.
 *
 * Nothing is scheduled while the live queries are still loading, since an empty first read would
 * cancel every reminder. A run whose set is the same as the last successful one does nothing.
 * Permission follows `BudgetAlertsGate`: read, and ask only when there is something to schedule.
 * The title goes through hidden mode, since a lock-screen banner is exactly what hiding is for.
 */
export function CardRemindersGate() {
  const { t } = useTranslation();
  const { format: money } = useHiddenMoney();
  const locale = useAppLocale();
  const settings = useSettings();
  const { today } = usePeriod();
  const { accounts, loaded: accountsLoaded } = useAccountsQuery();
  const { rows, loaded: rowsLoaded } = useTransactionsInRangeQuery(
    '1970-01-01',
    addDays(today, SETTLEMENT_LOOKAHEAD_DAYS),
  );
  const loaded = accountsLoaded && rowsLoaded && settings !== null;
  const currency = settings?.currency ?? 'EUR';
  const lastScheduled = useRef<string | null>(null);

  const planned = useMemo<PlannedReminder[]>(() => {
    if (!loaded) return [];
    const now = new Date();
    const out: PlannedReminder[] = [];
    for (const reminder of creditChargeReminders(accounts, rows, today)) {
      const at = reminderTrigger(reminder.date, CREDIT_REMINDER_HOUR, now);
      const account = accounts.find((candidate) => candidate.id === reminder.accountId);
      if (at === null || account === undefined) continue;
      out.push({
        identifier: reminderId(reminder.accountId),
        at,
        title: t('accounts.reminderTitle', {
          name: account.name,
          amount: money(reminder.amount, currency, locale),
        }),
        accountId: reminder.accountId,
      });
    }
    return out;
  }, [loaded, accounts, rows, today, t, money, currency, locale]);

  useEffect(() => {
    if (!loaded) return;
    const signature = JSON.stringify(
      planned.map((reminder) => [reminder.identifier, reminder.at.getTime(), reminder.title]),
    );
    if (signature === lastScheduled.current) return;
    let cancelled = false;

    void (async () => {
      try {
        const scheduled = await Notifications.getAllScheduledNotificationsAsync();
        for (const request of scheduled) {
          if (isReminderId(request.identifier)) {
            await Notifications.cancelScheduledNotificationAsync(request.identifier);
          }
        }
        if (planned.length === 0) {
          if (!cancelled) lastScheduled.current = signature;
          return;
        }
        const permission = await Notifications.getPermissionsAsync();
        const granted =
          permission.granted || (await Notifications.requestPermissionsAsync()).granted;
        if (!granted || cancelled) return;
        for (const reminder of planned) {
          await Notifications.scheduleNotificationAsync({
            identifier: reminder.identifier,
            content: { title: reminder.title, data: reminderPayload(reminder.accountId) },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminder.at },
          });
        }
        if (!cancelled) lastScheduled.current = signature;
      } catch (error) {
        log('reminders', 'scheduling failed', { error: String(error) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loaded, planned]);

  return null;
}
