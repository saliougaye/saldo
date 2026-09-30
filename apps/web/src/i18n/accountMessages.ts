import type { Messages } from '@saldo/i18n';

/** What the account, goal and archive components read (0.3e-1's decision 7): namespaces, not the catalog. */
export type AccountMessages = Pick<Messages, 'accounts' | 'accountTypes' | 'goals' | 'common'> & {
  web: Pick<Messages['web'], 'accounts' | 'form'>;
  /** The card's day selects offer «Nessuno» as the phone's `day()` does. */
  categories: Pick<Messages['categories'], 'noParent'>;
};

export function accountMessages(catalog: Messages): AccountMessages {
  return {
    accounts: catalog.accounts,
    accountTypes: catalog.accountTypes,
    goals: catalog.goals,
    common: catalog.common,
    web: { accounts: catalog.web.accounts, form: catalog.web.form },
    categories: { noParent: catalog.categories.noParent },
  };
}
