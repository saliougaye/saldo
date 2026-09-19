import { isUpcoming, previousPeriods, summarizePeriod } from '@saldo/core';
import { formatMoney } from '@saldo/i18n';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { AmountText, AnimatedAmount } from '../../src/components/AmountText';
import { Card } from '../../src/components/Card';
import { CardHeader } from '../../src/components/CardHeader';
import { IconBox, ListRow } from '../../src/components/ListRow';
import { ProgressBar } from '../../src/components/ProgressBar';
import { Screen } from '../../src/components/Screen';
import {
  useAccounts,
  useBudgets,
  useCategories,
  useSettings,
  useTransactionsInRange,
} from '../../src/db/hooks';
import { BudgetAlertsGate } from '../../src/features/budgets/BudgetAlertsGate';
import { HomeBudgetCard } from '../../src/features/budgets/HomeBudgetCard';
import { budgetViews } from '../../src/features/budgets/useBudgetProgress';
import { DevTools } from '../../src/features/home/DevTools';
import { PeriodHeader } from '../../src/features/period/PeriodHeader';
import { usePeriod } from '../../src/features/period/PeriodProvider';
import {
  type TransactionRowDeps,
  transactionRow,
} from '../../src/features/transactions/transactionRow';
import { useAppLocale } from '../../src/i18n/useAppLocale';
import { appearing, entering, leaving, reflowing } from '../../src/theme/motion';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/** §6.1: the card is a heads-up; the rest is one tap away in the transactions list. */
const UPCOMING_SHOWN = 5;

export default function HomeTab() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const settings = useSettings();
  const categories = useCategories();
  const accounts = useAccounts();
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
  // Capped like the recent list: this card says "something is coming", and past five rows it
  // stops saying that and starts being the transactions list. The header still counts them all,
  // so the cap never hides how many there are.
  const upcomingAll = useMemo(
    () => rows.filter((tx) => isUpcoming(tx, today) && tx.date <= period.range.end),
    [rows, today, period.range.end],
  );
  const upcoming = upcomingAll.slice(0, UPCOMING_SHOWN);
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

  // Home is not about one account, so a transfer here carries no sign: it moved nothing Home
  // measures. The shared presenter is also what stops a transfer rendering as "—" (it has no
  // category by contract, §4).
  const rowDeps = useMemo<TransactionRowDeps>(
    () => ({
      category: (id) => categoryById.get(id),
      accountName: (id) => accounts.find((account) => account.id === id)?.name ?? '',
      kindLabel: (kind) => t(`kinds.${kind}`),
      viewpointAccountId: null,
    }),
    [categoryById, accounts, t],
  );

  return (
    <Screen underTabBar refreshable>
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

      {upcomingAll.length === 0 ? null : (
        <Animated.View entering={entering(1)}>
          <Card padded={false}>
            <View style={{ padding: theme.layout.cardPadding, paddingBottom: 4 }}>
              <CardHeader
                title={t('home.upcoming')}
                status={t('home.upcomingCount', { count: upcomingAll.length })}
                onPress={() => router.push('/(tabs)/transactions')}
              />
            </View>
            <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingBottom: 8 }}>
              {upcoming.map((tx) => {
                const row = transactionRow(tx, rowDeps);
                return (
                  <ListRow
                    key={tx.id}
                    upcoming
                    title={row.title}
                    subtitle={row.subtitle}
                    leading={
                      <IconBox
                        name={row.icon}
                        colour={theme.categoryColor(row.colorIndex)}
                        badge={tx.recurrenceId === null ? undefined : 'repeat'}
                      />
                    }
                    onPress={() =>
                      router.push({ pathname: '/transaction/[id]', params: { id: tx.id } })
                    }
                    trailing={
                      <AmountText
                        minor={row.amount.minor}
                        currency={currency}
                        locale={locale}
                        signDisplay={row.amount.signDisplay}
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

      <Animated.View entering={entering(2)}>
        <HomeBudgetCard views={views} />
      </Animated.View>

      <Animated.View entering={entering(3)}>
        <Card padded={false}>
          <View style={{ padding: theme.layout.cardPadding, paddingBottom: 4 }}>
            <CardHeader
              title={t('home.recent')}
              status={t('home.allTransactions')}
              onPress={() => router.push('/(tabs)/transactions')}
            />
          </View>
          <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingBottom: 8 }}>
            {recent.length === 0 ? (
              <Text color="textMuted" style={{ paddingVertical: 12 }}>
                {t('transactions.empty')}
              </Text>
            ) : (
              recent.map((tx) => {
                const row = transactionRow(tx, rowDeps);
                return (
                  // A transaction added elsewhere slides this list down rather than snapping it.
                  <Animated.View
                    key={tx.id}
                    layout={reflowing}
                    entering={appearing}
                    exiting={leaving}
                  >
                    <ListRow
                      title={row.title}
                      subtitle={row.subtitle}
                      leading={
                        <IconBox
                          name={row.icon}
                          colour={theme.categoryColor(row.colorIndex)}
                          badge={tx.recurrenceId === null ? undefined : 'repeat'}
                        />
                      }
                      onPress={() =>
                        router.push({ pathname: '/transaction/[id]', params: { id: tx.id } })
                      }
                      trailing={
                        <AmountText
                          minor={row.amount.minor}
                          currency={currency}
                          locale={locale}
                          signDisplay={row.amount.signDisplay}
                          color={row.amount.muted ? 'textMuted' : undefined}
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
