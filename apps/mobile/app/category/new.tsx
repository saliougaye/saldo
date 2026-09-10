import { amountBufferToMinor, getCurrency } from '@saldo/core';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useRepositories } from '../../src/db/DatabaseProvider';
import { useBudgets, useCategories, useSettings } from '../../src/db/hooks';
import {
  CategoryForm,
  type CategoryFormValues,
  emptyCategoryForm,
} from '../../src/features/categories/CategoryForm';

export default function NewCategory() {
  const router = useRouter();
  const repos = useRepositories();
  const settings = useSettings();
  const categories = useCategories();
  const budgets = useBudgets();
  const { minorDigits } = getCurrency(settings?.currency ?? 'EUR');
  const [values, setValues] = useState<CategoryFormValues>(emptyCategoryForm);

  return (
    <CategoryForm
      values={values}
      onChange={setValues}
      mode="new"
      onSubmit={() => {
        const created = repos.categories.create({
          name: values.name.trim(),
          direction: values.direction,
          parentId: values.parentId,
          icon: values.icon,
          colorIndex: values.colorIndex,
          archivedAt: null,
          sortOrder: categories.length,
        });
        const amount = amountBufferToMinor(values.budgetBuffer, minorDigits);
        // "Budget mensile" creates a single-category cycle budget (§5.11).
        if (values.budgetEnabled && amount > 0) {
          repos.budgets.create({
            name: created.name,
            categoryIds: [created.id],
            amount,
            period: 'cycle',
            alertThreshold: 90,
            rollover: false,
            icon: created.icon,
            sortOrder: budgets.length,
          });
        }
        router.back();
      }}
    />
  );
}
