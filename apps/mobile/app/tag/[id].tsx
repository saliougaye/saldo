import { rollupToParents, spendingByCategory } from '@saldo/core';
import { formatDayMonth } from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AmountText } from '../../src/components/AmountText';
import { Card } from '../../src/components/Card';
import { IconBox, ListRow } from '../../src/components/ListRow';
import { NotFoundScreen } from '../../src/components/NotFoundScreen';
import { Screen } from '../../src/components/Screen';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import {
  useAccounts,
  useCategories,
  useSettings,
  useTagsQuery,
  useTransactionsInRange,
} from '../../src/db/hooks';
import { useHiddenMoney } from '../../src/features/hidden/hiddenAmounts';
import { usePeriod } from '../../src/features/period/PeriodProvider';
import { SplitBar } from '../../src/features/stats/SplitBar';
import { TagEditCard } from '../../src/features/tags/TagEditCard';
import { transactionRow } from '../../src/features/transactions/transactionRow';
import { useAppLocale } from '../../src/i18n/useAppLocale';
import { useLeaveGone } from '../../src/navigation/leave';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/** §6.11 / §5.10. A tag spans every date, so the period selector does not apply here. */
export default function TagView() {
  const theme = useTheme();
  const router = useRouter();
  const leaveGone = useLeaveGone();
  const { t } = useTranslation();
  const { format: money } = useHiddenMoney();
  const locale = useAppLocale();
  const { id } = useLocalSearchParams<{ id: string }>();
  const settings = useSettings();
  const { rows: tags, loaded } = useTagsQuery();
  const categories = useCategories();
  const accounts = useAccounts();
  const { today } = usePeriod();
  const currency = settings?.currency ?? 'EUR';

  const rows = useTransactionsInRange('1970-01-01', today);
  const tag = tags.find((candidate) => candidate.id === id);

  const tagged = useMemo(
    () =>
      rows
        .filter((tx) => id !== undefined && tx.tagIds.includes(id))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [rows, id],
  );

  const split = useMemo(() => {
    if (tagged.length === 0) return [];
    const range = {
      start: tagged[0]?.date ?? today,
      end: tagged[tagged.length - 1]?.date ?? today,
    };
    const amounts = rollupToParents(spendingByCategory(tagged, range, today), categories);
    return [...amounts.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([categoryId, amount]) => {
        const category = categories.find((candidate) => candidate.id === categoryId);
        return {
          id: categoryId,
          amount,
          name: category?.name ?? '—',
          icon: (category?.icon ?? 'tag') as IconName,
          colour: theme.categoryColor(category?.colorIndex ?? 9),
        };
      });
  }, [tagged, categories, today, theme]);

  if (!loaded) return null;
  if (tag === undefined) {
    return <NotFoundScreen />;
  }

  const total = tagged
    .filter((tx) => tx.kind === 'expense')
    .reduce((sum, tx) => sum + tx.amount, 0);

  return (
    <Screen refreshable>
      <ScreenHeader title={tag.name} />
      {/* First, under the header: at the bottom it sat past every transaction the tag carries,
          and a tag with a long history made rename, merge and delete a scroll away. */}
      <TagEditCard tag={tag} onDeleted={() => leaveGone({ kind: 'tag', ids: [tag.id] })} />
      <Text size="footnote" color="textMuted">
        {t('tags.total')}
      </Text>
      <AmountText
        minor={total}
        currency={currency}
        locale={locale}
        size="hero"
        weight="semibold"
        tracking="tightest"
      />
      {/* Statistics reaches this screen from a card that is scoped to one cycle; this total is not.
          Saying so is what keeps the two numbers from reading as a contradiction (§5.10). */}
      <Text size="footnote" color="textFaint">
        {t('tags.allDates')}
      </Text>
      {tagged.length === 0 ? null : (
        <Text color="textMuted">
          {t('tags.range', {
            count: tagged.length,
            first: formatDayMonth(tagged[0]?.date ?? today, locale),
            last: formatDayMonth(tagged[tagged.length - 1]?.date ?? today, locale),
          })}
        </Text>
      )}

      {split.length === 0 ? null : (
        <Card>
          <SplitBar
            segments={split.map((row) => ({ key: row.id, amount: row.amount, colour: row.colour }))}
          />
          <View style={{ marginTop: 6 }}>
            {split.map((row) => (
              <ListRow
                key={row.id}
                title={row.name}
                leading={<IconBox name={row.icon} colour={row.colour} />}
                trailing={
                  <AmountText minor={row.amount} currency={currency} locale={locale} align="end" />
                }
              />
            ))}
          </View>
        </Card>
      )}

      <Card padded={false}>
        <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 8 }}>
          {tagged.map((tx) => {
            // A tag is not an account, so a transfer listed here carries no sign: it moved money
            // between the user's own accounts and this screen totals neither of them.
            const rowMeta = transactionRow(tx, {
              category: () => undefined,
              accountName: (accountId) =>
                accounts.find((account) => account.id === accountId)?.name ?? '',
              kindLabel: (kind) => t(`kinds.${kind}`),
              viewpointAccountId: null,
            });
            return (
              <ListRow
                key={tx.id}
                title={rowMeta.title}
                subtitle={formatDayMonth(tx.date, locale)}
                onPress={() =>
                  router.push({ pathname: '/transaction/[id]', params: { id: tx.id } })
                }
                trailing={
                  <AmountText
                    plain
                    align="end"
                    minor={rowMeta.amount.minor}
                    currency={currency}
                    locale={locale}
                    signDisplay={rowMeta.amount.signDisplay}
                    color={rowMeta.amount.muted ? 'textMuted' : undefined}
                  />
                }
              />
            );
          })}
        </View>
      </Card>

      <Text size="caption" color="textFaint">
        {money(total, currency, locale)}
      </Text>
    </Screen>
  );
}
