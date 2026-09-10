import { amountBufferToMinor, getCurrency } from '@saldo/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../src/components/Screen';
import { useRepositories } from '../../src/db/DatabaseProvider';
import { useSettings } from '../../src/db/hooks';
import { BudgetForm, budgetFormFrom } from '../../src/features/budgets/BudgetForm';
import { Text } from '../../src/theme/Text';

export default function EditBudget() {
  const router = useRouter();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const repos = useRepositories();
  const settings = useSettings();
  const { minorDigits } = getCurrency(settings?.currency ?? 'EUR');

  const [budget] = useState(() => (id === undefined ? null : repos.budgets.byId(id)));
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
          rollover: values.period === 'cycle' ? values.rollover : false,
        });
        router.back();
      }}
      onDelete={() => {
        repos.budgets.remove(budget.id);
        router.back();
      }}
    />
  );
}
