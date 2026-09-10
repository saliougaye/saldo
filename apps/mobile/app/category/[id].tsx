import {
  cycleHistory,
  deltaPercent,
  isWithin,
  median,
  previousCycles,
  shiftCycle,
  spendingByCategory,
} from '@saldo/core';
import { formatDayMonth, formatMoney, formatSignedPercent } from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AmountText } from '../../src/components/AmountText';
import { Card } from '../../src/components/Card';
import { IconBox, ListRow } from '../../src/components/ListRow';
import { Screen } from '../../src/components/Screen';
import { useCategories, useSettings, useTransactionsInRange } from '../../src/db/hooks';
import { usePeriod } from '../../src/features/period/PeriodProvider';
import { CashflowChart } from '../../src/features/stats/CashflowChart';
import { useAppLocale } from '../../src/i18n/useAppLocale';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

const HISTORY_CYCLES = 6;
/** §5.4: the children breakdown only appears when at least two of them have spend. */
const MIN_CHILDREN_WITH_SPEND = 2;

/** §6.12 / §5.7. */
export default function CategoryDetail() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const { id } = useLocalSearchParams<{ id: string }>();
  const settings = useSettings();
  const categories = useCategories();
  const { today, cycleStartDay, period } = usePeriod();
  const currency = settings?.currency ?? 'EUR';

  const category = categories.find((row) => row.id === id);
  const children = categories.filter((row) => row.parentId === id);
  const ids = useMemo(
    () =>
      new Set(
        [id, ...children.map((child) => child.id)].filter(
          (value): value is string => value !== undefined,
        ),
      ),
    [id, children],
  );

  const historyStart =
    previousCycles(period.range, cycleStartDay, HISTORY_CYCLES).at(-1)?.start ?? period.range.start;
  const rows = useTransactionsInRange(historyStart, period.range.end);

  const inRange = useMemo(
    () =>
      rows.filter(
        (tx) =>
          tx.categoryId !== null &&
          ids.has(tx.categoryId) &&
          isWithin(period.range, tx.date) &&
          tx.date <= today,
      ),
    [rows, ids, period.range, today],
  );
  const total = inRange.reduce((sum, tx) => sum + tx.amount, 0);

  const bars = useMemo(() => {
    const cycles = [period.range];
    for (let back = 1; back < HISTORY_CYCLES; back += 1) {
      cycles.push(shiftCycle(period.range, cycleStartDay, -back));
    }
    return cycles.reverse().map((cycle) => {
      const amounts = spendingByCategory(rows, cycle, today);
      let spent = 0;
      for (const categoryId of ids) spent += amounts.get(categoryId) ?? 0;
      return {
        key: cycle.start,
        label: formatDayMonth(cycle.start, locale),
        income: 0,
        expenses: spent,
        current: cycle.start === period.range.start,
      };
    });
  }, [rows, period.range, cycleStartDay, today, ids, locale]);

  const pastMedian = useMemo(() => {
    const history = cycleHistory(rows, period.range, cycleStartDay, HISTORY_CYCLES);
    return median(
      history.map((entry) => {
        const amounts = spendingByCategory(entry.txs, entry.cycle, today);
        let spent = 0;
        for (const categoryId of ids) spent += amounts.get(categoryId) ?? 0;
        return spent;
      }),
    );
  }, [rows, period.range, cycleStartDay, today, ids]);

  const childSpend = useMemo(() => {
    const amounts = spendingByCategory(rows, period.range, today);
    const direct = amounts.get(id ?? '') ?? 0;
    const withSpend = children
      .map((child) => ({ child, amount: amounts.get(child.id) ?? 0 }))
      .filter((entry) => entry.amount > 0);
    return { direct, withSpend };
  }, [rows, period.range, today, id, children]);

  if (category === undefined) {
    return (
      <Screen>
        <Text color="textMuted">{t('stats.empty')}</Text>
      </Screen>
    );
  }

  const delta = deltaPercent(total, pastMedian);

  return (
    <Screen>
      <Text size="headline" weight="semibold" tracking="tight">
        {category.name}
      </Text>
      <AmountText
        minor={total}
        currency={currency}
        locale={locale}
        size="hero"
        weight="semibold"
        tracking="tightest"
      />
      <Text color="textMuted">
        {delta === null ? t('stats.newLabel') : formatSignedPercent(delta)}
      </Text>

      <Card>
        <Text weight="medium" tracking="tight">
          {t('stats.lastCycles')}
        </Text>
        <View style={{ marginTop: 12 }}>
          <CashflowChart bars={bars} />
        </View>
        {pastMedian === null ? null : (
          <Text size="footnote" color="textMuted" style={{ marginTop: 8 }}>
            {t('stats.median', { amount: formatMoney(pastMedian, currency, locale) })}
          </Text>
        )}
      </Card>

      {childSpend.withSpend.length < MIN_CHILDREN_WITH_SPEND ? null : (
        <Card padded={false}>
          <View style={{ padding: theme.layout.cardPadding, paddingBottom: 4 }}>
            <Text weight="medium" tracking="tight">
              {t('stats.subcategories')}
            </Text>
          </View>
          <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingBottom: 8 }}>
            {childSpend.withSpend.map(({ child, amount }) => (
              <ListRow
                key={child.id}
                title={child.name}
                leading={
                  <IconBox
                    name={child.icon as IconName}
                    colour={theme.categoryColor(child.colorIndex)}
                  />
                }
                trailing={<AmountText minor={amount} currency={currency} locale={locale} />}
              />
            ))}
            {childSpend.direct === 0 ? null : (
              <ListRow
                title={t('stats.noSubcategory')}
                trailing={
                  <AmountText minor={childSpend.direct} currency={currency} locale={locale} />
                }
              />
            )}
          </View>
        </Card>
      )}

      <Card padded={false}>
        <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 8 }}>
          {[...inRange]
            .sort((a, b) => b.amount - a.amount)
            .map((tx) => (
              <ListRow
                key={tx.id}
                title={tx.description.length > 0 ? tx.description : category.name}
                subtitle={formatDayMonth(tx.date, locale)}
                onPress={() =>
                  router.push({ pathname: '/transaction/[id]', params: { id: tx.id } })
                }
                trailing={<AmountText minor={-tx.amount} currency={currency} locale={locale} />}
              />
            ))}
        </View>
      </Card>
    </Screen>
  );
}
