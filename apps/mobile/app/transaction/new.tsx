import { getCurrency } from '@saldo/core';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { db } from '../../src/db/client';
import { useDatabase } from '../../src/db/DatabaseProvider';
import { useAccounts, useSettings } from '../../src/db/hooks';
import { startRecurrence } from '../../src/db/recurrenceService';
import { usePeriod } from '../../src/features/period/PeriodProvider';
import { TransactionForm } from '../../src/features/transactions/TransactionForm';
import { emptyForm, toTransactionInput } from '../../src/features/transactions/useTransactionForm';

export default function NewTransaction() {
  const router = useRouter();
  const { repos } = useDatabase();
  const settings = useSettings();
  const accounts = useAccounts();
  const { today, cycleStartDay } = usePeriod();
  const { minorDigits } = getCurrency(settings?.currency ?? 'EUR');
  const [values, setValues] = useState(() => emptyForm(today, accounts[0]?.id ?? null));
  const [saving, setSaving] = useState(false);

  return (
    <TransactionForm
      today={today}
      values={values}
      onChange={setValues}
      mode="new"
      submitting={saving}
      onSubmit={() => {
        setSaving(true);
        const created = repos.transactions.create({
          ...toTransactionInput(values, minorDigits),
          recurrenceId: null,
        });
        // "Ripeti" turns the saved row into the first occurrence of a new series (§5.9).
        if (values.repeat) startRecurrence(db, repos, created, today, cycleStartDay);
        router.back();
      }}
    />
  );
}
