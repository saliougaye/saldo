import {
  averageSeries,
  categorySpendHistory,
  committedSpend,
  dailyCumulative,
  deltaPercent,
  isWithin,
  median,
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
import { formatCycleRange, formatMoney, formatPeriodTick, formatSignedPercent } from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { AmountText } from '../../src/components/AmountText';
import { Card } from '../../src/components/Card';
import { IconBox, ListRow } from '../../src/components/ListRow';
import { Screen } from '../../src/components/Screen';
import { Segmented } from '../../src/components/Segmented';
import { useDelayed } from '../../src/components/useDelayed';
import { useCategories, useSettings, useTransactionsInRangeQuery } from '../../src/db/hooks';
import { CycleTrendChart } from '../../src/features/home/CycleTrendChart';
import { PeriodHeader } from '../../src/features/period/PeriodHeader';
import { usePeriod } from '../../src/features/period/PeriodProvider';
import { CashflowChart } from '../../src/features/stats/CashflowChart';
import { SplitBar } from '../../src/features/stats/SplitBar';
import { StatsSkeleton } from '../../src/features/stats/StatsSkeleton';
import { useAppLocale } from '../../src/i18n/useAppLocale';
import { appearing, entering, leaving, reflowing } from '../../src/theme/motion';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/** §5.7 shows six cycles including the current one. */
const CASHFLOW_CYCLES = 6;
/** "Il solito" on the cycle-trend chart is the average of this many previous cycles (§5.6). */
const USUAL_CYCLES = 3;
/** The projection is only offered with at least this many days left (§5.7). */
const MIN_DAYS_LEFT = 3;

export default function StatsTab() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const settings = useSettings();
  const categories = useCategories();
  const { today, def, period } = usePeriod();
  const currency = settings?.currency ?? 'EUR';
  const [direction, setDirection] = useState<'expense' | 'income'>('expense');

  const historyStart =
    previousPeriods(def, period.range, CASHFLOW_CYCLES).at(-1)?.start ?? period.range.start;
  // The query, not just its rows: this screen reads six cycles, and rendering it against an empty
  // array first is what made it jump when the data landed.
  const { rows, loaded } = useTransactionsInRangeQuery(historyStart, period.range.end);
  const loading = useDelayed(!loaded);

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

  const bars = useMemo(() => {
    const cycles = [period.range];
    for (let back = 1; back < CASHFLOW_CYCLES; back += 1) {
      cycles.push(shiftPeriod(def, period.range, -back));
    }
    return cycles.reverse().map((cycle) => {
      const cycleSummary = summarizePeriod(rows, cycle, today);
      return {
        key: cycle.start,
        label: formatPeriodTick(cycle.start, def.kind, locale),
        income: cycleSummary.income,
        expenses: cycleSummary.spent,
        current: cycle.start === period.range.start,
      };
    });
  }, [rows, period.range, def, today, locale]);

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
        <PeriodHeader />
        {loading ? <StatsSkeleton /> : null}
      </Screen>
    );
  }

  return (
    <Screen underTabBar>
      <PeriodHeader />

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
              {t('stats.lastCycles')}
            </Text>
          </View>
          <View style={{ marginTop: 18 }}>
            <CashflowChart bars={bars} currency={currency} locale={locale} />
          </View>
        </Card>
      </Animated.View>

      <Animated.View entering={entering(1)}>
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

      <Animated.View entering={entering(2)}>
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
              amount: formatMoney(committed, currency, locale),
            })}
          </Text>
        </Card>
      </Animated.View>

      {showProjection ? (
        <Animated.View entering={entering(3)}>
          <Card>
            <Text weight="medium" tracking="tight">
              {t('stats.projection')}
            </Text>
            <AmountText
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
                  amount: formatMoney(Math.abs(projection - (cycleMedian ?? 0)), currency, locale),
                },
              )}
            </Text>
          </Card>
        </Animated.View>
      ) : null}

      <Animated.View entering={entering(3)}>
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
              split.rows.map((row) => (
                // Switching expense/income swaps the whole list; the rows fade rather than snap.
                <Animated.View
                  key={row.id}
                  layout={reflowing}
                  entering={appearing}
                  exiting={leaving}
                >
                  <ListRow
                    title={row.name}
                    subtitle={`${row.delta === null ? t('stats.newLabel') : formatSignedPercent(row.delta)} · ${t('stats.ofTotal', { pct: row.share })}`}
                    leading={<IconBox name={row.icon} colour={row.colour} />}
                    onPress={() =>
                      router.push({ pathname: '/category/[id]', params: { id: row.id } })
                    }
                    trailing={<AmountText minor={row.amount} currency={currency} locale={locale} />}
                  />
                </Animated.View>
              ))
            )}
            {excluded.length === 0 ? null : (
              <ListRow
                title={t('stats.excludedRow', { count: excluded.length })}
                trailing={
                  <AmountText
                    minor={excluded.reduce((sum, tx) => sum + tx.amount, 0)}
                    currency={currency}
                    locale={locale}
                    color="textMuted"
                  />
                }
              />
            )}
          </View>
        </Card>
      </Animated.View>

      <Text size="caption" color="textFaint">
        {formatCycleRange(period.range, locale, today)}
      </Text>
    </Screen>
  );
}
