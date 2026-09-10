import { amountBufferToMinor, getCurrency } from '@saldo/core';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useRepositories } from '../../src/db/DatabaseProvider';
import { useBudgets, useCategories, useSettings } from '../../src/db/hooks';
import {
  BudgetForm,
  type BudgetFormValues,
  emptyBudgetForm,
} from '../../src/features/budgets/BudgetForm';

export default function NewBudget() {
  const router = useRouter();
  const repos = useRepositories();
  const settings = useSettings();
  const categories = useCategories();
  const budgets = useBudgets();
  const { minorDigits } = getCurrency(settings?.currency ?? 'EUR');
  const [values, setValues] = useState<BudgetFormValues>(emptyBudgetForm);

  return (
    <BudgetForm
      values={values}
      onChange={setValues}
      mode="new"
      onSubmit={(name) => {
        const first = categories.find((category) => category.id === values.categoryIds[0]);
        repos.budgets.create({
          name,
          categoryIds: values.categoryIds,
          amount: amountBufferToMinor(values.buffer, minorDigits),
          period: values.period,
          alertThreshold: values.alertThreshold,
          rollover: values.period === 'cycle' ? values.rollover : false,
          icon: first?.icon ?? 'target',
          sortOrder: budgets.length,
        });
        router.back();
      }}
    />
  );
}
