import { amountBufferToMinor, getCurrency } from '@saldo/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../../src/components/Screen';
import { useRepositories } from '../../../src/db/DatabaseProvider';
import { useBudgets, useSettings } from '../../../src/db/hooks';
import { ArchiveCategorySheet } from '../../../src/features/categories/ArchiveCategorySheet';
import { CategoryForm, categoryFormFrom } from '../../../src/features/categories/CategoryForm';
import { Text } from '../../../src/theme/Text';

export default function EditCategory() {
  const router = useRouter();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const repos = useRepositories();
  const settings = useSettings();
  const budgets = useBudgets();
  const { minorDigits } = getCurrency(settings?.currency ?? 'EUR');
  const [archiveOpen, setArchiveOpen] = useState(false);

  const [category] = useState(() => (id === undefined ? null : repos.categories.byId(id)));
  const ownBudget =
    category === null
      ? null
      : (budgets.find(
          (budget) => budget.categoryIds.length === 1 && budget.categoryIds[0] === category.id,
        ) ?? null);
  const [values, setValues] = useState(() =>
    category === null ? null : categoryFormFrom(category, ownBudget?.amount ?? null, minorDigits),
  );

  if (category === null || values === null) {
    return (
      <Screen>
        <Text color="textMuted">{t('categories.empty')}</Text>
      </Screen>
    );
  }

  return (
    <>
      <CategoryForm
        values={values}
        onChange={setValues}
        mode="edit"
        editingCategoryId={category.id}
        onArchive={() => setArchiveOpen(true)}
        onSubmit={() => {
          repos.categories.update(category.id, {
            name: values.name.trim(),
            parentId: values.parentId,
            icon: values.icon,
            colorIndex: values.colorIndex,
          });
          const amount = amountBufferToMinor(values.budgetBuffer, minorDigits);
          if (values.budgetEnabled && amount > 0) {
            if (ownBudget === null) {
              repos.budgets.create({
                name: values.name.trim(),
                categoryIds: [category.id],
                amount,
                period: 'period',
                alertThreshold: 90,
                rollover: false,
                icon: values.icon,
                sortOrder: budgets.length,
              });
            } else {
              repos.budgets.update(ownBudget.id, { amount });
            }
          } else if (ownBudget !== null) {
            repos.budgets.remove(ownBudget.id);
          }
          router.back();
        }}
      />
      <ArchiveCategorySheet
        visible={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        category={category}
        onDone={() => {
          setArchiveOpen(false);
          router.back();
        }}
      />
    </>
  );
}
