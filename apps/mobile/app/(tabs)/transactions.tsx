import {
  EMPTY_FILTERS,
  type FilterLookup,
  filterTransactions,
  groupByDay,
  hasActiveFilters,
  splitUpcoming,
  type TransactionFilters,
} from '@saldo/core';
import { formatDayMonth, formatMoney } from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { AmountText } from '../../src/components/AmountText';
import { SecondaryButton } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Chip } from '../../src/components/Chip';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { IconBox, ListRow } from '../../src/components/ListRow';
import { Screen } from '../../src/components/Screen';
import { SectionDivider } from '../../src/components/SectionDivider';
import { SkeletonList } from '../../src/components/Skeleton';
import { TextField } from '../../src/components/TextField';
import { useToast } from '../../src/components/Toast';
import { useDelayed } from '../../src/components/useDelayed';
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
import { AccountFilterSheet } from '../../src/features/transactions/AccountFilterSheet';
import { SwipeRow } from '../../src/features/transactions/SwipeRow';
import { TagFilterSheet } from '../../src/features/transactions/TagFilterSheet';
import { UpcomingRow } from '../../src/features/transactions/UpcomingRow';
import { useAppLocale } from '../../src/i18n/useAppLocale';
import { appearing, leaving, reflowing } from '../../src/theme/motion';
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

  // An account arrives as a route param — from "Ultime transazioni" on an account, which is the
  // one place that asks for this list *about something*. It seeds the filter rather than opening a
  // different screen, so clearing it leaves you in the list you are already reading.
  const { accountId } = useLocalSearchParams<{ accountId?: string }>();
  const [filters, setFilters] = useState<TransactionFilters>(() =>
    accountId === undefined ? EMPTY_FILTERS : { ...EMPTY_FILTERS, accountId },
  );
  const [tagSheetOpen, setTagSheetOpen] = useState(false);
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [upcomingOpen, setUpcomingOpen] = useState(false);

  const { rows, loaded } = useTransactionsInRangeQuery(period.range.start, period.range.end);
  const slow = useDelayed(!loaded);

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

  const filtered = useMemo(
    () => filterTransactions(rows, filters, lookup),
    [rows, filters, lookup],
  );
  // §5.12: the list is what happened. What is still to come is folded behind one row, because a
  // list that opens on next week's rent reads as a list of things you already did.
  const { upcoming, settled, upcomingNet } = useMemo(
    () => splitUpcoming(filtered, today),
    [filtered, today],
  );
  const groups = useMemo(() => groupByDay(settled), [settled]);
  const upcomingGroups = useMemo(() => groupByDay(upcoming), [upcoming]);

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  /** One day of the list. Shared by the settled groups and the upcoming ones behind the fold. */
  const dayCard = (group: ReturnType<typeof groupByDay>[number]) => (
    // The whole day closes up when its last transaction is filtered out or deleted.
    <Animated.View key={group.date} layout={reflowing} entering={appearing} exiting={leaving}>
      <Card padded={false}>
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
              <Animated.View key={tx.id} layout={reflowing} entering={appearing} exiting={leaving}>
                <SwipeRow
                  editLabel={t('common.edit')}
                  deleteLabel={t('common.delete')}
                  onPress={() =>
                    router.push({ pathname: '/transaction/[id]', params: { id: tx.id } })
                  }
                  onEdit={() =>
                    router.push({
                      pathname: '/transaction/edit/[id]',
                      params: { id: tx.id },
                    })
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
              </Animated.View>
            );
          })}
        </View>
      </Card>
    </Animated.View>
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
          label={
            filters.accountId === null
              ? t('transactions.account')
              : (accounts.find((row) => row.id === filters.accountId)?.name ??
                t('transactions.account'))
          }
          icon="wallet"
          active={filters.accountId !== null}
          chevron
          onPress={() => setAccountSheetOpen(true)}
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
          // Nothing at all until the query has been slow enough to be worth mentioning: on a warm
          // database it answers in a frame, and a skeleton that flashes reads as a glitch.
          slow ? (
            <SkeletonList rows={5} label={t('common.loading')} />
          ) : null
        ) : groups.length === 0 && upcoming.length === 0 ? (
          <Animated.View entering={appearing}>
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
          </Animated.View>
        ) : (
          <>
            {upcoming.length === 0 ? null : (
              <Animated.View layout={reflowing} entering={appearing} exiting={leaving}>
                <UpcomingRow
                  count={upcoming.length}
                  net={upcomingNet}
                  currency={currency}
                  locale={locale}
                  open={upcomingOpen}
                  onToggle={() => setUpcomingOpen(!upcomingOpen)}
                />
              </Animated.View>
            )}
            {upcomingOpen ? (
              <>
                <SectionDivider label={t('transactions.upcomingSection')} />
                {upcomingGroups.map(dayCard)}
              </>
            ) : null}
            {upcomingOpen && groups.length > 0 ? (
              // The toggle row above has scrolled away by the time the future ends; this is what
              // says the list has gone back to what already happened.
              <Animated.View entering={appearing} exiting={leaving}>
                <SectionDivider label={t('transactions.settledSection')} />
              </Animated.View>
            ) : null}
            {groups.map(dayCard)}
          </>
        )}
      </ScrollView>

      <AccountFilterSheet
        visible={accountSheetOpen}
        onClose={() => setAccountSheetOpen(false)}
        selected={filters.accountId}
        onChange={(accountId) => set({ accountId })}
      />

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
