import { createClock } from '../clock';
import { createKvStore } from '../kv';
import { createAccountsRepository } from './accounts';
import { createAttachmentsRepository } from './attachments';
import { createBudgetsRepository } from './budgets';
import { createCategoriesRepository } from './categories';
import { createRecurrencesRepository } from './recurrences';
import { createSettingsRepository } from './settings';
import type { RepositoryContext, RepositoryDatabase } from './support';
import { createTagsRepository } from './tags';
import { createTransactionsRepository } from './transactions';

export * from './accounts';
export * from './attachments';
export * from './budgets';
export * from './categories';
export * from './recurrences';
export * from './settings';
export * from './support';
export * from './tags';
export * from './transactions';

export interface Repositories {
  settings: ReturnType<typeof createSettingsRepository>;
  accounts: ReturnType<typeof createAccountsRepository>;
  categories: ReturnType<typeof createCategoriesRepository>;
  transactions: ReturnType<typeof createTransactionsRepository>;
  tags: ReturnType<typeof createTagsRepository>;
  budgets: ReturnType<typeof createBudgetsRepository>;
  recurrences: ReturnType<typeof createRecurrencesRepository>;
  attachments: ReturnType<typeof createAttachmentsRepository>;
}

/** Builds every repository over one database handle and one clock. */
export function createRepositories(db: RepositoryDatabase, nowIso?: () => string): Repositories {
  const clock = createClock(createKvStore(db));
  const context: RepositoryContext = nowIso === undefined ? { db, clock } : { db, clock, nowIso };
  return {
    settings: createSettingsRepository(context),
    accounts: createAccountsRepository(context),
    categories: createCategoriesRepository(context),
    transactions: createTransactionsRepository(context),
    tags: createTagsRepository(context),
    budgets: createBudgetsRepository(context),
    recurrences: createRecurrencesRepository(context),
    attachments: createAttachmentsRepository(context),
  };
}
