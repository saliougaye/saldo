import {
  EMPTY_FILTERS,
  type FilterLookup,
  filterTransactions,
  groupByDay,
  hasActiveFilters,
  type TransactionFilters,
} from '@saldo/core';
import { formatDayMonth, formatMoney } from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { AmountText } from '../../src/components/AmountText';
import { SecondaryButton } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Chip } from '../../src/components/Chip';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { IconBox, ListRow } from '../../src/components/ListRow';
import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { useToast } from '../../src/components/Toast';
import { useRepositories } from '../../src/db/DatabaseProvider';
import {
  useAccounts,
  useCategories,
  useSettings,
  useTags,
  useTransactionsInRangeQuery,
} from '../../src/db/hooks';
import { PeriodHeader } from '../../src/features/period/PeriodHeader';
import { usePeriod } from '../../src/features/period/PeriodProvider';
import { SwipeRow } from '../../src/features/transactions/SwipeRow';
import { TagFilterSheet } from '../../src/features/transactions/TagFilterSheet';
import { useAppLocale } from '../../src/i18n/useAppLocale';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function TransactionsTab() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const repos = useRepositories();
  const toast = useToast();
  const settings = useSettings();
  const accounts = useAccounts();
  const categories = useCategories();
  const tags = useTags();
  const { today, period } = usePeriod();
  const currency = settings?.currency ?? 'EUR';

  const [filters, setFilters] = useState<TransactionFilters>(EMPTY_FILTERS);
  const [tagSheetOpen, setTagSheetOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  const { rows, loaded } = useTransactionsInRangeQuery(period.range.start, period.range.end);

  const lookup = useMemo<FilterLookup>(() => {
    const accountNames = new Map(accounts.map((account) => [account.id, account.name]));
    const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
    const parents = new Map(categories.map((category) => [category.id, category.parentId]));
    return {
      accountName: (id) => accountNames.get(id) ?? '',
      categoryName: (id) => categoryNames.get(id) ?? '',
      categoryParentId: (id) => parents.get(id) ?? null,
    };
  }, [accounts, categories]);

  const groups = useMemo(
    () => groupByDay(filterTransactions(rows, filters, lookup)),
    [rows, filters, lookup],
  );

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  const set = (patch: Partial<TransactionFilters>) => setFilters({ ...filters, ...patch });
  const active = hasActiveFilters(filters);

  const confirmDelete = () => {
    if (pendingDelete === null) return;
    const { id, name } = pendingDelete;
    repos.transactions.remove(id);
    setPendingDelete(null);
    toast.show(t('transactions.deleted', { name }), {
      label: t('common.undo'),
      onPress: () => repos.transactions.restore(id),
    });
  };

  return (
    <Screen scroll={false} underTabBar>
      <PeriodHeader />
      <TextField
        label={t('transactions.searchPlaceholder')}
        placeholder={t('transactions.searchPlaceholder')}
        value={filters.query}
        onChangeText={(query) => set({ query })}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // A horizontal ScrollView in a flex column would otherwise stretch and clip its chips,
        // and the negative margin lets them scroll edge to edge under the screen padding.
        style={{ flexGrow: 0, flexShrink: 0, marginHorizontal: -theme.layout.screenPaddingX }}
        contentContainerStyle={{
          gap: 6,
          paddingHorizontal: theme.layout.screenPaddingX,
          paddingVertical: 2,
        }}
      >
        <Chip
          label={t('transactions.onlyExpenses')}
          active={filters.direction === 'expense'}
          onPress={() => set({ direction: filters.direction === 'expense' ? 'all' : 'expense' })}
        />
        <Chip
          label={t('transactions.onlyIncome')}
          active={filters.direction === 'income'}
          onPress={() => set({ direction: filters.direction === 'income' ? 'all' : 'income' })}
        />
        <Chip
          label={t('transactions.tags')}
          active={filters.tagIds.length > 0}
          chevron
          onPress={() => setTagSheetOpen(true)}
        />
        <Chip
          label={t('transactions.onlyExcluded')}
          active={filters.onlyExcluded}
          onPress={() => set({ onlyExcluded: !filters.onlyExcluded })}
        />
      </ScrollView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
        keyboardDismissMode="on-drag"
      >
        {!loaded ? (
          <Card>
            <View
              accessibilityRole="progressbar"
              accessibilityLabel={t('common.loading')}
              style={{ paddingVertical: 12, alignItems: 'center' }}
            >
              <ActivityIndicator color={theme.palette.textMuted} />
            </View>
          </Card>
        ) : groups.length === 0 ? (
          <Card>
            <Text color="textMuted">
              {active ? t('transactions.noResults') : t('transactions.empty')}
            </Text>
            <View style={{ marginTop: 12 }}>
              <SecondaryButton
                label={active ? t('transactions.resetFilters') : t('transactions.newTransaction')}
                onPress={() =>
                  active ? setFilters(EMPTY_FILTERS) : router.push('/transaction/new')
                }
              />
            </View>
          </Card>
        ) : (
          groups.map((group) => (
            <Card key={group.date} padded={false}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  padding: theme.layout.cardPadding,
                  paddingBottom: 4,
                }}
              >
                <Text size="footnote" color="textMuted">
                  {formatDayMonth(group.date, locale)}
                </Text>
                <Text size="footnote" color="textMuted" tabular>
                  {formatMoney(group.expenseTotal, currency, locale)}
                </Text>
              </View>
              <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingBottom: 8 }}>
                {group.items.map((tx) => {
                  const category = categoryById.get(tx.categoryId ?? '');
                  const colour = theme.categoryColor(category?.colorIndex ?? 9);
                  const name = category?.name ?? t(`kinds.${tx.kind}`);
                  const rowTags = tags.filter((tag) => tx.tagIds.includes(tag.id));
                  return (
                    <SwipeRow
                      key={tx.id}
                      editLabel={t('common.edit')}
                      deleteLabel={t('common.delete')}
                      onPress={() =>
                        router.push({ pathname: '/transaction/[id]', params: { id: tx.id } })
                      }
                      onEdit={() =>
                        router.push({ pathname: '/transaction/edit/[id]', params: { id: tx.id } })
                      }
                      onDelete={() =>
                        setPendingDelete({
                          id: tx.id,
                          name: tx.description.length > 0 ? tx.description : name,
                        })
                      }
                    >
                      <ListRow
                        title={tx.description.length > 0 ? tx.description : name}
                        subtitle={
                          filters.tagIds.length > 0 && rowTags.length > 0
                            ? rowTags.map((tag) => tag.name).join(' · ')
                            : name
                        }
                        leading={
                          <IconBox name={(category?.icon ?? 'swap') as IconName} colour={colour} />
                        }
                        upcoming={tx.date > today}
                        trailing={
                          <AmountText
                            minor={tx.kind === 'income' ? tx.amount : -tx.amount}
                            currency={currency}
                            locale={locale}
                            signDisplay={tx.kind === 'income' ? 'always' : 'negative'}
                          />
                        }
                      />
                    </SwipeRow>
                  );
                })}
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      <TagFilterSheet
        visible={tagSheetOpen}
        onClose={() => setTagSheetOpen(false)}
        selected={filters.tagIds}
        onChange={(tagIds) => set({ tagIds })}
      />

      <ConfirmDialog
        visible={pendingDelete !== null}
        title={t('transactions.deleteTitle', { name: pendingDelete?.name ?? '' })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </Screen>
  );
}
