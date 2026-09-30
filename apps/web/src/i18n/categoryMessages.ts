import type { Messages } from '@saldo/i18n';

/** What the category form, its archive dialog and the restore button read (0.3e-1's decision 7). */
export type CategoryMessages = Pick<Messages, 'common'> & {
  web: Pick<Messages['web'], 'categories' | 'form'>;
  categories: Pick<
    Messages['categories'],
    | 'name'
    | 'title'
    | 'expenses'
    | 'income'
    | 'parent'
    | 'noParent'
    | 'monthlyBudget'
    | 'icon'
    | 'colour'
    | 'missing_name'
  >;
};

export function categoryMessages(catalog: Messages): CategoryMessages {
  const c = catalog.categories;
  return {
    common: catalog.common,
    web: { categories: catalog.web.categories, form: catalog.web.form },
    categories: {
      name: c.name,
      title: c.title,
      expenses: c.expenses,
      income: c.income,
      parent: c.parent,
      noParent: c.noParent,
      monthlyBudget: c.monthlyBudget,
      icon: c.icon,
      colour: c.colour,
      missing_name: c.missing_name,
    },
  };
}
