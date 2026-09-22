import type {
  AccountType,
  BudgetPeriod,
  CurrencyCode,
  PeriodKind,
  Recurrence,
  RecurrenceFrequency,
  Settings,
} from '@saldo/core';
import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Columns every synced table carries (§7). `updatedAt` is an HLC string, not a timestamp, so it is
 * compared lexicographically. `syncState` 0 = synced, 1 = pending push.
 */
const syncMeta = {
  id: text('id').primaryKey(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
  syncState: integer('sync_state').notNull().default(1),
};

export const settings = sqliteTable(
  'settings',
  {
    ...syncMeta,
    /** Always the literal `settings`: this table holds one row (§4). */
    id: text('id').$type<'settings'>().primaryKey(),
    periodKind: text('period_kind').$type<PeriodKind>().notNull(),
    cycleStartDay: integer('cycle_start_day').notNull(),
    currency: text('currency').$type<CurrencyCode>().notNull(),
    language: text('language').$type<Settings['language']>().notNull(),
    theme: text('theme').$type<'system' | 'dark' | 'light'>().notNull(),
    onboardingCompletedAt: text('onboarding_completed_at'),
  },
  (table) => [index('settings_pending').on(table.syncState).where(sql`sync_state = 1`)],
);

export const accounts = sqliteTable(
  'accounts',
  {
    ...syncMeta,
    name: text('name').notNull(),
    type: text('type').$type<AccountType>().notNull(),
    institution: text('institution'),
    openingBalance: integer('opening_balance').notNull(),
    includeInSpendable: integer('include_in_spendable', { mode: 'boolean' }).notNull(),
    colorIndex: integer('color_index').notNull(),
    icon: text('icon').notNull(),
    creditCloseDay: integer('credit_close_day'),
    creditChargeDay: integer('credit_charge_day'),
    creditPaymentAccountId: text('credit_payment_account_id'),
    archivedAt: text('archived_at'),
    sortOrder: integer('sort_order').notNull(),
  },
  (table) => [index('accounts_pending').on(table.syncState).where(sql`sync_state = 1`)],
);

export const categories = sqliteTable(
  'categories',
  {
    ...syncMeta,
    name: text('name').notNull(),
    direction: text('direction').$type<'expense' | 'income'>().notNull(),
    parentId: text('parent_id'),
    icon: text('icon').notNull(),
    colorIndex: integer('color_index').notNull(),
    archivedAt: text('archived_at'),
    sortOrder: integer('sort_order').notNull(),
  },
  (table) => [
    index('categories_parent').on(table.parentId),
    index('categories_pending').on(table.syncState).where(sql`sync_state = 1`),
  ],
);

export const tags = sqliteTable(
  'tags',
  {
    ...syncMeta,
    name: text('name').notNull(),
  },
  (table) => [index('tags_pending').on(table.syncState).where(sql`sync_state = 1`)],
);

export const transactions = sqliteTable(
  'transactions',
  {
    ...syncMeta,
    kind: text('kind').$type<'expense' | 'income' | 'transfer'>().notNull(),
    amount: integer('amount').notNull(),
    date: text('date').notNull(),
    accountId: text('account_id').notNull(),
    toAccountId: text('to_account_id'),
    categoryId: text('category_id'),
    description: text('description').notNull(),
    note: text('note'),
    tagIds: text('tag_ids', { mode: 'json' }).$type<string[]>().notNull(),
    excludeFromTotals: integer('exclude_from_totals', { mode: 'boolean' }).notNull(),
    recurrenceId: text('recurrence_id'),
  },
  (table) => [
    index('transactions_date').on(table.date),
    index('transactions_account_date').on(table.accountId, table.date),
    index('transactions_category_date').on(table.categoryId, table.date),
    index('transactions_recurrence').on(table.recurrenceId),
    index('transactions_pending').on(table.syncState).where(sql`sync_state = 1`),
  ],
);

export const recurrences = sqliteTable(
  'recurrences',
  {
    ...syncMeta,
    frequency: text('frequency').$type<RecurrenceFrequency>().notNull(),
    interval: integer('interval').notNull().default(1),
    startDate: text('start_date').notNull(),
    endDate: text('end_date'),
    template: text('template', { mode: 'json' }).$type<Recurrence['template']>().notNull(),
  },
  (table) => [index('recurrences_pending').on(table.syncState).where(sql`sync_state = 1`)],
);

export const budgets = sqliteTable(
  'budgets',
  {
    ...syncMeta,
    name: text('name').notNull(),
    categoryIds: text('category_ids', { mode: 'json' }).$type<string[]>().notNull(),
    amount: integer('amount').notNull(),
    period: text('period').$type<BudgetPeriod>().notNull(),
    alertThreshold: integer('alert_threshold'),
    rollover: integer('rollover', { mode: 'boolean' }).notNull(),
    icon: text('icon').notNull(),
    sortOrder: integer('sort_order').notNull(),
  },
  (table) => [index('budgets_pending').on(table.syncState).where(sql`sync_state = 1`)],
);

export const attachments = sqliteTable(
  'attachments',
  {
    ...syncMeta,
    transactionId: text('transaction_id').notNull(),
    mimeType: text('mime_type').$type<'image/jpeg' | 'image/png' | 'application/pdf'>().notNull(),
    byteSize: integer('byte_size').notNull(),
    sha256: text('sha256').notNull(),
    width: integer('width'),
    height: integer('height'),
    /** Local cache path; device-only, never pushed. */
    localUri: text('local_uri'),
    /**
     * Whether this device's copy of the bytes has reached the server (§10). Device-local on
     * purpose: if it synced, a second device would inherit the belief that it holds a file it has
     * never seen.
     */
    blobState: text('blob_state')
      .$type<'local_only' | 'synced' | 'failed'>()
      .notNull()
      .default('local_only'),
  },
  (table) => [
    index('attachments_transaction').on(table.transactionId),
    index('attachments_pending').on(table.syncState).where(sql`sync_state = 1`),
  ],
);

/** Device-local key/value store (§7). Not synced. */
export const kv = sqliteTable('kv', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const syncedTables = {
  settings,
  accounts,
  categories,
  tags,
  transactions,
  recurrences,
  budgets,
  attachments,
} as const;

export const schema = { ...syncedTables, kv } as const;
