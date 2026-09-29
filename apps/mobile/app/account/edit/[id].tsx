import {
  type AccountFormValues,
  accountBalances,
  accountFormFrom,
  amountBufferToMinor,
  getCurrency,
  openingBalanceForCurrent,
} from '@saldo/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PrimaryButton } from '../../../src/components/Button';
import { LoadingScreen } from '../../../src/components/LoadingScreen';
import { NotFoundScreen } from '../../../src/components/NotFoundScreen';
import { Screen } from '../../../src/components/Screen';
import { BackButton } from '../../../src/components/ScreenHeader';
import { useToast } from '../../../src/components/Toast';
import { restoreAccount } from '../../../src/db/adminService';
import { useRepositories } from '../../../src/db/DatabaseProvider';
import { useAccountsQuery, useSettings, useTransactionsInRangeQuery } from '../../../src/db/hooks';
import { AccountForm } from '../../../src/features/accounts/AccountForm';
import { usePeriod } from '../../../src/features/period/PeriodProvider';
import { Text } from '../../../src/theme/Text';

export default function EditAccount() {
  const router = useRouter();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const repos = useRepositories();
  const toast = useToast();
  const settings = useSettings();
  const { accounts, loaded: accountsLoaded } = useAccountsQuery();
  const { today } = usePeriod();
  const { minorDigits } = getCurrency(settings?.currency ?? 'EUR');
  const { rows, loaded: rowsLoaded } = useTransactionsInRangeQuery('1970-01-01', today);
  const loaded = accountsLoaded && rowsLoaded;

  const account = accounts.find((candidate) => candidate.id === id);
  const balance = useMemo(
    () =>
      account === undefined ? 0 : (accountBalances(accounts, rows, today).get(account.id) ?? 0),
    [account, accounts, rows, today],
  );
  // The form follows the account until the user types, and only then becomes their draft. Seeding
  // it in a `useState` initialiser read the live queries on the first render, where they are still
  // empty: the screen decided the account did not exist and then had no way to change its mind.
  const [edited, setEdited] = useState<AccountFormValues | null>(null);
  const values = useMemo(
    () =>
      edited ??
      (!loaded || account === undefined ? null : accountFormFrom(account, balance, minorDigits)),
    [edited, loaded, account, balance, minorDigits],
  );

  if (!loaded) return <LoadingScreen />;

  if (account === undefined || values === null) {
    return <NotFoundScreen />;
  }

  // Nothing in the app offers this for an archived account any more (§5.6), but a deep link or a
  // stale back stack can still land here: restoring it is the only thing on offer.
  if (account.archivedAt !== null) {
    return (
      <Screen
        footer={
          <PrimaryButton
            label={t('accounts.restore')}
            onPress={() => {
              restoreAccount(repos, account.id);
              toast.show(t('accounts.restored', { name: account.name }));
              router.back();
            }}
          />
        }
      >
        <BackButton />
        <Text size="display" weight="semibold" tracking="tighter">
          {account.name}
        </Text>
        <Text color="textMuted">{t('accounts.archivedNote')}</Text>
      </Screen>
    );
  }

  return (
    <AccountForm
      values={values}
      onChange={setEdited}
      mode="edit"
      accounts={accounts}
      accountId={account.id}
      onSubmit={() => {
        repos.accounts.update(account.id, {
          name: values.name.trim(),
          type: values.type,
          institution: values.institution.trim().length > 0 ? values.institution.trim() : null,
          // The field edits the *current* balance (§6.22), so store the opening balance that
          // produces it.
          openingBalance: openingBalanceForCurrent({
            accountId: account.id,
            currentBalance: amountBufferToMinor(values.buffer, minorDigits),
            txs: rows,
            today,
          }),
          includeInSpendable: values.includeInSpendable,
          colorIndex: values.colorIndex,
          icon: values.icon,
          creditCloseDay: values.type === 'credit_card' ? values.creditCloseDay : null,
          creditChargeDay: values.type === 'credit_card' ? values.creditChargeDay : null,
          creditPaymentAccountId:
            values.type === 'credit_card' ? values.creditPaymentAccountId : null,
        });
        router.back();
      }}
    />
  );
}
