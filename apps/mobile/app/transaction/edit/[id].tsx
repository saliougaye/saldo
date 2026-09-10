import { getCurrency } from '@saldo/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../../src/components/Screen';
import { useDatabase } from '../../../src/db/DatabaseProvider';
import { useSettings } from '../../../src/db/hooks';
import { usePeriod } from '../../../src/features/period/PeriodProvider';
import { RecurrenceScopeSheet } from '../../../src/features/transactions/RecurrenceScopeSheet';
import { TransactionForm } from '../../../src/features/transactions/TransactionForm';
import {
  formFromTransaction,
  toTransactionInput,
} from '../../../src/features/transactions/useTransactionForm';
import { Text } from '../../../src/theme/Text';

export default function EditTransaction() {
  const router = useRouter();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { repos } = useDatabase();
  const settings = useSettings();
  const { today, cycleStartDay } = usePeriod();
  const { minorDigits } = getCurrency(settings?.currency ?? 'EUR');

  const [transaction] = useState(() => (id === undefined ? null : repos.transactions.byId(id)));
  const [values, setValues] = useState(() =>
    transaction === null ? null : formFromTransaction(transaction, minorDigits),
  );
  const [scopeOpen, setScopeOpen] = useState(false);

  if (transaction === null || values === null) {
    return (
      <Screen>
        <Text color="textMuted">{t('transactions.empty')}</Text>
      </Screen>
    );
  }

  const save = () => {
    // A recurring occurrence must first ask which occurrences the edit applies to (§5.9).
    if (transaction.recurrenceId !== null) {
      setScopeOpen(true);
      return;
    }
    repos.transactions.update(transaction.id, toTransactionInput(values, minorDigits));
    router.back();
  };

  return (
    <>
      <TransactionForm
        today={today}
        values={values}
        onChange={setValues}
        mode="edit"
        onSubmit={save}
        onDelete={() => {
          repos.transactions.remove(transaction.id);
          router.back();
        }}
      />
      <RecurrenceScopeSheet
        visible={scopeOpen}
        onClose={() => setScopeOpen(false)}
        transaction={transaction}
        values={values}
        minorDigits={minorDigits}
        today={today}
        cycleStartDay={cycleStartDay}
        onDone={() => {
          setScopeOpen(false);
          router.back();
        }}
      />
    </>
  );
}
