import {
  accountBalances,
  creditCardDue,
  creditStatementAccrued,
  deltaPercent,
  isWithin,
  monthEndBalances,
  nextCreditChargeDate,
  periodContaining,
  summarizePeriod,
} from '@saldo/core';
import { formatDayMonth, formatLongDate, formatMoney, formatSignedPercent } from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AmountText } from '../../src/components/AmountText';
import { PrimaryButton, SecondaryButton } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { IconBox, ListRow } from '../../src/components/ListRow';
import { Screen } from '../../src/components/Screen';
import { BackButton } from '../../src/components/ScreenHeader';
import { archiveAccount } from '../../src/db/adminService';
import { useRepositories } from '../../src/db/DatabaseProvider';
import { useAccounts, useSettings, useTransactionsInRange } from '../../src/db/hooks';
import { Sparkline } from '../../src/features/accounts/Sparkline';
import { usePeriod } from '../../src/features/period/PeriodProvider';
import { useAppLocale } from '../../src/i18n/useAppLocale';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/** §6.10 shows eight months of balances. */
const SPARK_MONTHS = 8;
const RECENT = 6;

export default function AccountDetail() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const { id } = useLocalSearchParams<{ id: string }>();
  const repos = useRepositories();
  const settings = useSettings();
  const accounts = useAccounts();
  const { today, def } = usePeriod();
  const currency = settings?.currency ?? 'EUR';
  const [confirmArchive, setConfirmArchive] = useState(false);

  const rows = useTransactionsInRange('1970-01-01', today);
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

  if (account === undefined) {
    return (
      <Screen>
        <Text color="textMuted">{t('accounts.empty')}</Text>
      </Screen>
    );
  }

  const balance = balances.get(account.id) ?? 0;
  const first = series[0] ?? 0;
  const delta = deltaPercent(balance, first === 0 ? null : first);

  return (
    <Screen
      footer={
        <View style={{ gap: 8 }}>
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
        </View>
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <BackButton />
        <IconBox name={account.icon as IconName} colour={theme.categoryColor(account.colorIndex)} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text size="headline" weight="semibold" tracking="tight" numberOfLines={1}>
            {account.name}
          </Text>
          <Text size="caption" color="textMuted">
            {account.institution ?? t(`accountTypes.${account.type}`)}
          </Text>
        </View>
      </View>

      <Card>
        <Text size="footnote" color="textMuted">
          {account.type === 'credit_card' && balance < 0
            ? t('accounts.toRepay')
            : t('accounts.balance')}
        </Text>
        <AmountText
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

      {account.type === 'credit_card' && account.creditCloseDay !== null ? (
        <Card>
          <ListRow
            title={t('accounts.accruedInCycle')}
            trailing={
              <AmountText
                minor={creditStatementAccrued(account.id, account.creditCloseDay, rows, today)}
                currency={currency}
                locale={locale}
              />
            }
          />
          {account.creditChargeDay === null ? null : (
            <ListRow
              title={t('accounts.nextCharge')}
              trailing={
                <Text color="textMuted">
                  {formatLongDate(nextCreditChargeDate(account.creditChargeDay, today), locale)}
                </Text>
              }
            />
          )}
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
          <Text weight="medium" tracking="tight">
            {t('accounts.lastTransactions')}
          </Text>
        </View>
        <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingBottom: 8 }}>
          {recent.length === 0 ? (
            <Text color="textMuted" style={{ paddingVertical: 12 }}>
              {t('transactions.empty')}
            </Text>
          ) : (
            recent.map((tx) => (
              <ListRow
                key={tx.id}
                title={tx.description.length > 0 ? tx.description : t(`kinds.${tx.kind}`)}
                subtitle={formatDayMonth(tx.date, locale)}
                onPress={() =>
                  router.push({ pathname: '/transaction/[id]', params: { id: tx.id } })
                }
                trailing={
                  <AmountText
                    minor={tx.kind === 'income' ? tx.amount : -tx.amount}
                    currency={currency}
                    locale={locale}
                  />
                }
              />
            ))
          )}
        </View>
      </Card>

      <SecondaryButton label={t('accounts.archive')} onPress={() => setConfirmArchive(true)} />
      <Text size="caption" color="textFaint">
        {formatMoney(balance, currency, locale)}
      </Text>

      <ConfirmDialog
        visible={confirmArchive}
        title={t('accounts.archive')}
        body={account.name}
        confirmLabel={t('common.archive')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => {
          archiveAccount(repos, account.id, new Date().toISOString());
          setConfirmArchive(false);
          router.back();
        }}
        onCancel={() => setConfirmArchive(false)}
      />
    </Screen>
  );
}
