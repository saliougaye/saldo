import { amountBufferToMinor, categoryFormFrom, getCurrency } from '@saldo/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { NotFoundScreen } from '../../../src/components/NotFoundScreen';
import { useRepositories } from '../../../src/db/DatabaseProvider';
import { useBudgets, useCategories, useSettings } from '../../../src/db/hooks';
import { ArchiveCategorySheet } from '../../../src/features/categories/ArchiveCategorySheet';
import { CategoryForm } from '../../../src/features/categories/CategoryForm';
import { useLeaveGone } from '../../../src/navigation/leave';

export default function EditCategory() {
  const router = useRouter();
  const leaveGone = useLeaveGone();
  const { id } = useLocalSearchParams<{ id: string }>();
  const repos = useRepositories();
  const settings = useSettings();
  const budgets = useBudgets();
  const categories = useCategories();
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
    return <NotFoundScreen />;
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
          // Its children are archived with it (`archiveCategory`), so their screens go too.
          const children = categories.filter((child) => child.parentId === category.id);
          leaveGone({ kind: 'category', ids: [category.id, ...children.map((child) => child.id)] });
        }}
      />
    </>
  );
}
