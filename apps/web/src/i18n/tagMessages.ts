import type { Messages } from '@saldo/i18n';

/** What the tag form and its merge and delete dialogs read (0.3e-1's decision 7): namespaces, not the catalog. */
export type TagMessages = Pick<Messages, 'tags' | 'common'> & {
  web: Pick<Messages['web'], 'tags' | 'form'>;
  csvImport: Pick<Messages['csvImport'], 'seeTransactions'>;
};

export function tagMessages(catalog: Messages): TagMessages {
  return {
    tags: catalog.tags,
    common: catalog.common,
    web: { tags: catalog.web.tags, form: catalog.web.form },
    csvImport: { seeTransactions: catalog.csvImport.seeTransactions },
  };
}
