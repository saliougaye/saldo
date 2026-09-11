import {
  averageSeries,
  dailyCumulative,
  isUpcoming,
  periodHistory,
  previousPeriods,
  summarizePeriod,
} from '@saldo/core';
import { formatMoney } from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { AmountText, AnimatedAmount } from '../../src/components/AmountText';
import { Card } from '../../src/components/Card';
import { IconBox, ListRow } from '../../src/components/ListRow';
import { ProgressBar } from '../../src/components/ProgressBar';
import { Screen } from '../../src/components/Screen';
import { useBudgets, useCategories, useSettings, useTransactionsInRange } from '../../src/db/hooks';
import { BudgetAlertsGate } from '../../src/features/budgets/BudgetAlertsGate';
import { HomeBudgetCard } from '../../src/features/budgets/HomeBudgetCard';
import { budgetViews } from '../../src/features/budgets/useBudgetProgress';
import { CycleTrendChart } from '../../src/features/home/CycleTrendChart';
import { DevTools } from '../../src/features/home/DevTools';
import { PeriodHeader } from '../../src/features/period/PeriodHeader';
import { usePeriod } from '../../src/features/period/PeriodProvider';
import { useAppLocale } from '../../src/i18n/useAppLocale';
import { appearing, entering, leaving, reflowing } from '../../src/theme/motion';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/** How many previous cycles the "usual" line averages (§5.6). */
const USUAL_CYCLES = 3;

export default function HomeTab() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const settings = useSettings();
  const categories = useCategories();
  const budgets = useBudgets();
  const { today, def, period } = usePeriod();
  const currency = settings?.currency ?? 'EUR';

  // Load the selected cycle plus the previous six, which is all the baselines need (§7).
  const historyStart = previousPeriods(def, period.range, 6).at(-1)?.start ?? period.range.start;
  const rows = useTransactionsInRange(historyStart, period.range.end);

  const summary = useMemo(
    () => summarizePeriod(rows, period.range, today),
    [rows, period.range, today],
  );
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

  const upcoming = useMemo(
    () => rows.filter((tx) => isUpcoming(tx, today) && tx.date <= period.range.end),
    [rows, today, period.range.end],
  );
  const recent = useMemo(
    () => rows.filter((tx) => !isUpcoming(tx, today) && tx.date >= period.range.start).slice(0, 5),
    [rows, today, period.range.start],
  );

  const views = useMemo(
    () =>
      budgetViews({
        budgets,
        categories,
        transactions: rows,
        period: period.range,
        def,
        today,
      }),
    [budgets, categories, rows, period.range, def, today],
  );

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  const rowFor = (id: string) => {
    const category = categoryById.get(id);
    return {
      icon: (category?.icon ?? 'tag') as IconName,
      colour: theme.categoryColor(category?.colorIndex ?? 9),
      name: category?.name ?? '—',
    };
  };

  return (
    <Screen underTabBar>
      <PeriodHeader showProfile />

      <Animated.View entering={entering(0)}>
        <Card>
          <Text size="footnote" color="textMuted">
            {period.isCurrent ? t('home.remaining') : t('home.leftover')}
          </Text>
          <AnimatedAmount
            minor={summary.remaining}
            currency={currency}
            locale={locale}
            size="hero"
            weight="semibold"
            tracking="tightest"
            style={{ marginTop: 2 }}
          />
          <View style={{ marginTop: 14 }}>
            <ProgressBar
              ratio={summary.ratio}
              pace={period.isCurrent ? summary.pace : undefined}
              overPace={summary.overPace}
            />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
            <Text size="footnote" color="textMuted">
              {`${t('home.income')} ${formatMoney(summary.income, currency, locale)}`}
            </Text>
            <Text size="footnote" color="textMuted">
              {`${t('home.expenses')} ${formatMoney(summary.spent, currency, locale)}`}
            </Text>
          </View>
        </Card>
      </Animated.View>

      <Animated.View entering={entering(1)}>
        <HomeBudgetCard views={views} />
      </Animated.View>

      <Animated.View entering={entering(2)}>
        <Card>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <Text weight="medium" tracking="tight">
              {t('home.cycleTrend')}
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
            {t('home.trendFooter', { elapsed: period.elapsed, length: period.length })}
          </Text>
        </Card>
      </Animated.View>

      {upcoming.length === 0 ? null : (
        <Animated.View entering={entering(3)}>
          <Card padded={false}>
            <View style={{ padding: theme.layout.cardPadding, paddingBottom: 4 }}>
              <Text weight="medium" tracking="tight">
                {t('home.upcoming')}
              </Text>
            </View>
            <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingBottom: 8 }}>
              {upcoming.map((tx) => {
                const meta = rowFor(tx.categoryId ?? '');
                return (
                  <ListRow
                    key={tx.id}
                    upcoming
                    title={tx.description.length > 0 ? tx.description : meta.name}
                    subtitle={meta.name}
                    leading={<IconBox name={meta.icon} colour={meta.colour} />}
                    onPress={() =>
                      router.push({ pathname: '/transaction/[id]', params: { id: tx.id } })
                    }
                    trailing={
                      <AmountText
                        minor={tx.kind === 'income' ? tx.amount : -tx.amount}
                        currency={currency}
                        locale={locale}
                        color="textMuted"
                      />
                    }
                  />
                );
              })}
            </View>
          </Card>
        </Animated.View>
      )}

      <Animated.View entering={entering(4)}>
        <Card padded={false}>
          <View style={{ padding: theme.layout.cardPadding, paddingBottom: 4 }}>
            <Text weight="medium" tracking="tight">
              {t('home.recent')}
            </Text>
          </View>
          <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingBottom: 8 }}>
            {recent.length === 0 ? (
              <Text color="textMuted" style={{ paddingVertical: 12 }}>
                {t('transactions.empty')}
              </Text>
            ) : (
              recent.map((tx) => {
                const meta = rowFor(tx.categoryId ?? '');
                return (
                  // A transaction added elsewhere slides this list down rather than snapping it.
                  <Animated.View
                    key={tx.id}
                    layout={reflowing}
                    entering={appearing}
                    exiting={leaving}
                  >
                    <ListRow
                      title={tx.description.length > 0 ? tx.description : meta.name}
                      subtitle={meta.name}
                      leading={<IconBox name={meta.icon} colour={meta.colour} />}
                      onPress={() =>
                        router.push({ pathname: '/transaction/[id]', params: { id: tx.id } })
                      }
                      trailing={
                        <AmountText
                          minor={tx.kind === 'income' ? tx.amount : -tx.amount}
                          currency={currency}
                          locale={locale}
                          signDisplay={tx.kind === 'income' ? 'always' : 'negative'}
                        />
                      }
                    />
                  </Animated.View>
                );
              })
            )}
          </View>
        </Card>
      </Animated.View>

      <DevTools />
      <BudgetAlertsGate views={views} />
    </Screen>
  );
}
