import { getCurrency, newId } from '@saldo/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { removeAttachment } from '../../src/attachments/attachmentService';
import { useToast } from '../../src/components/Toast';
import { db } from '../../src/db/client';
import { useDatabase } from '../../src/db/DatabaseProvider';
import { closeGoal } from '../../src/db/goalService';
import { useAccounts, useSettings } from '../../src/db/hooks';
import { startRecurrence } from '../../src/db/recurrenceService';
import { settlementForm } from '../../src/features/accounts/settlement';
import { goalExpenseForm } from '../../src/features/goals/goalLinks';
import { PrivacyOverlay } from '../../src/features/lock/PrivacyOverlay';
import { usePeriod } from '../../src/features/period/PeriodProvider';
import { TransactionForm } from '../../src/features/transactions/TransactionForm';
import { emptyForm, toTransactionInput } from '../../src/features/transactions/useTransactionForm';

export default function NewTransaction() {
  const router = useRouter();
  const { t } = useTranslation();
  const toast = useToast();
  const { repos } = useDatabase();
  const settings = useSettings();
  const accounts = useAccounts();
  const { today, def } = usePeriod();
  const { minorDigits } = getCurrency(settings?.currency ?? 'EUR');
  // "Salda carta" (§6.10) opens this same sheet with the transfer filled in. Read once: after the
  // first render the fields are the user's.
  const params = useLocalSearchParams();
  const [settlement] = useState(() => settlementForm(params, today, minorDigits));
  // «Registra la spesa» (§5.14): saving this expense closes the goal; leaving does not.
  const [closing] = useState(() => goalExpenseForm(params, today, minorDigits));
  const [values, setValues] = useState(
    () => settlement?.values ?? closing?.values ?? emptyForm(today, accounts[0]?.id ?? null),
  );
  const [saving, setSaving] = useState(false);
  const savedRef = useRef(false);
  // Generated here rather than by the repository: an attachment picked before the first save needs
  // a transaction to belong to (§10).
  const [transactionId] = useState(() => newId());

  // Leaving without saving would otherwise strand any attachment already taken against that id.
  useEffect(
    () => () => {
      if (!savedRef.current) {
        for (const row of repos.attachments.listFor(transactionId)) {
          removeAttachment(repos, row.id);
        }
      }
    },
    [repos, transactionId],
  );

  return (
    <>
      <TransactionForm
        today={today}
        transactionId={transactionId}
        values={values}
        onChange={setValues}
        mode="new"
        amountShortcuts={settlement?.shortcuts.map((shortcut) => ({
          ...shortcut,
          label:
            shortcut.key === 'statement'
              ? t('accounts.settleStatement')
              : t('accounts.settleBalance'),
        }))}
        submitting={saving}
        onSubmit={() => {
          setSaving(true);
          savedRef.current = true;
          const created = repos.transactions.create({
            id: transactionId,
            ...toTransactionInput(values, minorDigits),
            recurrenceId: null,
          });
          // "Ripeti" turns the saved row into the first occurrence of a new series (§5.9).
          if (values.recurrence !== null) {
            startRecurrence(db, repos, created, values.recurrence, today, def);
          }
          if (closing !== null) {
            closeGoal(db, repos, closing.closeGoalId, today, new Date().toISOString());
            toast.show(t('goals.closed'));
            router.back();
            return;
          }
          toast.show(t('transactions.created'));
          router.back();
        }}
      />
      {/* A modal route is its own native window, which the root layout's cover cannot reach. */}
      <PrivacyOverlay />
    </>
  );
}
