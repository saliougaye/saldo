import {
  type DateRange,
  type LocalDate,
  type PeriodDef,
  periodContaining,
  periodRecap,
  recapPeriod,
} from '@saldo/core';
import * as Notifications from 'expo-notifications';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDatabase } from '../../db/DatabaseProvider';
import {
  useAccountsQuery,
  useBudgetsQuery,
  useCategoriesQuery,
  useSettings,
  useTransactionsInRangeQuery,
} from '../../db/hooks';
import { useAppLocale } from '../../i18n/useAppLocale';
import { log } from '../../log';
import { usePeriod } from '../period/PeriodProvider';
import { PeriodRecapSheet } from './PeriodRecapSheet';
import {
  isRecapDue,
  isRecapNotificationId,
  nextRecapNotification,
  RECAP_KEY,
  recapPayload,
  recapStamp,
} from './recapSchedule';

/**
 * The period recap of §5.15: on the first open of a new period, once, a sheet recapping the one
 * that closed; and, always, the next 09:00 notification kept scheduled.
 *
 * Mounted in the tabs layout, which exists only past the boot router and the lock, so the sheet
 * never draws over the lock screen. The ledger is read only when a recap is due, by `RecapHost`.
 */
export function PeriodRecapGate() {
  const { t } = useTranslation();
  const { kv } = useDatabase();
  const settings = useSettings();
  const { today, def } = usePeriod();
  const closed = useMemo(() => recapPeriod(def, today), [def, today]);
  const stamp = recapStamp(def, closed);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (settings === null || open !== null) return;
    const due = isRecapDue({
      stamp,
      stored: kv.get(RECAP_KEY),
      onboardingCompletedAt: settings.onboardingCompletedAt,
      currentStart: periodContaining(def, today).start,
    });
    if (due) setOpen(stamp);
  }, [settings, open, stamp, kv, def, today]);

  const ready = settings !== null;
  useEffect(() => {
    if (!ready) return;
    const planned = nextRecapNotification(def, today, new Date());
    const title = t(`recap.notification_${def.kind}`);
    let cancelled = false;
    void (async () => {
      try {
        const scheduled = await Notifications.getAllScheduledNotificationsAsync();
        for (const request of scheduled) {
          if (isRecapNotificationId(request.identifier)) {
            await Notifications.cancelScheduledNotificationAsync(request.identifier);
          }
        }
        if (planned === null || cancelled) return;
        // Never asks: the prompt belongs to onboarding and to the budget alerts (§6.29).
        const permission = await Notifications.getPermissionsAsync();
        if (!permission.granted || cancelled) return;
        await Notifications.scheduleNotificationAsync({
          identifier: planned.identifier,
          content: { title, data: recapPayload() },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: planned.at },
        });
      } catch (error) {
        log('recap', 'scheduling failed', { error: String(error) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, def, today, t]);

  if (open === null) return null;
  return (
    <RecapHost
      period={closed}
      def={def}
      today={today}
      stamp={open}
      onClosed={() => setOpen(null)}
    />
  );
}

/**
 * Loads the ledger up to the closed period's end, stamps the period as soon as the answer is known
 * — so closing the app with the sheet open does not show it again — and shows the sheet unless
 * the period turned out empty.
 */
function RecapHost({
  period,
  def,
  today,
  stamp,
  onClosed,
}: {
  period: DateRange;
  def: PeriodDef;
  today: LocalDate;
  stamp: string;
  onClosed: () => void;
}) {
  const { kv } = useDatabase();
  const settings = useSettings();
  const locale = useAppLocale();
  const { rows, loaded: rowsLoaded } = useTransactionsInRangeQuery('1970-01-01', period.end);
  const { rows: categories, loaded: categoriesLoaded } = useCategoriesQuery();
  const { rows: budgets, loaded: budgetsLoaded } = useBudgetsQuery();
  const { accounts, loaded: accountsLoaded } = useAccountsQuery();
  const loaded = rowsLoaded && categoriesLoaded && budgetsLoaded && accountsLoaded;

  const recap = useMemo(
    () =>
      loaded
        ? periodRecap({ def, period, today, transactions: rows, categories, budgets, accounts })
        : null,
    [loaded, def, period, today, rows, categories, budgets, accounts],
  );

  const settled = useRef(false);
  useEffect(() => {
    if (!loaded || settled.current) return;
    settled.current = true;
    kv.set(RECAP_KEY, stamp);
    if (recap === null) onClosed();
  }, [loaded, recap, kv, stamp, onClosed]);

  if (!loaded || recap === null || settings === null) return null;
  return (
    <PeriodRecapSheet
      recap={recap}
      kind={def.kind}
      categories={categories}
      currency={settings.currency}
      locale={locale}
      onClose={onClosed}
    />
  );
}
