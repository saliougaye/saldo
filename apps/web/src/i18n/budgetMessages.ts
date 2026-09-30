import type { Messages } from '@saldo/i18n';

/** What the budget form and its delete dialog read (0.3e-1's decision 7): namespaces, not the catalog. */
export type BudgetMessages = Pick<Messages, 'budgets' | 'common'> & {
  web: Pick<Messages['web'], 'budgets' | 'form'>;
};

export function budgetMessages(catalog: Messages): BudgetMessages {
  return {
    budgets: catalog.budgets,
    common: catalog.common,
    web: { budgets: catalog.web.budgets, form: catalog.web.form },
  };
}
