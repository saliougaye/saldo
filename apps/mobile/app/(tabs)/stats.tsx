import {
  accountBalances,
  averageSeries,
  categorySpendHistory,
  committedSpend,
  dailyCumulative,
  deltaPercent,
  FORECAST_PERIODS,
  forecastPeriods,
  isWithin,
  median,
  netWorth,
  periodHistory,
  periodSpendHistory,
  previousPeriods,
  projectEndOfCycle,
  rollupToParents,
  shiftPeriod,
  spendingByCategory,
  summarizePeriod,
  upcomingExpenses,
} from '@saldo/core';
import { formatCycleRange, formatLongDate, formatPeriodTick } from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { AmountText } from '../../src/components/AmountText';
import { Card } from '../../src/components/Card';
import { ListRow } from '../../src/components/ListRow';
import { Screen } from '../../src/components/Screen';
import { Segmented } from '../../src/components/Segmented';
import { Sheet } from '../../src/components/Sheet';
import {
  useAccountsQuery,
  useCategoriesQuery,
  useRecurrencesQuery,
  useSettings,
  useTransactionsInRangeQuery,
} from '../../src/db/hooks';
import { useHiddenMoney } from '../../src/features/hidden/hiddenAmounts';
import { CycleTrendChart } from '../../src/features/home/CycleTrendChart';
import { PeriodHeader } from '../../src/features/period/PeriodHeader';
import { usePeriod } from '../../src/features/period/PeriodProvider';
import { type CashflowBar, CashflowChart } from '../../src/features/stats/CashflowChart';
import { CategorySplitRows } from '../../src/features/stats/CategorySplitRows';
import { ForecastSheet } from '../../src/features/stats/ForecastSheet';
import { SplitBar } from '../../src/features/stats/SplitBar';
import { StatsSkeleton } from '../../src/features/stats/StatsSkeleton';
import { TagSpendCard } from '../../src/features/stats/TagSpendCard';
import { useAppLocale } from '../../src/i18n/useAppLocale';
import { Icon } from '../../src/theme/Icon';
import { entering } from '../../src/theme/motion';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/** §5.7 shows six cycles including the current one. */
const CASHFLOW_CYCLES = 6;
/** › stops at the current period here: what comes after it is the forecast (§5.17). */
const STATS_PERIODS_AHEAD = 0;
/** The start of any history: a balance covers every row ever entered (§5.3). */
const EVERYTHING = '1970-01-01';
/** "Il solito" on the cycle-trend chart is the average of this many previous cycles (§5.6). */
const USUAL_CYCLES = 3;
/** The projection is only offered with at least this many days left (§5.7). */
const MIN_DAYS_LEFT = 3;
/**
 * Categories shown in the card before the rest move to the sheet.
 *
 * The split bar keeps every category, so the proportions stay honest at 8px tall; it is the rows
 * that grow without bound, and a card whose height depends on how many categories someone happens
 * to have is a card nobody scrolls past.
 */
const CARD_CATEGORIES = 3;

export default function StatsTab() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { format: money } = useHiddenMoney();
  const locale = useAppLocale();
  const settings = useSettings();
  const { rows: categories, loaded: categoriesLoaded } = useCategoriesQuery();
  const { today, def, period, resetToCurrent } = usePeriod();
  // The selection is shared with Home and Transactions, which may go one period ahead (§6.15).
  // Here the periods ahead are the forecast (§5.17), so arriving on one comes back to today's;
  // once on this tab nothing can select one, since › stops at the current period.
  const aheadOfToday = period.isPeriod && period.range.start > today;
  useFocusEffect(
    useCallback(() => {
      if (aheadOfToday) resetToCurrent();
    }, [aheadOfToday, resetToCurrent]),
  );
  const currency = settings?.currency ?? 'EUR';
  const [direction, setDirection] = useState<'expense' | 'income'>('expense');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [forecastOpen, setForecastOpen] = useState(false);
  // Pushing the category while the sheet is still dismissing leaves the modal on top of it, so the
  // tap is parked here and spent once the sheet has actually gone.
  const [pending, setPending] = useState<string | null>(null);

  const openCategory = (id: string) => router.push({ pathname: '/category/[id]', params: { id } });

  const historyStart =
    previousPeriods(def, period.range, CASHFLOW_CYCLES).at(-1)?.start ?? period.range.start;
  // §5.17: only on a whole period that holds today. A custom range, a closed period or the one
  // ahead keep the six historical columns; walking back is the header's ‹, not the chart's.
  const forecastOn = period.isPeriod && period.isCurrent;
  const forecastEnd = shiftPeriod(def, period.range, FORECAST_PERIODS).end;
  // The query, not just its rows: this screen reads six cycles, and rendering it against an empty
  // array first is what made it jump when the data landed. With a forecast it reads the whole
  // history, because the balance chain starts from today's net worth (§5.3), and the three periods
  // ahead, for what is already scheduled in them. Every calculation below filters by its range.
  const { rows, loaded: rowsLoaded } = useTransactionsInRangeQuery(
    forecastOn ? EVERYTHING : historyStart,
    forecastOn ? forecastEnd : period.range.end,
  );
  const { accounts, loaded: accountsLoaded } = useAccountsQuery();
  const { rows: recurrences, loaded: recurrencesLoaded } = useRecurrencesQuery();
  // The split prints category names. The skeleton shows at once, as on every tab: a blank band
  // under the header read as a hang.
  const loaded = rowsLoaded && categoriesLoaded && accountsLoaded && recurrencesLoaded;

  const forecast = useMemo(() => {
    if (!forecastOn) return null;
    return forecastPeriods({
      txs: rows,
      recurrences,
      def,
      period: period.range,
      today,
      balance: netWorth(accounts, accountBalances(accounts, rows, today)),
    });
  }, [forecastOn, rows, recurrences, def, period.range, today, accounts]);

  const summary = useMemo(
    () => summarizePeriod(rows, period.range, today),
    [rows, period.range, today],
  );
  // §5.6 moved here from Home: it is the one card that is read rather than glanced at, and it
  // belongs next to the six cycles it is a close-up of.
  const current = useMemo(
    () => dailyCumulative(rows, period.range, today),
    [rows, period.range, today],
  );
  const usual = useMemo(() => {
    const history = periodHistory(rows, def, period.range, USUAL_CYCLES);
    return averageSeries(
      history.map((entry) => dailyCumulative(entry.txs, entry.period, today)),
      Math.max(1, current.length),
    );
  }, [rows, period.range, def, today, current.length]);

  const bars = useMemo<CashflowBar[]>(() => {
    // D29: with a forecast the six columns are 2 closed + current + 3 ahead, never nine.
    const historical = forecast === null ? CASHFLOW_CYCLES : CASHFLOW_CYCLES - FORECAST_PERIODS;
    const cycles = [period.range];
    for (let back = 1; back < historical; back += 1) {
      cycles.push(shiftPeriod(def, period.range, -back));
    }
    const past = cycles.reverse().map((cycle) => {
      const cycleSummary = summarizePeriod(rows, cycle, today);
      return {
        key: cycle.start,
        label: formatPeriodTick(cycle.start, def.kind, locale),
        income: cycleSummary.income,
        expenses: cycleSummary.spent,
        // Hatched means "still running": a closed period the user walked back to is final.
        current: period.isCurrent && cycle.start === period.range.start,
      };
    });
    if (forecast === null) return past;
    return [
      ...past,
      ...forecast.map((ahead) => ({
        key: ahead.range.start,
        label: formatPeriodTick(ahead.range.start, def.kind, locale),
        income: ahead.income,
        expenses: ahead.expenses,
        current: false,
        forecast: { min: ahead.expensesMin, max: ahead.expensesMax },
      })),
    ];
  }, [rows, period.range, period.isCurrent, def, today, locale, forecast]);
  const forecastLast = forecast?.at(-1);

  const committed = useMemo(
    () => committedSpend(rows, period.range, today),
    [rows, period.range, today],
  );
  const discretionary = Math.max(0, summary.spent - committed);
  const committedPct = summary.spent === 0 ? 0 : Math.round((committed / summary.spent) * 100);

  const cycleMedian = useMemo(() => {
    const history = periodHistory(rows, def, period.range, CASHFLOW_CYCLES);
    return median(periodSpendHistory(history, today));
  }, [rows, period.range, def, today]);

  const projection = useMemo(
    () =>
      projectEndOfCycle({
        spent: summary.spent,
        committed,
        elapsed: period.elapsed,
        length: period.length,
        upcoming: upcomingExpenses(rows, period.range, today),
      }),
    [summary.spent, committed, period, rows, today],
  );
  const daysLeft = Math.max(0, period.length - period.elapsed);
  const showProjection = period.isCurrent && daysLeft >= MIN_DAYS_LEFT && cycleMedian !== null;

  const split = useMemo(() => {
    const amounts = rollupToParents(
      spendingByCategory(rows, period.range, today, direction),
      categories,
    );
    const history = categorySpendHistory(
      periodHistory(rows, def, period.range, CASHFLOW_CYCLES),
      categories,
      today,
    );
    const total = [...amounts.values()].reduce((sum, value) => sum + value, 0);
    return {
      total,
      rows: [...amounts.entries()]
        .sort(([, a], [, b]) => b - a)
        .map(([id, amount]) => {
          const category = categories.find((candidate) => candidate.id === id);
          const past = history.map((cycle) => cycle.get(id) ?? 0).filter((value) => value > 0);
          return {
            id,
            amount,
            name: category?.name ?? '—',
            icon: (category?.icon ?? 'tag') as IconName,
            colour: theme.categoryColor(category?.colorIndex ?? 9),
            delta: deltaPercent(amount, median(past)),
            share: total === 0 ? 0 : Math.round((amount / total) * 100),
          };
        }),
    };
  }, [rows, period.range, today, direction, categories, def, theme]);

  // "N transazioni escluse dai totali" (§5.7): in range, already happened, and flagged out.
  const excluded = useMemo(
    () =>
      rows.filter(
        (tx) =>
          tx.excludeFromTotals &&
          tx.kind === direction &&
          isWithin(period.range, tx.date) &&
          tx.date <= today,
      ),
    [rows, period.range, today, direction],
  );

  if (!loaded) {
    return (
      <Screen underTabBar>
        <PeriodHeader maxAhead={STATS_PERIODS_AHEAD} />
        <StatsSkeleton />
      </Screen>
    );
  }

  return (
    <Screen underTabBar refreshable>
      <PeriodHeader maxAhead={STATS_PERIODS_AHEAD} />

      <Animated.View entering={entering(0)}>
        <Card>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <Text weight="medium" tracking="tight">
              {t('stats.cashflow')}
            </Text>
            <Text size="caption" color="textFaint" numberOfLines={1}>
              {t(forecast === null ? 'stats.lastCycles' : 'stats.lastAndForecast')}
            </Text>
          </View>
          <View style={{ marginTop: 18 }}>
            <CashflowChart
              bars={bars}
              currency={currency}
              locale={locale}
              footer={
                forecastLast === undefined ? null : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('stats.forecastEnd', {
                      date: formatLongDate(forecastLast.range.end, locale),
                      amount: money(forecastLast.balance, currency, locale),
                    })}
                    onPress={() => setForecastOpen(true)}
                    style={({ pressed }) => ({
                      minHeight: theme.layout.minHitTarget,
                      marginVertical: -8,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      opacity: pressed ? 0.6 : 1,
                    })}
                  >
                    <Text size="footnote" color="textMuted" tabular style={{ flexShrink: 1 }}>
                      {t('stats.forecastEndLabel', {
                        date: formatLongDate(forecastLast.range.end, locale),
                      })}{' '}
                      <Text size="footnote" weight="medium" tabular>
                        {money(forecastLast.balance, currency, locale)}
                      </Text>
                    </Text>
                    <Icon name="chevR" size={16} color={theme.palette.textMuted} />
                  </Pressable>
                )
              }
            />
          </View>
        </Card>
      </Animated.View>

      <Animated.View entering={entering(1)}>
        <Card>
          <Segmented
            accessibilityLabel={t('stats.split')}
            options={[
              { value: 'expense', label: t('stats.expenses') },
              { value: 'income', label: t('stats.income') },
            ]}
            value={direction}
            onChange={setDirection}
          />
          <AmountText
            minor={split.total}
            currency={currency}
            locale={locale}
            size="amountMd"
            weight="semibold"
            tracking="tighter"
            style={{ marginTop: 12 }}
          />
          <View style={{ marginTop: 10 }}>
            <SplitBar
              segments={split.rows.map((row) => ({
                key: row.id,
                amount: row.amount,
                colour: row.colour,
              }))}
            />
          </View>
          <View style={{ marginTop: 6 }}>
            {split.rows.length === 0 ? (
              <Text color="textMuted" style={{ paddingVertical: 12 }}>
                {t('stats.empty')}
              </Text>
            ) : (
              <CategorySplitRows
                rows={split.rows.slice(0, CARD_CATEGORIES)}
                currency={currency}
                locale={locale}
                onPress={openCategory}
              />
            )}
            {split.rows.length > CARD_CATEGORIES ? (
              <ListRow
                title={t('stats.seeAll', { count: split.rows.length })}
                chevron
                onPress={() => setSheetOpen(true)}
              />
            ) : null}
            {/* A note, not an action: at row weight it read as loud as "see all", which is the
                one thing in this card worth tapping. Same treatment as the untagged line — it
                still opens the list it counts (§5.7), it just stops announcing it. */}
            {excluded.length === 0 ? null : (
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: '/(tabs)/transactions',
                    params: { direction, onlyExcluded: '1' },
                  })
                }
                // Padding would make it look like a row again, so the tap area grows outwards
                // instead: ~16px of text plus 8 above and below clears the 44px target.
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ paddingVertical: 6, marginTop: 2 }}
              >
                <Text size="footnote" color="textMuted">
                  {t('stats.excludedRow', {
                    count: excluded.length,
                    amount: money(
                      excluded.reduce((sum, tx) => sum + tx.amount, 0),
                      currency,
                      locale,
                    ),
                  })}
                </Text>
              </Pressable>
            )}
          </View>
        </Card>
      </Animated.View>

      {/* Tags read next to the category split, not from Profile: a trip is the one thing here that
          is not shaped like a cycle, and it used to be four taps deep inside the settings. */}
      <Animated.View entering={entering(2)}>
        <TagSpendCard
          rows={rows}
          range={period.range}
          today={today}
          currency={currency}
          locale={locale}
        />
      </Animated.View>

      <Animated.View entering={entering(3)}>
        <Card>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <Text weight="medium" tracking="tight">
              {t('stats.cycleTrend')}
            </Text>
            <AmountText
              align="end"
              minor={current[current.length - 1] ?? 0}
              currency={currency}
              locale={locale}
              weight="medium"
            />
          </View>
          <View style={{ marginTop: 12 }}>
            <CycleTrendChart current={current} usual={usual} />
          </View>
          <Text size="caption" color="textFaint" style={{ marginTop: 8 }}>
            {t('stats.trendFooter', { elapsed: period.elapsed, length: period.length })}
          </Text>
        </Card>
      </Animated.View>

      <Animated.View entering={entering(4)}>
        <Card>
          <Text weight="medium" tracking="tight">
            {t('stats.committed')}
          </Text>
          <View style={{ marginTop: 12 }}>
            <SplitBar
              segments={[
                { key: 'committed', amount: committed, colour: theme.palette.barGrey },
                { key: 'discretionary', amount: discretionary, colour: theme.palette.accent },
              ]}
            />
          </View>
          <Text size="footnote" color="textMuted" style={{ marginTop: 10 }}>
            {t('stats.committedLine', {
              pct: committedPct,
              amount: money(committed, currency, locale),
            })}
          </Text>
        </Card>
      </Animated.View>

      {showProjection ? (
        <Animated.View entering={entering(5)}>
          <Card>
            <Text weight="medium" tracking="tight">
              {t('stats.projection')}
            </Text>
            <AmountText
              align="end"
              minor={projection}
              currency={currency}
              locale={locale}
              size="amountMd"
              weight="semibold"
              tracking="tighter"
              style={{ marginTop: 4 }}
            />
            <Text size="footnote" color="textMuted" style={{ marginTop: 6 }}>
              {t(
                projection >= (cycleMedian ?? 0)
                  ? 'stats.projectionAbove'
                  : 'stats.projectionBelow',
                {
                  amount: money(Math.abs(projection - (cycleMedian ?? 0)), currency, locale),
                },
              )}
            </Text>
          </Card>
        </Animated.View>
      ) : null}

      <Text size="caption" color="textFaint">
        {formatCycleRange(period.range, locale, today)}
      </Text>

      {forecast === null ? null : (
        <ForecastSheet
          visible={forecastOpen}
          onClose={() => setForecastOpen(false)}
          periods={forecast}
          currency={currency}
          locale={locale}
          today={today}
        />
      )}

      <Sheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={t('stats.split')}
        tall
        onDismissed={() => {
          if (pending === null) return;
          openCategory(pending);
          setPending(null);
        }}
      >
        <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
          <View>
            <CategorySplitRows
              rows={split.rows}
              currency={currency}
              locale={locale}
              onPress={(id) => {
                setPending(id);
                setSheetOpen(false);
              }}
            />
          </View>
        </ScrollView>
      </Sheet>
    </Screen>
  );
}
