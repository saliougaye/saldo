import { previousPeriods } from '@saldo/core';
import type { IconName } from '@saldo/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { AmountText } from '../src/components/AmountText';
import { Card } from '../src/components/Card';
import { EmptyState } from '../src/components/EmptyState';
import { IconBox } from '../src/components/ListRow';
import { ProgressBar } from '../src/components/ProgressBar';
import { Screen } from '../src/components/Screen';
import { BackButton } from '../src/components/ScreenHeader';
import { useDelayed } from '../src/components/useDelayed';
import {
  useBudgetsQuery,
  useCategories,
  useSettings,
  useTransactionsInRangeQuery,
} from '../src/db/hooks';
import { BudgetDetailSheet } from '../src/features/budgets/BudgetDetailSheet';
import { BudgetsSkeleton } from '../src/features/budgets/BudgetsSkeleton';
import { budgetViews } from '../src/features/budgets/useBudgetProgress';
import { useHiddenMoney } from '../src/features/hidden/hiddenAmounts';
import { usePeriod } from '../src/features/period/PeriodProvider';
import { useAppLocale } from '../src/i18n/useAppLocale';
import { Text } from '../src/theme/Text';
import { useTheme } from '../src/theme/ThemeProvider';

/** The carry of a rollover budget can reach back this far (§5.8). */
const CARRY_LOOKBACK = 12;

/** §6.4. */
export default function BudgetsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { format: money } = useHiddenMoney();
  const locale = useAppLocale();
  const settings = useSettings();
  const { rows: budgets, loaded: budgetsLoaded } = useBudgetsQuery();
  const categories = useCategories();
  const { today, def, period } = usePeriod();
  const currency = settings?.currency ?? 'EUR';
  // Home's target card opens a budget here (§5.13): the detail sheet belongs to this screen.
  const { open } = useLocalSearchParams<{ open?: string }>();
  const [openId, setOpenId] = useState<string | null>(open ?? null);

  const start =
    previousPeriods(def, period.range, CARRY_LOOKBACK).at(-1)?.start ?? period.range.start;
  const { rows, loaded: rowsLoaded } = useTransactionsInRangeQuery(start, period.range.end);
  // A budget's spent sums these rows: before they land, every card would read 0.
  const loaded = budgetsLoaded && rowsLoaded;
  const slow = useDelayed(!loaded);

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

  return (
    <Screen refreshable>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <BackButton />
        <Text size="display" weight="semibold" tracking="tighter" style={{ flex: 1 }}>
          {t('budgets.title')}
        </Text>
        {/* Where Categorie and Conti keep theirs. The empty state below carries its own
            "Nuovo budget", where it is the only thing to do on the screen. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('budgets.newBudget')}
          hitSlop={10}
          onPress={() => router.push('/budget/new')}
        >
          <IconBox name="plus" colour={theme.palette.textMuted} small />
        </Pressable>
      </View>

      {!loaded ? (
        // Never the empty state before the query answers: an existing budget list would open on
        // it and collapse a frame later.
        slow ? (
          <BudgetsSkeleton />
        ) : null
      ) : views.length === 0 ? (
        <EmptyState
          kind="yet"
          ghost="bar"
          title={t('budgets.empty')}
          body={t('budgets.emptyBody')}
          action={{ label: t('budgets.newBudget'), onPress: () => router.push('/budget/new') }}
        />
      ) : (
        views.map((view) => {
          const category = categories.find((row) => row.id === view.budget.categoryIds[0]);
          return (
            <Pressable
              key={view.budget.id}
              accessibilityRole="button"
              onPress={() => setOpenId(view.budget.id)}
            >
              <Card>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <IconBox
                    name={view.budget.icon as IconName}
                    colour={theme.categoryColor(category?.colorIndex ?? 9)}
                  />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text weight="medium" numberOfLines={1}>
                      {view.budget.name}
                    </Text>
                    <Text size="caption" color="textMuted">
                      {view.open
                        ? t('budgets.daysLeft', { count: view.daysLeft })
                        : t('budgets.closed')}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <AmountText
                      align="end"
                      minor={view.spent}
                      currency={currency}
                      locale={locale}
                      weight="medium"
                      color={view.overLimit ? 'accent' : 'text'}
                    />
                    <Text size="caption" color="textMuted">
                      {t('budgets.ofLimit', {
                        amount: money(view.limitWithCarry, currency, locale),
                      })}
                    </Text>
                  </View>
                </View>
                <View style={{ marginTop: 12 }}>
                  <ProgressBar
                    ratio={view.ratio}
                    pace={view.open ? view.pace : undefined}
                    overPace={view.overPace}
                  />
                </View>
              </Card>
            </Pressable>
          );
        })
      )}

      <BudgetDetailSheet
        visible={openId !== null}
        onClose={() => setOpenId(null)}
        view={views.find((view) => view.budget.id === openId) ?? null}
      />
    </Screen>
  );
}
