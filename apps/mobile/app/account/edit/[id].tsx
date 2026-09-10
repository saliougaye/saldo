import {
  accountBalances,
  amountBufferToMinor,
  getCurrency,
  openingBalanceForCurrent,
} from '@saldo/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../../src/components/Screen';
import { useRepositories } from '../../../src/db/DatabaseProvider';
import { useAccounts, useSettings, useTransactionsInRange } from '../../../src/db/hooks';
import { AccountForm, accountFormFrom } from '../../../src/features/accounts/AccountForm';
import { usePeriod } from '../../../src/features/period/PeriodProvider';
import { Text } from '../../../src/theme/Text';

export default function EditAccount() {
  const router = useRouter();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const repos = useRepositories();
  const settings = useSettings();
  const accounts = useAccounts();
  const { today } = usePeriod();
  const { minorDigits } = getCurrency(settings?.currency ?? 'EUR');
  const rows = useTransactionsInRange('1970-01-01', today);

  const account = accounts.find((candidate) => candidate.id === id);
  const balance = useMemo(
    () =>
      account === undefined ? 0 : (accountBalances(accounts, rows, today).get(account.id) ?? 0),
    [account, accounts, rows, today],
  );
  const [values, setValues] = useState(() =>
    account === undefined ? null : accountFormFrom(account, balance, minorDigits),
  );

  if (account === undefined || values === null) {
    return (
      <Screen>
        <Text color="textMuted">{t('accounts.empty')}</Text>
      </Screen>
    );
  }

  return (
    <AccountForm
      values={values}
      onChange={setValues}
      mode="edit"
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
        });
        router.back();
      }}
    />
  );
}
