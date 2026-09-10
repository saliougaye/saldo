import { accountBalances, netWorth, spendableTotal } from '@saldo/core';
import { formatMoney } from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { AmountText } from '../../src/components/AmountText';
import { Card } from '../../src/components/Card';
import { IconBox, ListRow } from '../../src/components/ListRow';
import { Screen } from '../../src/components/Screen';
import { SectionLabel } from '../../src/components/SectionLabel';
import { restoreAccount } from '../../src/db/adminService';
import { useRepositories } from '../../src/db/DatabaseProvider';
import { useAccounts, useSettings, useTransactionsInRange } from '../../src/db/hooks';
import { usePeriod } from '../../src/features/period/PeriodProvider';
import { useAppLocale } from '../../src/i18n/useAppLocale';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/** Account types that belong under "Risparmi e investimenti" (§6.5). */
const SAVINGS_TYPES = new Set(['savings', 'investment']);

export default function AccountsTab() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const repos = useRepositories();
  const settings = useSettings();
  const accounts = useAccounts();
  const { today } = usePeriod();
  const currency = settings?.currency ?? 'EUR';
  const [archivedOpen, setArchivedOpen] = useState(false);

  // A balance covers the whole history, so the range is deliberately unbounded (§5.3).
  const rows = useTransactionsInRange('1970-01-01', today);
  const balances = useMemo(() => accountBalances(accounts, rows, today), [accounts, rows, today]);

  const live = accounts.filter((account) => account.archivedAt === null);
  const archived = accounts.filter((account) => account.archivedAt !== null);
  const spendable = live.filter(
    (account) => !SAVINGS_TYPES.has(account.type) && account.includeInSpendable,
  );
  const savings = live.filter((account) => SAVINGS_TYPES.has(account.type));
  const others = live.filter(
    (account) => !SAVINGS_TYPES.has(account.type) && !account.includeInSpendable,
  );

  const row = (account: (typeof accounts)[number]) => (
    <ListRow
      key={account.id}
      title={account.name}
      subtitle={account.institution ?? t(`accountTypes.${account.type}`)}
      leading={
        <IconBox name={account.icon as IconName} colour={theme.categoryColor(account.colorIndex)} />
      }
      onPress={() => router.push({ pathname: '/account/[id]', params: { id: account.id } })}
      trailing={
        <AmountText minor={balances.get(account.id) ?? 0} currency={currency} locale={locale} />
      }
    />
  );

  return (
    <Screen underTabBar>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text size="display" weight="semibold" tracking="tighter" style={{ flex: 1 }}>
          {t('accounts.title')}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('settings.title')}
          hitSlop={10}
          onPress={() => router.push('/settings')}
        >
          <IconBox name="settings" colour={theme.palette.textMuted} small />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('accounts.newAccount')}
          hitSlop={10}
          onPress={() => router.push('/account/new')}
        >
          <IconBox name="plus" colour={theme.palette.textMuted} small />
        </Pressable>
      </View>

      <Card>
        <Text size="footnote" color="textMuted">
          {t('accounts.spendable')}
        </Text>
        <AmountText
          minor={spendableTotal(accounts, balances)}
          currency={currency}
          locale={locale}
          size="hero"
          weight="semibold"
          tracking="tightest"
        />
      </Card>

      {spendable.length + others.length === 0 ? null : (
        <Card padded={false}>
          <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 8 }}>
            {[...spendable, ...others].map(row)}
          </View>
        </Card>
      )}

      {savings.length === 0 ? null : (
        <>
          <SectionLabel>{t('accounts.savings')}</SectionLabel>
          <Card padded={false}>
            <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 8 }}>
              {savings.map(row)}
            </View>
          </Card>
        </>
      )}

      <Card>
        <Text size="footnote" color="textMuted">
          {t('accounts.netWorth')}
        </Text>
        <AmountText
          minor={netWorth(accounts, balances)}
          currency={currency}
          locale={locale}
          size="amountMd"
          weight="semibold"
          tracking="tighter"
        />
      </Card>

      {archived.length === 0 ? null : (
        <Card padded={false}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setArchivedOpen(!archivedOpen)}
            style={{ padding: theme.layout.cardPadding }}
          >
            <Text color="textMuted">
              {t('accounts.archived_other', { count: archived.length })}
            </Text>
          </Pressable>
          {archivedOpen ? (
            <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingBottom: 8 }}>
              {archived.map((account) => (
                <ListRow
                  key={account.id}
                  title={account.name}
                  leading={
                    <IconBox name={account.icon as IconName} colour={theme.palette.textFaint} />
                  }
                  trailing={
                    <Pressable
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() => restoreAccount(repos, account.id)}
                    >
                      <Text size="footnote" color="accent">
                        {t('accounts.restore')}
                      </Text>
                    </Pressable>
                  }
                />
              ))}
            </View>
          ) : null}
        </Card>
      )}

      <Text size="caption" color="textFaint">
        {formatMoney(netWorth(accounts, balances), currency, locale)}
      </Text>
    </Screen>
  );
}
