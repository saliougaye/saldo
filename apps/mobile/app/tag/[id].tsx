import { rollupToParents, spendingByCategory, tagTotals, transactionRow } from '@saldo/core';
import { formatDayMonth } from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AmountText } from '../../src/components/AmountText';
import { Card } from '../../src/components/Card';
import { DetailSkeleton } from '../../src/components/DetailSkeleton';
import { IconBox, ListRow } from '../../src/components/ListRow';
import { NotFoundScreen } from '../../src/components/NotFoundScreen';
import { Screen } from '../../src/components/Screen';
import { HeaderIconButton, ScreenHeader } from '../../src/components/ScreenHeader';
import { useDelayed } from '../../src/components/useDelayed';
import {
  useAccounts,
  useCategories,
  useSettings,
  useTagsQuery,
  useTransactionsInRangeQuery,
} from '../../src/db/hooks';
import { useHiddenMoney } from '../../src/features/hidden/hiddenAmounts';
import { usePeriod } from '../../src/features/period/PeriodProvider';
import { SplitBar } from '../../src/features/stats/SplitBar';
import { DeleteTagSheet } from '../../src/features/tags/DeleteTagSheet';
import { MergeTagSheet } from '../../src/features/tags/MergeTagSheet';
import { TagEditSheet } from '../../src/features/tags/TagEditSheet';
import { useAppLocale } from '../../src/i18n/useAppLocale';
import { useLeaveGone } from '../../src/navigation/leave';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/** Where the tag view's rows start: a tag spans every date. */
const ALL_DATES_START = '1970-01-01';

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
  const { rows: tags, loaded: entityLoaded } = useTagsQuery();
  const categories = useCategories();
  const accounts = useAccounts();
  const { today } = usePeriod();
  const currency = settings?.currency ?? 'EUR';
  const [sheet, setSheet] = useState<'edit' | 'merge' | 'delete' | null>(null);
  // "Elimina tag" in the edit sheet: its confirmation opens once the edit sheet is gone, since iOS
  // drops a modal presented while another is still dismissing.
  const [deletePending, setDeletePending] = useState(false);

  const { rows, loaded: rowsLoaded } = useTransactionsInRangeQuery(ALL_DATES_START, today);
  // The figures sum these rows: before they land, a total would paint as 0.
  const loaded = entityLoaded && rowsLoaded;
  const slow = useDelayed(!loaded);
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

  if (!loaded) return <DetailSkeleton show={slow} />;
  if (tag === undefined) {
    return <NotFoundScreen />;
  }

  // Counted rows only, like the category split below: the two have to agree (§5.10). Spend and
  // income stay apart — the category split can only split expenses, and a tag used for two
  // unrelated things would net them against each other.
  const totals = tagTotals(tagged, { start: ALL_DATES_START, end: today }, today).tags.find(
    (row) => row.tagId === id,
  ) ?? { expense: 0, income: 0 };

  return (
    <Screen refreshable>
      <ScreenHeader
        title={tag.name}
        trailing={
          // In the header, not in the body: a card of controls above the total pushed the figures
          // the screen is for halfway down, for actions taken a handful of times in a tag's life.
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {/* Merging needs somewhere to go: with one tag there is nothing to merge into. */}
            {tags.length < 2 ? null : (
              <HeaderIconButton
                icon="merge"
                label={t('tags.mergeInto')}
                onPress={() => setSheet('merge')}
              />
            )}
            <HeaderIconButton
              icon="pencil"
              label={t('tags.editTag')}
              onPress={() => setSheet('edit')}
            />
          </View>
        }
      />
      <View style={{ flexDirection: 'row', gap: 16 }}>
        <View style={{ flex: 1 }}>
          <Text size="footnote" color="textMuted">
            {t('tags.total')}
          </Text>
          <AmountText
            minor={totals.expense}
            currency={currency}
            locale={locale}
            size="amountLg"
            weight="semibold"
            tracking="tightest"
          />
        </View>
        {/* The refund on a trip, the reimbursement being chased: the rows the list below already
            shows, which the figure beside them used to ignore. */}
        <View style={{ flex: 1 }}>
          <Text size="footnote" color="textMuted">
            {t('tags.totalIncome')}
          </Text>
          <AmountText
            minor={totals.income}
            currency={currency}
            locale={locale}
            size="amountLg"
            weight="semibold"
            tracking="tightest"
            color={totals.income > 0 ? 'positive' : undefined}
          />
        </View>
      </View>
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
        {t('tags.totals', {
          expense: money(totals.expense, currency, locale),
          income: money(totals.income, currency, locale),
        })}
      </Text>

      <TagEditSheet
        visible={sheet === 'edit'}
        tag={tag}
        onClose={() => setSheet(null)}
        onDelete={() => {
          setDeletePending(true);
          setSheet(null);
        }}
        onDismissed={() => {
          if (!deletePending) return;
          setDeletePending(false);
          setSheet('delete');
        }}
      />
      <DeleteTagSheet
        visible={sheet === 'delete'}
        tag={tag}
        uses={tagged.length}
        onClose={() => setSheet(null)}
        onDeleted={() => leaveGone({ kind: 'tag', ids: [tag.id] })}
      />
      <MergeTagSheet
        visible={sheet === 'merge'}
        tag={tag}
        uses={tagged.length}
        onClose={() => setSheet(null)}
        onMerged={() => leaveGone({ kind: 'tag', ids: [tag.id] })}
      />
    </Screen>
  );
}
