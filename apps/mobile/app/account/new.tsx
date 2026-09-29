import {
  type AccountFormValues,
  amountBufferToMinor,
  emptyAccountForm,
  getCurrency,
} from '@saldo/core';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useRepositories } from '../../src/db/DatabaseProvider';
import { useAccounts, useSettings } from '../../src/db/hooks';
import { AccountForm } from '../../src/features/accounts/AccountForm';

export default function NewAccount() {
  const router = useRouter();
  const repos = useRepositories();
  const settings = useSettings();
  const accounts = useAccounts();
  const { minorDigits } = getCurrency(settings?.currency ?? 'EUR');
  const [values, setValues] = useState<AccountFormValues>(emptyAccountForm);

  return (
    <AccountForm
      values={values}
      onChange={setValues}
      mode="new"
      accounts={accounts}
      onSubmit={() => {
        repos.accounts.create({
          name: values.name.trim(),
          type: values.type,
          institution: values.institution.trim().length > 0 ? values.institution.trim() : null,
          // A new account has no transactions, so the typed balance *is* the opening balance.
          openingBalance: amountBufferToMinor(values.buffer, minorDigits),
          includeInSpendable: values.includeInSpendable,
          colorIndex: values.colorIndex,
          icon: values.icon,
          creditCloseDay: values.type === 'credit_card' ? values.creditCloseDay : null,
          creditChargeDay: values.type === 'credit_card' ? values.creditChargeDay : null,
          creditPaymentAccountId:
            values.type === 'credit_card' ? values.creditPaymentAccountId : null,
          archivedAt: null,
          sortOrder: accounts.length,
        });
        router.back();
      }}
    />
  );
}
