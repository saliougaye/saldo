import { getCurrency } from '@saldo/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { removeAttachment } from '../../../src/attachments/attachmentService';
import { ConfirmDialog } from '../../../src/components/ConfirmDialog';
import { Screen } from '../../../src/components/Screen';
import { useToast } from '../../../src/components/Toast';
import { db } from '../../../src/db/client';
import { useDatabase } from '../../../src/db/DatabaseProvider';
import { useSettings } from '../../../src/db/hooks';
import { startRecurrence } from '../../../src/db/recurrenceService';
import { PrivacyOverlay } from '../../../src/features/lock/PrivacyOverlay';
import { usePeriod } from '../../../src/features/period/PeriodProvider';
import { RecurrenceScopeSheet } from '../../../src/features/transactions/RecurrenceScopeSheet';
import { TransactionForm } from '../../../src/features/transactions/TransactionForm';
import {
  formFromTransaction,
  toTransactionInput,
} from '../../../src/features/transactions/useTransactionForm';
import { leaveAfterDelete } from '../../../src/navigation/leave';
import { Text } from '../../../src/theme/Text';

export default function EditTransaction() {
  const router = useRouter();
  const { t } = useTranslation();
  const toast = useToast();
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
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (transaction === null || values === null) {
    return (
      <Screen>
        <Text color="textMuted">{t('transactions.empty')}</Text>
      </Screen>
    );
  }

  const name = transaction.description.length > 0 ? transaction.description : t('common.thisOne');

  const save = () => {
    // A recurring occurrence must first ask which occurrences the edit applies to (§5.9).
    if (transaction.recurrenceId !== null) {
      setScopeOpen(true);
      return;
    }
    const updated = repos.transactions.update(
      transaction.id,
      toTransactionInput(values, minorDigits),
    );
    // A plain transaction can start repeating from the edit form too, exactly as from the new one.
    if (values.recurrence !== null) {
      startRecurrence(db, repos, updated, values.recurrence, today, def);
    }
    toast.show(t('transactions.saved'));
    router.back();
  };

  const remove = () => {
    // The attachments go with it: their rows become tombstones so every device drops them,
    // and this device's files go now (§10).
    for (const row of repos.attachments.listFor(transaction.id)) {
      removeAttachment(repos, row.id);
    }
    repos.transactions.remove(transaction.id);
    setConfirmingDelete(false);
    // Deliberately no undo here, unlike the swipe on the list: this device's attachment files are
    // already gone, and restoring the row would bring it back with its receipts missing.
    toast.show(t('transactions.deleted', { name }));
    // The screen underneath is the detail of the row that no longer exists, so going back one step
    // would land on an empty screen.
    leaveAfterDelete(router);
  };

  return (
    <>
      <TransactionForm
        today={today}
        transactionId={transaction.id}
        values={values}
        onChange={setValues}
        mode="edit"
        recurrenceId={transaction.recurrenceId}
        onSubmit={save}
        onDelete={() => setConfirmingDelete(true)}
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
          toast.show(t('transactions.saved'));
          router.back();
        }}
      />
      <ConfirmDialog
        visible={confirmingDelete}
        title={t('transactions.deleteTitle', { name })}
        body={
          transaction.recurrenceId === null
            ? t('transactions.deleteBody')
            : t('transactions.deleteRecurringBody')
        }
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={remove}
        onCancel={() => setConfirmingDelete(false)}
      />
      {/* A modal route is its own native window, which the root layout's cover cannot reach. */}
      <PrivacyOverlay />
    </>
  );
}
