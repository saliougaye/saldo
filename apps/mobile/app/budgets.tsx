import { previousPeriods } from '@saldo/core';
import { formatMoney } from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { AmountText } from '../src/components/AmountText';
import { Card } from '../src/components/Card';
import { IconBox } from '../src/components/ListRow';
import { ProgressBar } from '../src/components/ProgressBar';
import { Screen } from '../src/components/Screen';
import { BackButton } from '../src/components/ScreenHeader';
import { useBudgets, useCategories, useSettings, useTransactionsInRange } from '../src/db/hooks';
import { BudgetDetailSheet } from '../src/features/budgets/BudgetDetailSheet';
import { budgetViews } from '../src/features/budgets/useBudgetProgress';
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
  const locale = useAppLocale();
  const settings = useSettings();
  const budgets = useBudgets();
  const categories = useCategories();
  const { today, def, period } = usePeriod();
  const currency = settings?.currency ?? 'EUR';
  const [openId, setOpenId] = useState<string | null>(null);

  const start =
    previousPeriods(def, period.range, CARRY_LOOKBACK).at(-1)?.start ?? period.range.start;
  const rows = useTransactionsInRange(start, period.range.end);

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
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <BackButton />
        <Text size="display" weight="semibold" tracking="tighter" style={{ flex: 1 }}>
          {t('budgets.title')}
        </Text>
        {/* Where Categorie and Conti keep theirs. The dashed card below stays for the empty
            state, where it is the only thing to do on the screen rather than a second "+". */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('budgets.newBudget')}
          hitSlop={10}
          onPress={() => router.push('/budget/new')}
        >
          <IconBox name="plus" colour={theme.palette.textMuted} small />
        </Pressable>
      </View>

      {views.length === 0 ? (
        <>
          <Card>
            <Text color="textMuted">{t('budgets.empty')}</Text>
          </Card>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/budget/new')}
            style={({ pressed }) => ({
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: theme.palette.borderStrong,
              borderRadius: theme.radii.card,
              paddingVertical: 18,
              alignItems: 'center',
              transform: [{ scale: pressed ? 0.96 : 1 }],
            })}
          >
            <Text color="textMuted">{t('budgets.newBudget')}</Text>
          </Pressable>
        </>
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
                      minor={view.spent}
                      currency={currency}
                      locale={locale}
                      weight="medium"
                      color={view.overLimit ? 'accent' : 'text'}
                    />
                    <Text size="caption" color="textMuted">
                      {t('budgets.ofLimit', {
                        amount: formatMoney(view.limitWithCarry, currency, locale),
                      })}
                    </Text>
                  </View>
                </View>
                <View style={{ marginTop: 12 }}>
                  <ProgressBar
                    ratio={view.ratio}
                    pace={view.open ? view.spent / Math.max(1, view.limitWithCarry) : undefined}
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
