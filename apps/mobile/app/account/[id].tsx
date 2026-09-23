import {
  accountBalances,
  addDays,
  creditCardDue,
  creditSettlementDraft,
  creditStatementAccrued,
  creditStatementDue,
  deltaPercent,
  isWithin,
  monthEndBalances,
  nextCreditChargeDate,
  parseLocalDate,
  periodContaining,
  summarizePeriod,
} from '@saldo/core';
import {
  formatDayMonth,
  formatDayMonthLong,
  formatMonthYear,
  formatSignedPercent,
} from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { AmountText, AnimatedAmount } from '../../src/components/AmountText';
import { PrimaryButton, SecondaryButton } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { CardHeader } from '../../src/components/CardHeader';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { DetailSkeleton } from '../../src/components/DetailSkeleton';
import { IconBox, ListRow } from '../../src/components/ListRow';
import { NotFoundScreen } from '../../src/components/NotFoundScreen';
import { Screen } from '../../src/components/Screen';
import { BackButton } from '../../src/components/ScreenHeader';
import { useToast } from '../../src/components/Toast';
import { useDelayed } from '../../src/components/useDelayed';
import { archiveAccount, restoreAccount } from '../../src/db/adminService';
import { useRepositories } from '../../src/db/DatabaseProvider';
import { useAccountsQuery, useSettings, useTransactionsInRangeQuery } from '../../src/db/hooks';
import { Sparkline } from '../../src/features/accounts/Sparkline';
import {
  SETTLEMENT_LOOKAHEAD_DAYS,
  settlementParams,
} from '../../src/features/accounts/settlement';
import { usePeriod } from '../../src/features/period/PeriodProvider';
import { transactionRow } from '../../src/features/transactions/transactionRow';
import { useAppLocale } from '../../src/i18n/useAppLocale';
import { useLeaveGone } from '../../src/navigation/leave';
import { Icon } from '../../src/theme/Icon';
import { swapIn } from '../../src/theme/motion';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/** §6.10 shows eight months of balances. */
const SPARK_MONTHS = 8;
const RECENT = 6;

export default function AccountDetail() {
  const theme = useTheme();
  const router = useRouter();
  const leaveGone = useLeaveGone();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const { id } = useLocalSearchParams<{ id: string }>();
  const repos = useRepositories();
  const toast = useToast();
  const settings = useSettings();
  const { accounts, loaded: entityLoaded } = useAccountsQuery();
  const { today, def } = usePeriod();
  const currency = settings?.currency ?? 'EUR';
  const [confirmArchive, setConfirmArchive] = useState(false);

  // A little past today as well: a card payment already scheduled for the charge day settles the
  // statement. Everything else on the screen reads up to today only, as before.
  const { rows: withUpcoming, loaded: rowsLoaded } = useTransactionsInRangeQuery(
    '1970-01-01',
    addDays(today, SETTLEMENT_LOOKAHEAD_DAYS),
  );
  const rows = useMemo(() => withUpcoming.filter((tx) => tx.date <= today), [withUpcoming, today]);
  // The figures sum these rows: before they land, a balance would paint as 0.
  const loaded = entityLoaded && rowsLoaded;
  const slow = useDelayed(!loaded);
  const account = accounts.find((candidate) => candidate.id === id);

  const balances = useMemo(() => accountBalances(accounts, rows, today), [accounts, rows, today]);
  const series = useMemo(
    () =>
      account === undefined
        ? []
        : monthEndBalances({
            accountId: account.id,
            openingBalance: account.openingBalance,
            txs: rows,
            today,
            months: SPARK_MONTHS,
          }),
    [account, rows, today],
  );

  const cycle = periodContaining(def, today);
  const cycleRows = useMemo(
    () => rows.filter((tx) => tx.accountId === id && isWithin(cycle, tx.date)),
    [rows, id, cycle],
  );
  const cycleSummary = summarizePeriod(cycleRows, cycle, today);
  const recent = useMemo(
    () => rows.filter((tx) => tx.accountId === id || tx.toAccountId === id).slice(0, RECENT),
    [rows, id],
  );

  if (!loaded) return <DetailSkeleton show={slow} />;
  if (account === undefined) {
    return <NotFoundScreen />;
  }

  // An archived account is history: §5.6 keeps its rows and its balance, and the only thing left
  // to do with it is bring it back. Editing, transferring and archiving again are all hidden
  // rather than disabled — a row of dead buttons is worse than no row.
  const archived = account.archivedAt !== null;
  const balance = balances.get(account.id) ?? 0;
  const first = series[0] ?? 0;
  const delta = deltaPercent(balance, first === 0 ? null : first);

  // The card box (§6.10, §5.3): what the closed statement still owes and when, and "Salda carta",
  // which opens the transfer sheet filled in — nothing is written until the user saves it.
  const isCard = account.type === 'credit_card';
  const statement = isCard ? creditStatementDue(account, withUpcoming, today) : null;
  const draft = isCard ? creditSettlementDraft(account, accounts, withUpcoming, today) : null;
  const due = statement?.due ?? 0;
  const dueDate = due > 0 ? (statement?.chargeDate ?? null) : null;
  const statementPaid = statement !== null && statement.statement > 0 && statement.due === 0;
  const paymentName =
    accounts.find((candidate) => candidate.id === account.creditPaymentAccountId)?.name ?? null;
  const canSettle = !archived && draft !== null && draft.balanceAmount > 0;
  const showCardBox =
    isCard && (account.creditCloseDay !== null || account.creditChargeDay !== null || canSettle);
  // The hairline between two rows of the card box, as the design's list draws it.
  const rowDivider = { borderTopWidth: 1, borderTopColor: theme.palette.border } as const;
  const settle = () => {
    if (draft === null) return;
    const { year, month } = parseLocalDate(draft.statementDate);
    const description = t('accounts.settleDescription', {
      card: account.name,
      month: formatMonthYear({ year, month }, locale),
    });
    router.push({ pathname: '/transaction/new', params: settlementParams(draft, description) });
  };

  return (
    <Screen
      refreshable
      footer={
        <View style={{ gap: 8 }}>
          {archived ? (
            <PrimaryButton
              label={t('accounts.restore')}
              onPress={() => {
                restoreAccount(repos, account.id);
                toast.show(t('accounts.restored', { name: account.name }));
              }}
            />
          ) : (
            <>
              <PrimaryButton
                label={t('accounts.transferTo')}
                onPress={() => router.push('/transaction/new')}
              />
              <SecondaryButton
                label={t('common.edit')}
                onPress={() =>
                  router.push({ pathname: '/account/edit/[id]', params: { id: account.id } })
                }
              />
            </>
          )}
        </View>
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <BackButton />
        <IconBox
          name={account.icon as IconName}
          colour={archived ? theme.palette.textFaint : theme.categoryColor(account.colorIndex)}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text size="headline" weight="semibold" tracking="tight" numberOfLines={1}>
            {account.name}
          </Text>
          <Text size="caption" color={archived ? 'textFaint' : 'textMuted'}>
            {archived
              ? t('accounts.archivedBadge')
              : (account.institution ?? t(`accountTypes.${account.type}`))}
          </Text>
        </View>
      </View>

      <Card>
        <Text size="footnote" color="textMuted">
          {account.type === 'credit_card' && balance < 0
            ? t('accounts.toRepay')
            : t('accounts.balance')}
        </Text>
        <AnimatedAmount
          minor={account.type === 'credit_card' && balance < 0 ? creditCardDue(balance) : balance}
          currency={currency}
          locale={locale}
          size="hero"
          weight="semibold"
          tracking="tightest"
        />
        <View style={{ marginTop: 12 }}>
          <Sparkline series={series} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
          <Text size="caption" color="textFaint">
            {t('accounts.monthsDelta')}
          </Text>
          <Text size="caption" color="textFaint">
            {delta === null ? '—' : formatSignedPercent(delta)}
          </Text>
        </View>
      </Card>

      {showCardBox ? (
        // "Sobria" (design 2026-09-23): one list, no button. What the bank will take is the
        // charge row's own figure, with the date and "Estratto conto" as its subtitle, and
        // settling the card is a row like the prototype's "Trasferisci", not a second button
        // under the hero.
        <Card padded={false}>
          <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 4 }}>
            {account.creditCloseDay === null ? null : (
              <ListRow
                title={t('accounts.accruedInCycle')}
                trailing={
                  <AmountText
                    align="end"
                    minor={creditStatementAccrued(account.id, account.creditCloseDay, rows, today)}
                    currency={currency}
                    locale={locale}
                  />
                }
              />
            )}
            {account.creditChargeDay === null ? null : (
              <View style={account.creditCloseDay === null ? undefined : rowDivider}>
                {/* Keyed on the state, so paying the card swaps the row in rather than
                    replacing it silently (better-ui swap, `motion.fadeMs`). */}
                <Animated.View key={dueDate === null ? 'plain' : 'due'} entering={swapIn(0.96)}>
                  <ListRow
                    title={t('accounts.nextCharge')}
                    subtitle={
                      dueDate === null
                        ? formatDayMonthLong(
                            nextCreditChargeDate(account.creditChargeDay, today),
                            locale,
                          )
                        : `${formatDayMonthLong(dueDate, locale)} · ${t('accounts.statementShort')}`
                    }
                    trailing={
                      dueDate === null ? (
                        statementPaid ? (
                          <View
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                            accessible
                            accessibilityLabel={t('accounts.paidShort')}
                          >
                            <Icon name="check" size={14} color={theme.palette.textMuted} />
                            <Text size="footnote" color="textMuted">
                              {t('accounts.paidShort')}
                            </Text>
                          </View>
                        ) : undefined
                      ) : (
                        <AmountText align="end" minor={due} currency={currency} locale={locale} />
                      )
                    }
                  />
                </Animated.View>
              </View>
            )}
            {canSettle ? (
              <View
                style={
                  account.creditCloseDay === null && account.creditChargeDay === null
                    ? undefined
                    : rowDivider
                }
              >
                <ListRow
                  title={t('accounts.settleCard')}
                  leading={<IconBox name="swap" colour={theme.palette.textMuted} />}
                  chevron
                  onPress={settle}
                />
              </View>
            ) : null}
          </View>
          {account.creditCloseDay !== null &&
          account.creditChargeDay !== null &&
          paymentName !== null ? (
            <Text
              size="caption"
              color="textFaint"
              style={{ paddingHorizontal: theme.layout.cardPadding, paddingBottom: 12 }}
            >
              {t('accounts.creditNote', {
                close: account.creditCloseDay,
                charge: account.creditChargeDay,
                account: paymentName,
              })}
            </Text>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text size="caption" color="textMuted">
              {t('home.income')}
            </Text>
            <AmountText
              minor={cycleSummary.income}
              currency={currency}
              locale={locale}
              weight="medium"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text size="caption" color="textMuted">
              {t('home.expenses')}
            </Text>
            <AmountText
              minor={cycleSummary.spent}
              currency={currency}
              locale={locale}
              weight="medium"
            />
          </View>
        </View>
      </Card>

      <Card padded={false}>
        <View style={{ padding: theme.layout.cardPadding, paddingBottom: 4 }}>
          <CardHeader
            title={t('accounts.lastTransactions')}
            status={t('home.allTransactions')}
            onPress={() =>
              router.push({
                pathname: '/(tabs)/transactions',
                params: { accountId: account.id },
              })
            }
          />
        </View>
        <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingBottom: 8 }}>
          {recent.length === 0 ? (
            <Text color="textMuted" style={{ paddingVertical: 12 }}>
              {t('transactions.empty')}
            </Text>
          ) : (
            recent.map((tx) => {
              // This screen *is* an account, so a transfer here has a direction: money landing in
              // it reads "+", money leaving it "−". The date stays the second line, since every
              // row on this card belongs to the same account.
              const row = transactionRow(tx, {
                // This card has no category column: a non-transfer row keeps reading
                // "description, else kind", exactly as before.
                category: () => undefined,
                accountName: (accountId) =>
                  accounts.find((candidate) => candidate.id === accountId)?.name ?? '',
                kindLabel: (kind) => t(`kinds.${kind}`),
                viewpointAccountId: account.id,
              });
              return (
                <ListRow
                  key={tx.id}
                  title={row.title}
                  subtitle={formatDayMonth(tx.date, locale)}
                  onPress={() =>
                    router.push({ pathname: '/transaction/[id]', params: { id: tx.id } })
                  }
                  trailing={
                    <AmountText
                      plain
                      align="end"
                      minor={row.amount.minor}
                      currency={currency}
                      locale={locale}
                      signDisplay={row.amount.signDisplay}
                    />
                  }
                />
              );
            })
          )}
        </View>
      </Card>

      {archived ? null : (
        <SecondaryButton label={t('accounts.archive')} onPress={() => setConfirmArchive(true)} />
      )}

      <ConfirmDialog
        visible={confirmArchive}
        title={t('accounts.archive')}
        body={account.name}
        confirmLabel={t('common.archive')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => {
          archiveAccount(repos, account.id, new Date().toISOString());
          setConfirmArchive(false);
          toast.show(t('accounts.archivedToast', { name: account.name }));
          leaveGone({ kind: 'account', ids: [account.id] });
        }}
        onCancel={() => setConfirmArchive(false)}
      />
    </Screen>
  );
}
