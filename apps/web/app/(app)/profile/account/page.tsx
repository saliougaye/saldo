import { isPocket, pocketParentCandidates } from '@saldo/core';
import type { IconName } from '@saldo/ui';
import { readPage } from '../../../../src/server/page/context';
import { AmountText } from '../../../../src/ui/AmountText';
import { ListRow } from '../../../../src/ui/ListRow';
import { Section } from '../../../../src/ui/Section';
import { SummaryRow } from '../../../../src/ui/SummaryRow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Profilo → Account: who is signed in, and what the account holds — its categories, budgets and
 * goals — as read-only lists. Each budget and goal opens where it is managed; categories are edited
 * with the forms of 0.3e-3.
 */
export default async function ProfileAccountPage() {
  const page = await readPage(Promise.resolve({}));
  const { t, locale, currency, data } = page;

  const categories = data.categories
    .filter((category) => category.parentId === null && category.archivedAt === null)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const expenseCategories = categories.filter((category) => category.direction === 'expense');
  const incomeCategories = categories.filter((category) => category.direction === 'income');
  const budgets = [...data.budgets].sort((a, b) => a.sortOrder - b.sortOrder);
  const goals = data.accounts
    .filter((account) => isPocket(account) && account.archivedAt === null)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const canCreateGoal = pocketParentCandidates(data.accounts).length > 0;

  const categoryRows = (rows: typeof categories) =>
    rows.map((category) => (
      <ListRow
        key={category.id}
        icon={category.icon as IconName}
        colorIndex={category.colorIndex}
        title={category.name}
      />
    ));

  return (
    <>
      <Section open title={t('profile.title')}>
        <SummaryRow title={t('web.auth.nameLabel')} value={page.user.displayName} />
        <SummaryRow title={t('web.auth.emailLabel')} value={page.user.email} />
      </Section>

      {expenseCategories.length === 0 ? null : (
        <Section
          open
          title={`${t('categories.title')} · ${t('categories.expenses')}`}
          trailing={String(expenseCategories.length)}
        >
          {categoryRows(expenseCategories)}
        </Section>
      )}

      {incomeCategories.length === 0 ? null : (
        <Section
          open
          title={`${t('categories.title')} · ${t('categories.income')}`}
          trailing={String(incomeCategories.length)}
        >
          {categoryRows(incomeCategories)}
        </Section>
      )}

      <Section open title={t('budgets.title')} trailing={String(budgets.length)}>
        {budgets.length === 0 ? (
          <ListRow open href="/budgets?new" icon="plus" title={t('targets.createBudget')} />
        ) : (
          budgets.map((budget) => (
            <ListRow
              key={budget.id}
              href={`/budgets?b=${budget.id}`}
              icon={budget.icon as IconName}
              title={budget.name}
              trailing={
                <AmountText minor={budget.amount} currency={currency} locale={locale} muted />
              }
            />
          ))
        )}
      </Section>

      <Section open title={t('goals.title')} trailing={String(goals.length)}>
        {goals.length === 0 ? (
          canCreateGoal ? (
            <ListRow open href="/accounts?newGoal" icon="plus" title={t('goals.create')} />
          ) : null
        ) : (
          goals.map((goal) => (
            <ListRow
              key={goal.id}
              href={`/accounts?g=${goal.id}`}
              icon={goal.icon as IconName}
              colorIndex={goal.colorIndex}
              title={goal.name}
              trailing={
                <AmountText
                  minor={goal.goalTarget ?? 0}
                  currency={currency}
                  locale={locale}
                  muted
                />
              }
            />
          ))
        )}
      </Section>
    </>
  );
}
