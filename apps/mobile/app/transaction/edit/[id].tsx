import { getCurrency } from '@saldo/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { removeAttachment } from '../../../src/attachments/attachmentService';
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
  const { today, def } = usePeriod();
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
        transactionId={transaction.id}
        values={values}
        onChange={setValues}
        mode="edit"
        onSubmit={save}
        onDelete={() => {
          // The attachments go with it: their rows become tombstones so every device drops them,
          // and this device's files go now (§10).
          for (const row of repos.attachments.listFor(transaction.id)) {
            removeAttachment(repos, row.id);
          }
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
        def={def}
        onDone={() => {
          setScopeOpen(false);
          router.back();
        }}
      />
    </>
  );
}
