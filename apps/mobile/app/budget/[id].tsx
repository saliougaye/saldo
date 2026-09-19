import { amountBufferToMinor, getCurrency } from '@saldo/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { Screen } from '../../src/components/Screen';
import { useToast } from '../../src/components/Toast';
import { useRepositories } from '../../src/db/DatabaseProvider';
import { useSettings } from '../../src/db/hooks';
import { BudgetForm, budgetFormFrom } from '../../src/features/budgets/BudgetForm';
import { useLeaveGone } from '../../src/navigation/leave';
import { Text } from '../../src/theme/Text';

export default function EditBudget() {
  const router = useRouter();
  const leaveGone = useLeaveGone();
  const { t } = useTranslation();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const repos = useRepositories();
  const settings = useSettings();
  const { minorDigits } = getCurrency(settings?.currency ?? 'EUR');

  const [budget] = useState(() => (id === undefined ? null : repos.budgets.byId(id)));
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [values, setValues] = useState(() =>
    budget === null ? null : budgetFormFrom(budget, minorDigits),
  );

  if (budget === null || values === null) {
    return (
      <Screen>
        <Text color="textMuted">{t('budgets.empty')}</Text>
      </Screen>
    );
  }

  return (
    <>
      <BudgetForm
        values={values}
        onChange={setValues}
        mode="edit"
        editingBudgetId={budget.id}
        onSubmit={(name) => {
          repos.budgets.update(budget.id, {
            name,
            categoryIds: values.categoryIds,
            amount: amountBufferToMinor(values.buffer, minorDigits),
            period: values.period,
            alertThreshold: values.alertThreshold,
            rollover: values.period === 'period' ? values.rollover : false,
          });
          toast.show(t('budgets.saved'));
          router.back();
        }}
        onDelete={() => setConfirmingDelete(true)}
      />
      <ConfirmDialog
        visible={confirmingDelete}
        title={t('budgets.deleteTitle', { name: budget.name })}
        body={t('budgets.deleteBody')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => {
          repos.budgets.remove(budget.id);
          setConfirmingDelete(false);
          toast.show(t('budgets.deleted'));
          leaveGone({ kind: 'budget', ids: [budget.id] });
        }}
        onCancel={() => setConfirmingDelete(false)}
      />
    </>
  );
}
