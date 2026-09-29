import { amountBufferToMinor, type GoalFormValues, getCurrency, goalFormFrom } from '@saldo/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NotFoundScreen } from '../../../src/components/NotFoundScreen';
import { useToast } from '../../../src/components/Toast';
import { useRepositories } from '../../../src/db/DatabaseProvider';
import { useAccounts, useSettings } from '../../../src/db/hooks';
import { GoalForm } from '../../../src/features/goals/GoalForm';

/** §6.37, edit: one page; the parent never changes (§5.14). */
export default function EditGoal() {
  const router = useRouter();
  const { t } = useTranslation();
  const toast = useToast();
  const repos = useRepositories();
  const settings = useSettings();
  const accounts = useAccounts();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { minorDigits } = getCurrency(settings?.currency ?? 'EUR');
  const account = accounts.find((candidate) => candidate.id === id && candidate.type === 'pocket');
  const [values, setValues] = useState<GoalFormValues | null>(() =>
    account === undefined ? null : goalFormFrom(account, minorDigits),
  );
  const current = values ?? (account === undefined ? null : goalFormFrom(account, minorDigits));
  if (account === undefined || current === null) return <NotFoundScreen />;

  return (
    <GoalForm
      values={current}
      onChange={setValues}
      mode="edit"
      onSubmit={() => {
        repos.accounts.update(account.id, {
          name: current.name.trim(),
          icon: current.icon,
          colorIndex: current.colorIndex,
          goalTarget: amountBufferToMinor(current.buffer, minorDigits),
          goalDeadline: current.deadline,
        });
        toast.show(t('goals.saved'));
        router.back();
      }}
    />
  );
}
