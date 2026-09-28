import { NEUTRAL_COLOR_INDEX, type Recurrence, recurringMonthlyTotals } from '@saldo/core';
import { cadenceLabel, formatDayMonth } from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AmountText } from '../src/components/AmountText';
import { Card } from '../src/components/Card';
import { EmptyState } from '../src/components/EmptyState';
import { IconBox, ListRow } from '../src/components/ListRow';
import { ProgressBar } from '../src/components/ProgressBar';
import { Screen } from '../src/components/Screen';
import { BackButton } from '../src/components/ScreenHeader';
import { SkeletonList } from '../src/components/Skeleton';
import { useDelayed } from '../src/components/useDelayed';
import { useCategories, useRecurrencesQuery, useSettings } from '../src/db/hooks';
import { usePeriod } from '../src/features/period/PeriodProvider';
import {
  byNext,
  type RecurrenceView,
  recurrenceViews,
} from '../src/features/recurrences/recurrenceViews';
import { useAppLocale } from '../src/i18n/useAppLocale';
import { Text } from '../src/theme/Text';
import { useTheme } from '../src/theme/ThemeProvider';

const FREQUENCY_ORDER: Record<Recurrence['frequency'], number> = {
  monthly: 0,
  weekly: 1,
  daily: 2,
  yearly: 3,
};

/** One card per cadence: "Ogni mese", "Ogni 2 settimane", … */
function groupKey(recurrence: Recurrence): string {
  return `${recurrence.frequency}:${recurrence.interval}`;
}

/** §6.33. */
export default function RecurrencesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const settings = useSettings();
  const categories = useCategories();
  const { rows: recurrences, loaded } = useRecurrencesQuery();
  const slow = useDelayed(!loaded);
  const { today } = usePeriod();
  const currency = settings?.currency ?? 'EUR';

  const views = useMemo(
    () =>
      recurrenceViews(
        recurrences,
        today,
        (id) => categories.find((row) => row.id === id)?.name ?? '',
        t('kinds.transfer'),
      ).sort(byNext),
    [recurrences, today, categories, t],
  );
  const live = useMemo(() => views.filter((view) => view.next !== null), [views]);
  const ended = useMemo(() => views.filter((view) => view.next === null), [views]);
  const totals = useMemo(() => recurringMonthlyTotals(live.map((view) => view.recurrence)), [live]);
  const share = totals.income > 0 ? totals.expense / totals.income : null;

  const groups = useMemo(() => {
    const map = new Map<string, RecurrenceView[]>();
    for (const view of live) {
      const key = groupKey(view.recurrence);
      map.set(key, [...(map.get(key) ?? []), view]);
    }
    return [...map.entries()].sort(([, a], [, b]) => {
      const ra = a[0]?.recurrence;
      const rb = b[0]?.recurrence;
      if (ra === undefined || rb === undefined) return 0;
      return (
        FREQUENCY_ORDER[ra.frequency] - FREQUENCY_ORDER[rb.frequency] || ra.interval - rb.interval
      );
    });
  }, [live]);

  const rowFor = (view: RecurrenceView) => {
    const { template } = view.recurrence;
    const category = categories.find((row) => row.id === template.categoryId);
    const icon = (template.kind === 'transfer' ? 'swap' : (category?.icon ?? 'grip')) as IconName;
    const colour = theme.categoryColor(category?.colorIndex ?? NEUTRAL_COLOR_INDEX);
    const signed = template.kind === 'income' ? template.amount : -template.amount;
    const when =
      view.next === null
        ? t('recurrence.ended', {
            date: formatDayMonth(view.recurrence.endDate ?? today, locale),
          })
        : t('recurrence.next', { date: formatDayMonth(view.next, locale) });
    return (
      <ListRow
        key={view.recurrence.id}
        testID={`recurrence-${view.recurrence.id}`}
        title={view.title}
        subtitle={`${cadenceLabel(view.recurrence, view.recurrence.startDate, t, locale)} · ${when}`}
        leading={<IconBox name={icon} colour={colour} badge="repeat" />}
        trailing={
          <AmountText
            plain
            align="end"
            minor={template.kind === 'transfer' ? template.amount : signed}
            currency={currency}
            locale={locale}
            signDisplay={template.kind === 'transfer' ? 'never' : 'always'}
            color={view.next === null ? 'textMuted' : signed > 0 ? 'positive' : undefined}
          />
        }
        chevron
        onPress={() =>
          router.push({ pathname: '/recurrence/[id]', params: { id: view.recurrence.id } })
        }
      />
    );
  };

  const section = (key: string, label: string, rows: RecurrenceView[]) => (
    <Card key={key} padded={false}>
      <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingBottom: 6 }}>
        <Text size="footnote" color="textMuted" style={{ paddingTop: 14, paddingBottom: 2 }}>
          {label}
        </Text>
        {rows.map(rowFor)}
      </View>
    </Card>
  );

  return (
    <Screen refreshable>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <BackButton />
        <Text size="display" weight="semibold" tracking="tighter" style={{ flex: 1 }}>
          {t('recurrence.title')}
        </Text>
      </View>

      {!loaded ? (
        slow ? (
          <SkeletonList rows={4} label={t('common.loading')} />
        ) : null
      ) : views.length === 0 ? (
        <EmptyState
          kind="yet"
          ghost="row"
          title={t('recurrence.empty')}
          body={t('recurrence.emptyBody')}
          // "Ripeti" lives on the transaction form (§6.33), so that is where this leads.
          action={{
            label: t('transactions.newTransaction'),
            onPress: () => router.push('/transaction/new'),
          }}
        />
      ) : (
        <>
          <Card>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'baseline',
              }}
            >
              <Text size="footnote" color="textMuted">
                {t('recurrence.monthlyAverage')}
              </Text>
              <Text size="caption" color="textFaint">
                {t('recurrence.count', { count: live.length })}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
              <AmountText
                align="end"
                minor={-totals.expense}
                currency={currency}
                locale={locale}
                size="amountMd"
                weight="semibold"
                tracking="tighter"
              />
              {totals.income === 0 ? null : (
                <AmountText
                  align="end"
                  minor={totals.income}
                  currency={currency}
                  locale={locale}
                  signDisplay="always"
                  size="footnote"
                  color="positive"
                />
              )}
            </View>
            {share === null ? null : (
              <View style={{ marginTop: 12, gap: 6 }}>
                <ProgressBar ratio={share} />
                <Text size="caption" color="textFaint">
                  {t('recurrence.shareOfIncome', { percent: Math.round(share * 100) })}
                </Text>
              </View>
            )}
          </Card>

          {groups.map(([key, rows]) => {
            const head = rows[0];
            if (head === undefined) return null;
            return section(
              key,
              t(`recurrence.every_${head.recurrence.frequency}`, {
                count: head.recurrence.interval,
              }),
              rows,
            );
          })}

          {ended.length === 0 ? null : section('ended', t('recurrence.endedSection'), ended)}
        </>
      )}
    </Screen>
  );
}
