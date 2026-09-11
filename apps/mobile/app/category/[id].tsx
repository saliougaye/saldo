import {
  deltaPercent,
  isWithin,
  mean,
  median,
  periodHistory,
  previousPeriods,
  shiftPeriod,
  spendingByCategory,
} from '@saldo/core';
import { formatDayMonth, formatMoney, formatPeriodTick, formatSignedPercent } from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { AmountText } from '../../src/components/AmountText';
import { Card } from '../../src/components/Card';
import { IconBox, ListRow } from '../../src/components/ListRow';
import { Screen } from '../../src/components/Screen';
import { BackButton } from '../../src/components/ScreenHeader';
import { useCategories, useSettings, useTransactionsInRange } from '../../src/db/hooks';
import { usePeriod } from '../../src/features/period/PeriodProvider';
import { SpendHistoryChart } from '../../src/features/stats/SpendHistoryChart';
import { useAppLocale } from '../../src/i18n/useAppLocale';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

const HISTORY_CYCLES = 6;

/** §6.12 / §5.7. */
export default function CategoryDetail() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const { id } = useLocalSearchParams<{ id: string }>();
  const settings = useSettings();
  const categories = useCategories();
  const { today, def, period } = usePeriod();
  const currency = settings?.currency ?? 'EUR';

  const category = categories.find((row) => row.id === id);
  const children = categories.filter((row) => row.parentId === id);
  const parent = categories.find(
    (row) => category?.parentId !== null && row.id === category?.parentId,
  );
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
    previousPeriods(def, period.range, HISTORY_CYCLES).at(-1)?.start ?? period.range.start;
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
      cycles.push(shiftPeriod(def, period.range, -back));
    }
    return cycles.reverse().map((cycle) => {
      const amounts = spendingByCategory(rows, cycle, today);
      let spent = 0;
      for (const categoryId of ids) spent += amounts.get(categoryId) ?? 0;
      return {
        key: cycle.start,
        label: formatPeriodTick(cycle.start, def.kind, locale),
        amount: spent,
        current: cycle.start === period.range.start,
      };
    });
  }, [rows, period.range, def, today, ids, locale]);

  // "Media 6 cicli" of the design: the plain mean of the six columns, current cycle included.
  const average = useMemo(() => mean(bars.map((bar) => bar.amount)) ?? 0, [bars]);

  const pastMedian = useMemo(() => {
    const history = periodHistory(rows, def, period.range, HISTORY_CYCLES);
    return median(
      history.map((entry) => {
        const amounts = spendingByCategory(entry.txs, entry.period, today);
        let spent = 0;
        for (const categoryId of ids) spent += amounts.get(categoryId) ?? 0;
        return spent;
      }),
    );
  }, [rows, period.range, def, today, ids]);

  /**
   * The children, with what each one took of this period.
   *
   * Every live child is listed, not only the ones that spent. §5.4 says the breakdown appears
   * "only when ≥2 children have spend", which is the right rule for a *split* — one segment is not
   * a split — but this card is also the only way to reach a subcategory: Statistiche rolls it into
   * its parent, and Categorie names it without linking it. Under the old rule a parent with one
   * spending child hid that child everywhere, and the only route left to it was opening one of its
   * own transactions. An archived child that still spent in this period is kept, so the numbers
   * under the parent's total add up.
   */
  const childSpend = useMemo(() => {
    const amounts = spendingByCategory(rows, period.range, today);
    const direct = amounts.get(id ?? '') ?? 0;
    const listed = children
      .map((child) => ({ child, amount: amounts.get(child.id) ?? 0 }))
      .filter((entry) => entry.child.archivedAt === null || entry.amount > 0)
      .sort((a, b) => b.amount - a.amount);
    return { direct, listed };
  }, [rows, period.range, today, id, children]);

  if (category === undefined) {
    return (
      <Screen>
        <Text color="textMuted">{t('stats.empty')}</Text>
      </Screen>
    );
  }

  const delta = deltaPercent(total, pastMedian);

  // The chart, the icon and the tints all read from the category's own colour, so the bars say
  // *which* category they belong to and the design-system accent stays out of it.
  const colour = theme.categoryColor(category.colorIndex);

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <BackButton />
        <IconBox name={category.icon as IconName} colour={colour} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text size="headline" weight="semibold" tracking="tight" numberOfLines={1}>
            {category.name}
          </Text>
          {/*
            Where this category sits. Nothing else on a child's screen says it has a parent — you
            can land here from Statistiche or from a transaction — and "Panetteria" on its own is
            not the same thing as "Panetteria, inside Spesa". It leads there, because the parent is
            the number this one is a slice of.
          */}
          {parent === undefined ? null : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('categories.inParent', { name: parent.name })}
              hitSlop={6}
              onPress={() => router.push({ pathname: '/category/[id]', params: { id: parent.id } })}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Text size="caption" color="textMuted" numberOfLines={1}>
                {t('categories.inParent', { name: parent.name })}
              </Text>
            </Pressable>
          )}
        </View>
        {/*
          Without this the screen is a dead end: Categorie now leads here rather than straight into
          the form, the way an account row leads to the account, so the one thing you came to change
          has to be reachable from what you are looking at.
        */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('categories.editCategory')}
          hitSlop={10}
          onPress={() =>
            router.push({ pathname: '/category/edit/[id]', params: { id: category.id } })
          }
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Text size="footnote" color="accent">
            {t('common.edit')}
          </Text>
        </Pressable>
      </View>
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
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <Text weight="medium" tracking="tight">
            {t('stats.lastCycles')}
          </Text>
          {pastMedian === null ? null : (
            <Text size="caption" color="textFaint" tabular numberOfLines={1}>
              {t('stats.median', { amount: formatMoney(pastMedian, currency, locale) })}
            </Text>
          )}
        </View>
        <View style={{ marginTop: 18 }}>
          <SpendHistoryChart bars={bars} currency={currency} locale={locale} colour={colour} />
        </View>
        <View
          style={{
            marginTop: 16,
            paddingTop: 14,
            borderTopWidth: 1,
            borderTopColor: theme.palette.border,
            flexDirection: 'row',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <Text size="footnote" color="textMuted">
            {t('stats.average')}
          </Text>
          <Text tabular>{formatMoney(average, currency, locale)}</Text>
        </View>
      </Card>

      {childSpend.listed.length === 0 ? null : (
        <Card padded={false}>
          <View style={{ padding: theme.layout.cardPadding, paddingBottom: 4 }}>
            <Text weight="medium" tracking="tight">
              {t('stats.subcategories')}
            </Text>
          </View>
          <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingBottom: 8 }}>
            {childSpend.listed.map(({ child, amount }) => (
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
                // A subcategory is a category: it leads to its own screen, like every other row
                // that names one, and that is where it is edited.
                onPress={() =>
                  router.push({ pathname: '/category/[id]', params: { id: child.id } })
                }
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
