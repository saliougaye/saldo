import type { Messages } from '@saldo/i18n';

/**
 * The part of a catalog the transaction form reads (decision 7 of 0.3e-1): a client component gets
 * these namespaces, not the seven catalogs, and builds its own `t` over them with `makeTranslator`.
 */
export type FormMessages = Pick<Messages, 'txForm' | 'transactions' | 'common' | 'kinds'> & {
  web: Pick<Messages['web'], 'form'>;
  /** The edited row's archived account or category says so, as the filter menus do. */
  accounts: Pick<Messages['accounts'], 'archivedBadge'>;
  categories: Pick<Messages['categories'], 'archivedBadge'>;
};

export function formMessages(catalog: Messages): FormMessages {
  return {
    txForm: catalog.txForm,
    transactions: catalog.transactions,
    common: catalog.common,
    kinds: catalog.kinds,
    web: { form: catalog.web.form },
    accounts: { archivedBadge: catalog.accounts.archivedBadge },
    categories: { archivedBadge: catalog.categories.archivedBadge },
  };
}
