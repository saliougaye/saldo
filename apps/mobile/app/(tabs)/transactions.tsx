import {
  EMPTY_FILTERS,
  type FilterLookup,
  filtersFromParams,
  filterTransactions,
  groupByDay,
  hasActiveFilters,
  splitUpcoming,
  type TransactionFilters,
  totalsOf,
} from '@saldo/core';
import { formatDayMonth, formatMoney } from '@saldo/i18n';
import { router as routerApi, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
import {
  type TransactionRowDeps,
  transactionRow,
} from '../../src/features/transactions/transactionRow';
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

  // Filters arrive as route params — from "Ultime transazioni" on an account, and from the excluded
  // line on Statistics (§5.7). They seed the filter rather than opening a different screen, so
  // clearing them leaves you in the list you are already reading.
  const { accountId, direction, onlyExcluded } = useLocalSearchParams<{
    accountId?: string;
    direction?: string;
    onlyExcluded?: string;
  }>();
  const [filters, setFilters] = useState<TransactionFilters>(() =>
    filtersFromParams({ accountId, direction, onlyExcluded }),
  );

  // This is a tab, so it is mounted once and never again: the state initialiser above only ever
  // sees the params of whichever link happened to open the app's first visit here. Every later
  // link has to be picked up as it arrives — and then spent, because leaving the params in place
  // would make a second tap on the same link read as "nothing changed" and quietly do nothing.
  useEffect(() => {
    if (!accountId && !direction && !onlyExcluded) return;
    setFilters(filtersFromParams({ accountId, direction, onlyExcluded }));
    routerApi.setParams({ accountId: undefined, direction: undefined, onlyExcluded: undefined });
  }, [accountId, direction, onlyExcluded]);
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
  // What the filtered list adds up to. Per-day totals answer "that Tuesday"; nothing answered
  // "this tag in this cycle", which is the question a filter is switched on to ask.
  const filterTotals = useMemo(() => totalsOf(settled), [settled]);
  const upcomingGroups = useMemo(() => groupByDay(upcoming), [upcoming]);

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  // The list reads from the account the Conto chip selects, which is what gives a transfer its
  // direction: money leaving that account is "−", money landing in it is "+". With no account
  // selected a transfer moves nothing the list is about, so it shows unsigned (§5.3).
  const rowDeps = useMemo<TransactionRowDeps>(
    () => ({
      category: (id) => categoryById.get(id),
      accountName: (id) => accounts.find((account) => account.id === id)?.name ?? '',
      kindLabel: (kind) => t(`kinds.${kind}`),
      viewpointAccountId: filters.accountId,
    }),
    [categoryById, accounts, t, filters.accountId],
  );

  // "Solo uscite"/"Solo entrate" drop transfers on purpose (§5.12), which is why the list can seem
  // to lose them. Count what the chip is hiding so the screen can say so instead. "Solo
  // trasferimenti" shows transfers rather than hiding them, so it has nothing to report here.
  const hiddenTransfers = useMemo(() => {
    if (filters.direction === 'all' || filters.direction === 'transfer') return 0;
    return filterTransactions(rows, { ...filters, direction: 'all' }, lookup).filter(
      (tx) => tx.kind === 'transfer',
    ).length;
  }, [rows, filters, lookup]);

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
            const row = transactionRow(tx, rowDeps);
            const colour = theme.categoryColor(row.colorIndex);
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
                  onDelete={() => setPendingDelete({ id: tx.id, name: row.title })}
                >
                  <ListRow
                    title={row.title}
                    subtitle={
                      filters.tagIds.length > 0 && rowTags.length > 0
                        ? rowTags.map((tag) => tag.name).join(' · ')
                        : row.subtitle
                    }
                    leading={<IconBox name={row.icon} colour={colour} />}
                    upcoming={tx.date > today}
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
    <>
      {/*
        The whole screen scrolls, so a pull anywhere on it syncs (§8.5) — with the list as its own
        scroll view under a fixed header, only a pull on the list did. The search and the chips stay
        sticky (§6.2): child 1 is pinned, the period header above it scrolls away.
      */}
      <Screen underTabBar refreshable stickyHeaderIndices={[1]} keyboardDismissMode="on-drag">
        <PeriodHeader />
        <View
          style={{
            backgroundColor: theme.palette.bg,
            // Edge to edge, so the rows scrolling under it are covered in the screen padding too.
            marginHorizontal: -theme.layout.screenPaddingX,
            paddingHorizontal: theme.layout.screenPaddingX,
            paddingBottom: 6,
            gap: theme.layout.cardGap,
          }}
        >
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
              icon="arrowUR"
              active={filters.direction === 'expense'}
              onPress={() =>
                set({ direction: filters.direction === 'expense' ? 'all' : 'expense' })
              }
            />
            <Chip
              label={t('transactions.onlyIncome')}
              icon="arrowDL"
              active={filters.direction === 'income'}
              onPress={() => set({ direction: filters.direction === 'income' ? 'all' : 'income' })}
            />
            <Chip
              label={t('transactions.onlyTransfers')}
              icon="swap"
              active={filters.direction === 'transfer'}
              onPress={() =>
                set({ direction: filters.direction === 'transfer' ? 'all' : 'transfer' })
              }
            />
            <Chip
              // One tag is named, several are counted: a chip that always reads "Tag" cannot say which
              // cycle total the line below it belongs to.
              label={
                filters.tagIds.length === 1
                  ? (tags.find((tag) => tag.id === filters.tagIds[0])?.name ??
                    t('transactions.tags'))
                  : filters.tagIds.length > 1
                    ? t('transactions.tagsCount', { count: filters.tagIds.length })
                    : t('transactions.tags')
              }
              icon="tag"
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
              icon="archive"
              active={filters.onlyExcluded}
              onPress={() => set({ onlyExcluded: !filters.onlyExcluded })}
            />
          </ScrollView>

          {hiddenTransfers === 0 ? null : (
            // Without this the chip silently eats them and the list looks like it lost the rows.
            <Animated.View entering={appearing} exiting={leaving}>
              <Text size="footnote" color="textMuted" style={{ paddingTop: 6 }}>
                {t('transactions.transfersHidden', { count: hiddenTransfers })}
              </Text>
            </Animated.View>
          )}

          {!active ? null : (
            <Animated.View entering={appearing} exiting={leaving}>
              <Text size="footnote" color="textMuted" style={{ paddingTop: 6 }}>
                {t(
                  filterTotals.income > 0
                    ? 'transactions.filteredTotalMixed'
                    : 'transactions.filteredTotal',
                  {
                    count: filterTotals.count,
                    spent: formatMoney(filterTotals.expense, currency, locale),
                    income: formatMoney(filterTotals.income, currency, locale),
                  },
                )}
              </Text>
            </Animated.View>
          )}
        </View>

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
      </Screen>

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
    </>
  );
}
