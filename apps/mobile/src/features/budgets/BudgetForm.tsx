import {
  amountBufferToMinor,
  autoBudgetName,
  BUDGET_ALERT_THRESHOLDS,
  type Budget,
  categorySpendHistory,
  getCurrency,
  periodHistory,
  previousPeriods,
  suggestBudgetAmount,
  takenCategoryIds,
} from '@saldo/core';
import { formatMoney } from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { AmountInput } from '../../components/AmountInput';
import { PrimaryButton, SecondaryButton } from '../../components/Button';
import { Card } from '../../components/Card';
import { IconBox } from '../../components/ListRow';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Segmented } from '../../components/Segmented';
import { TextField } from '../../components/TextField';
import { useToast } from '../../components/Toast';
import { Toggle } from '../../components/Toggle';
import { useBudgets, useCategories, useSettings, useTransactionsInRange } from '../../db/hooks';
import { useAppLocale } from '../../i18n/useAppLocale';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';
import { usePeriod } from '../period/PeriodProvider';

const HISTORY_CYCLES = 6;
/** §6.18 footnote: the suggestion is the median plus this much headroom. */
const SUGGESTION_HEADROOM = 0.12;

export interface BudgetFormValues {
  buffer: string;
  categoryIds: string[];
  name: string;
  period: Budget['period'];
  alertThreshold: number | null;
  rollover: boolean;
}

export function emptyBudgetForm(): BudgetFormValues {
  return {
    buffer: '',
    categoryIds: [],
    name: '',
    period: 'period',
    alertThreshold: 90,
    rollover: false,
  };
}

export function budgetFormFrom(budget: Budget, minorDigits: 0 | 2 | 3): BudgetFormValues {
  return {
    buffer: (budget.amount / 10 ** minorDigits).toString(),
    categoryIds: [...budget.categoryIds],
    name: budget.name,
    period: budget.period,
    alertThreshold: budget.alertThreshold,
    rollover: budget.rollover,
  };
}

export interface BudgetFormProps {
  values: BudgetFormValues;
  onChange: (values: BudgetFormValues) => void;
  mode: 'new' | 'edit';
  /** Excluded from the "already taken" check when editing (§5.8). */
  editingBudgetId?: string;
  /** Receives the name to store: what was typed, or the auto name from the categories (§6.18). */
  onSubmit: (name: string) => void;
  onDelete?: () => void;
}

/** §6.18. Reused for edit. */
export function BudgetForm({
  values,
  onChange,
  mode,
  editingBudgetId,
  onSubmit,
  onDelete,
}: BudgetFormProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const toast = useToast();
  const settings = useSettings();
  const categories = useCategories();
  const budgets = useBudgets();
  const { today, def, period } = usePeriod();
  const currency = settings?.currency ?? 'EUR';
  const { minorDigits } = getCurrency(currency);

  const start =
    previousPeriods(def, period.range, HISTORY_CYCLES).at(-1)?.start ?? period.range.start;
  const rows = useTransactionsInRange(start, period.range.end);

  const taken = useMemo(
    () => takenCategoryIds(budgets, categories, editingBudgetId ?? null),
    [budgets, categories, editingBudgetId],
  );

  const suggestion = useMemo(() => {
    const history = categorySpendHistory(
      periodHistory(rows, def, period.range, HISTORY_CYCLES),
      categories,
      today,
    );
    const value = suggestBudgetAmount(history, values.categoryIds, categories);
    return value === null ? null : Math.round(value * (1 + SUGGESTION_HEADROOM));
  }, [rows, period.range, def, categories, today, values.categoryIds]);

  const expense = categories.filter(
    (category) =>
      category.direction === 'expense' &&
      category.parentId === null &&
      category.archivedAt === null,
  );

  const autoName = autoBudgetName(
    values.categoryIds
      .map((id) => categories.find((category) => category.id === id)?.name)
      .filter((name): name is string => name !== undefined),
    t('common.and'),
  );
  const set = (patch: Partial<BudgetFormValues>) => onChange({ ...values, ...patch });
  const amount = amountBufferToMinor(values.buffer, minorDigits);
  const ready = amount > 0 && values.categoryIds.length > 0;

  return (
    <Screen
      footer={
        <View style={{ gap: 8 }}>
          <PrimaryButton
            label={mode === 'new' ? t('budgets.create') : t('common.save')}
            disabled={!ready}
            onPress={() => onSubmit(values.name.trim().length > 0 ? values.name.trim() : autoName)}
          />
          {onDelete === undefined ? null : (
            <SecondaryButton label={t('budgets.deleteBudget')} onPress={onDelete} />
          )}
        </View>
      }
    >
      <ScreenHeader title={mode === 'new' ? t('budgets.newBudget') : t('budgets.editBudget')} />

      <Card>
        <Text size="footnote" color="textMuted">
          {t('budgets.amount')}
        </Text>
        <View style={{ marginTop: 6 }}>
          <AmountInput
            buffer={values.buffer}
            onChange={(buffer) => set({ buffer })}
            currency={currency}
            locale={locale}
            autoFocus={mode === 'new'}
            doneLabel={t('common.done')}
          />
        </View>
        {suggestion === null ? null : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
            <Text size="footnote" color="textMuted" style={{ flex: 1 }}>
              {t('budgets.medianHint', { amount: formatMoney(suggestion, currency, locale) })}
            </Text>
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => set({ buffer: (suggestion / 10 ** minorDigits).toString() })}
            >
              <Text color="accent" weight="medium">
                {t('budgets.useMedian')}
              </Text>
            </Pressable>
          </View>
        )}
        <Text size="caption" color="textFaint" style={{ marginTop: 4 }}>
          {t('budgets.footnote')}
        </Text>
      </Card>

      <Card>
        <Text size="footnote" color="textMuted">
          {t('budgets.categories')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {expense.map((category) => {
            const selected = values.categoryIds.includes(category.id);
            const isTaken = taken.has(category.id) && !selected;
            const colour = theme.categoryColor(category.colorIndex);
            return (
              <Pressable
                key={category.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected, disabled: isTaken }}
                onPress={() => {
                  if (isTaken) {
                    toast.show(t('budgets.taken', { name: category.name }));
                    return;
                  }
                  set({
                    categoryIds: selected
                      ? values.categoryIds.filter((id) => id !== category.id)
                      : [...values.categoryIds, category.id],
                  });
                }}
                style={{
                  width: '47%',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  padding: 10,
                  borderRadius: theme.radii.input,
                  borderWidth: 1,
                  borderColor: selected ? theme.palette.borderStrong : 'transparent',
                  backgroundColor: selected ? theme.tint(colour, 0.14) : theme.palette.raised,
                  opacity: isTaken ? 0.4 : 1,
                }}
              >
                <IconBox name={category.icon as IconName} colour={colour} small />
                <Text size="footnote" numberOfLines={1} style={{ flex: 1 }}>
                  {category.name}
                </Text>
                {isTaken ? (
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: theme.palette.textFaint,
                    }}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <View style={{ gap: 14 }}>
          <TextField
            label={t('budgets.name')}
            placeholder={autoName}
            value={values.name}
            onChangeText={(name) => set({ name })}
          />
          <View style={{ gap: 6 }}>
            <Text size="footnote" color="textMuted">
              {t('budgets.repeats')}
            </Text>
            <Segmented
              accessibilityLabel={t('budgets.repeats')}
              options={[
                { value: 'period', label: t('budgets.periodCycle') },
                { value: 'week', label: t('budgets.periodWeek') },
                { value: 'year', label: t('budgets.periodYear') },
              ]}
              value={values.period}
              onChange={(value) => set({ period: value })}
            />
          </View>
          <View style={{ gap: 6 }}>
            <Text size="footnote" color="textMuted">
              {t('budgets.alertAt')}
            </Text>
            <Segmented
              accessibilityLabel={t('budgets.alertAt')}
              options={[
                { value: 'never', label: t('budgets.alertNever') },
                ...BUDGET_ALERT_THRESHOLDS.map((value) => ({
                  value: String(value),
                  label: `${value}%`,
                })),
              ]}
              value={values.alertThreshold === null ? 'never' : String(values.alertThreshold)}
              onChange={(value) =>
                set({ alertThreshold: value === 'never' ? null : Number(value) })
              }
            />
            <Text size="caption" color="textFaint">
              {t('budgets.alertNote')}
            </Text>
          </View>
          {values.period === 'period' ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text>{t('budgets.rollover')}</Text>
              <Toggle
                value={values.rollover}
                onChange={(rollover) => set({ rollover })}
                accessibilityLabel={t('budgets.rollover')}
              />
            </View>
          ) : null}
        </View>
      </Card>
    </Screen>
  );
}
