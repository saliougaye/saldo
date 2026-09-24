import { amountBufferToMinor, getCurrency } from '@saldo/core';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../src/components/Toast';
import { db } from '../../src/db/client';
import { useRepositories } from '../../src/db/DatabaseProvider';
import { createGoal } from '../../src/db/goalService';
import { useAccounts, useSettings } from '../../src/db/hooks';
import { GoalForm } from '../../src/features/goals/GoalForm';
import { emptyGoalForm, type GoalFormValues } from '../../src/features/goals/goalFormValues';
import { usePeriod } from '../../src/features/period/PeriodProvider';

/** §6.37. */
export default function NewGoal() {
  const router = useRouter();
  const { t } = useTranslation();
  const toast = useToast();
  const repos = useRepositories();
  const settings = useSettings();
  const accounts = useAccounts();
  const { today } = usePeriod();
  const { minorDigits } = getCurrency(settings?.currency ?? 'EUR');
  const [values, setValues] = useState<GoalFormValues>(emptyGoalForm);

  return (
    <GoalForm
      values={values}
      onChange={setValues}
      mode="new"
      onSubmit={() => {
        if (values.parentAccountId === null) return;
        const pocket = createGoal(db, repos, {
          name: values.name.trim(),
          icon: values.icon,
          colorIndex: values.colorIndex,
          parentAccountId: values.parentAccountId,
          goalTarget: amountBufferToMinor(values.buffer, minorDigits),
          goalDeadline: values.deadline,
          alreadySaved: amountBufferToMinor(values.savedBuffer, minorDigits),
          today,
          sortOrder: accounts.length,
        });
        toast.show(t('goals.created'));
        router.replace({ pathname: '/goal/[id]', params: { id: pocket.id } });
      }}
    />
  );
}
