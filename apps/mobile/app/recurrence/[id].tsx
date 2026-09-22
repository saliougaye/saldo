import { nextOccurrence, type RecurrenceRule } from '@saldo/core';
import { formatDayMonth, formatLongDate } from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { AmountText } from '../../src/components/AmountText';
import { SecondaryButton } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { DetailSkeleton } from '../../src/components/DetailSkeleton';
import { IconBox, ListRow } from '../../src/components/ListRow';
import { NotFoundScreen } from '../../src/components/NotFoundScreen';
import { Screen } from '../../src/components/Screen';
import { BackButton } from '../../src/components/ScreenHeader';
import { useToast } from '../../src/components/Toast';
import { useDelayed } from '../../src/components/useDelayed';
import { db } from '../../src/db/client';
import { useRepositories } from '../../src/db/DatabaseProvider';
import {
  useAccounts,
  useCategories,
  useOccurrences,
  useRecurrenceQuery,
  useSettings,
} from '../../src/db/hooks';
import { changeRecurrenceRule, stopRecurrence } from '../../src/db/recurrenceService';
import { useHiddenMoney } from '../../src/features/hidden/hiddenAmounts';
import { usePeriod } from '../../src/features/period/PeriodProvider';
import { RecurrenceSheet } from '../../src/features/transactions/RecurrenceSheet';
import { cadenceLabel } from '../../src/features/transactions/recurrenceCopy';
import { NEUTRAL_COLOR_INDEX } from '../../src/features/transactions/transactionRow';
import { useAppLocale } from '../../src/i18n/useAppLocale';
import { Icon } from '../../src/theme/Icon';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/** §6.34. */
export default function RecurrenceDetail() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { format: money } = useHiddenMoney();
  const locale = useAppLocale();
  const toast = useToast();
  const repos = useRepositories();
  const { id } = useLocalSearchParams<{ id: string }>();
  const settings = useSettings();
  const categories = useCategories();
  const accounts = useAccounts();
  const { today, def } = usePeriod();
  const { recurrence, loaded } = useRecurrenceQuery(id ?? '');
  const slow = useDelayed(!loaded);
  const occurrences = useOccurrences(id ?? '');
  // The sheet edits a draft: every tap in it reports a whole rule, and a cadence change splits the
  // series, so the database is written once, when the sheet closes (§5.9).
  const [draft, setDraft] = useState<RecurrenceRule | null>(null);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [confirmingStop, setConfirmingStop] = useState(false);

  if (!loaded) return <DetailSkeleton show={slow} />;
  if (recurrence === null) {
    return <NotFoundScreen />;
  }

  const currency = settings?.currency ?? 'EUR';
  const { template } = recurrence;
  const category = categories.find((row) => row.id === template.categoryId);
  const account = accounts.find((row) => row.id === template.accountId);
  const toAccount = accounts.find((row) => row.id === template.toAccountId);
  const colour = theme.categoryColor(category?.colorIndex ?? NEUTRAL_COLOR_INDEX);
  const icon = (template.kind === 'transfer' ? 'swap' : (category?.icon ?? 'grip')) as IconName;
  const name =
    template.description.length > 0
      ? template.description
      : template.kind === 'transfer'
        ? t('kinds.transfer')
        : (category?.name ?? t('common.thisOne'));
  const signed = template.kind === 'income' ? template.amount : -template.amount;
  const upcoming = occurrences.filter((tx) => tx.date > today);
  // Newest first, so the soonest future row is the last of the upcoming ones.
  const nextDate = upcoming.at(-1)?.date ?? null;
  const editTarget = upcoming.at(-1) ?? occurrences[0];
  const total = occurrences.reduce((sum, tx) => sum + tx.amount, 0);
  const where =
    template.kind === 'transfer'
      ? `${account?.name ?? ''} → ${toAccount?.name ?? ''}`
      : `${category?.name ?? ''} · ${account?.name ?? ''}`;
  const ended = nextDate === null && recurrence.endDate !== null;

  const stop = () => {
    stopRecurrence(db, repos, recurrence, today);
    setConfirmingStop(false);
    toast.show(t('recurrence.stopped'));
    router.back();
  };

  const openRule = () => {
    setDraft({
      frequency: recurrence.frequency,
      interval: recurrence.interval,
      endDate: recurrence.endDate,
    });
    setRuleOpen(true);
  };

  /** `Sheet.onClose` fires on the scrim, on "Fatto" and on the Android back button: the one moment the user is done. */
  const closeRule = () => {
    setRuleOpen(false);
    if (draft === null) {
      // "Mai" from the detail is the same thing as stopping.
      setConfirmingStop(true);
      return;
    }
    const unchanged =
      draft.frequency === recurrence.frequency &&
      draft.interval === recurrence.interval &&
      draft.endDate === recurrence.endDate;
    if (unchanged) return;
    const sameCadence =
      draft.frequency === recurrence.frequency && draft.interval === recurrence.interval;
    const carriedOn = changeRecurrenceRule(db, repos, recurrence, draft, today, def);
    toast.show(t(sameCadence ? 'recurrence.endChanged' : 'recurrence.ruleChanged'));
    if (carriedOn === null) router.back();
    else if (carriedOn.id !== recurrence.id) {
      router.replace({ pathname: '/recurrence/[id]', params: { id: carriedOn.id } });
    }
  };

  const factRow = (label: string, value: string, onPress?: () => void) => {
    const content = (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          minHeight: theme.layout.minHitTarget,
          paddingVertical: 10,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text size="footnote" color="textMuted">
            {label}
          </Text>
          <Text>{value}</Text>
        </View>
        {onPress === undefined ? null : (
          <Icon name="chevR" size={16} color={theme.palette.textFaint} />
        )}
      </View>
    );
    if (onPress === undefined) return content;
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
        {content}
      </Pressable>
    );
  };

  const stopBody =
    upcoming.length === 0
      ? t('recurrence.stopBodyNone')
      : t('recurrence.stopBody', { count: upcoming.length });

  return (
    <>
      <Screen refreshable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <BackButton />
          <Text
            size="display"
            weight="semibold"
            tracking="tighter"
            style={{ flex: 1 }}
            numberOfLines={1}
          >
            {name}
          </Text>
          {editTarget === undefined ? null : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.edit')}
              hitSlop={10}
              onPress={() =>
                router.push({ pathname: '/transaction/edit/[id]', params: { id: editTarget.id } })
              }
            >
              <Text color="textMuted">{t('common.edit')}</Text>
            </Pressable>
          )}
        </View>

        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <IconBox name={icon} colour={colour} badge="repeat" />
            <Text size="footnote" color="textMuted" numberOfLines={1} style={{ flex: 1 }}>
              {where}
            </Text>
          </View>
          <View style={{ marginTop: 8 }}>
            <AmountText
              plain
              align="end"
              minor={template.kind === 'transfer' ? template.amount : signed}
              currency={currency}
              locale={locale}
              signDisplay={template.kind === 'transfer' ? 'never' : 'always'}
              size="hero"
              weight="semibold"
              tracking="tightest"
              color={signed > 0 && template.kind !== 'transfer' ? 'positive' : undefined}
            />
          </View>
          <Text size="footnote" color="textMuted" style={{ marginTop: 4 }}>
            {cadenceLabel(recurrence, recurrence.startDate, t, locale)}
            {nextDate !== null
              ? ` · ${t('recurrence.next', { date: formatDayMonth(nextDate, locale) })}`
              : recurrence.endDate === null
                ? ''
                : ` · ${t('recurrence.ended', { date: formatDayMonth(recurrence.endDate, locale) })}`}
          </Text>
        </Card>

        <Card>
          {factRow(
            t('recurrence.cadence'),
            cadenceLabel(recurrence, recurrence.startDate, t, locale),
            openRule,
          )}
          <View style={{ height: 1, backgroundColor: theme.palette.border }} />
          {factRow(
            t('recurrence.end'),
            recurrence.endDate === null
              ? t('recurrence.endNever')
              : formatLongDate(recurrence.endDate, locale),
            openRule,
          )}
          <View style={{ height: 1, backgroundColor: theme.palette.border }} />
          {factRow(t('recurrence.firstOccurrence'), formatLongDate(recurrence.startDate, locale))}
        </Card>

        <Card padded={false}>
          <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingBottom: 6 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingTop: 14,
                paddingBottom: 2,
              }}
            >
              <Text size="footnote" color="textMuted">
                {t('recurrence.occurrences')}
              </Text>
              <Text size="caption" color="textFaint" tabular>
                {t('recurrence.occurrencesTotal', {
                  count: occurrences.length,
                  amount: money(total, currency, locale),
                })}
              </Text>
            </View>
            {occurrences.map((tx) => (
              <ListRow
                key={tx.id}
                title={formatDayMonth(tx.date, locale)}
                subtitle={
                  tx.date > today
                    ? t('transactions.upcoming')
                    : tx.date === today
                      ? t('txForm.today')
                      : undefined
                }
                leading={<IconBox name={icon} colour={colour} badge="repeat" />}
                upcoming={tx.date > today}
                trailing={
                  <AmountText
                    plain
                    align="end"
                    minor={tx.kind === 'income' ? tx.amount : -tx.amount}
                    currency={currency}
                    locale={locale}
                    signDisplay={tx.kind === 'transfer' ? 'never' : 'always'}
                    color={
                      tx.date > today ? 'textMuted' : tx.kind === 'income' ? 'positive' : undefined
                    }
                  />
                }
                onPress={() =>
                  router.push({ pathname: '/transaction/[id]', params: { id: tx.id } })
                }
                chevron
              />
            ))}
          </View>
        </Card>

        {ended ? null : (
          <View style={{ gap: 8 }}>
            <SecondaryButton label={t('recurrence.stop')} onPress={() => setConfirmingStop(true)} />
            <Text size="caption" color="textFaint" style={{ textAlign: 'center' }}>
              {stopBody}
            </Text>
          </View>
        )}
      </Screen>

      <RecurrenceSheet
        visible={ruleOpen}
        onClose={closeRule}
        value={draft}
        startDate={recurrence.startDate}
        today={today}
        onChange={setDraft}
        anchorFor={(rule) =>
          rule.frequency === recurrence.frequency && rule.interval === recurrence.interval
            ? recurrence.startDate
            : // A new cadence starts on its first date after today (`changeRecurrenceRule`); the
              // end is unknown until the rule is complete, so count from the open-ended schedule.
              (nextOccurrence({ ...rule, endDate: null, startDate: recurrence.startDate }, today) ??
              recurrence.startDate)
        }
      />

      <ConfirmDialog
        visible={confirmingStop}
        title={t('recurrence.stopTitle', { name })}
        body={stopBody}
        confirmLabel={t('recurrence.stop')}
        cancelLabel={t('common.cancel')}
        onConfirm={stop}
        onCancel={() => setConfirmingStop(false)}
      />
    </>
  );
}
