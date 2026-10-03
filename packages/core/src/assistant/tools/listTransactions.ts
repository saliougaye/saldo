import { z } from 'zod';
import { isWithin } from '../../cycle';
import { transactionKindSchema } from '../../entities';
import { type FilterLookup, filterTransactions, type TransactionFilters } from '../../filters';
import { isUpcoming, splitUpcoming, totalsOf } from '../../ledger';
import { newestFirst } from '../../order';
import { moneySchema } from '../money';
import { checkToolPeriod, resolveToolPeriod, toolPeriodShape } from '../period';
import { dateRangeSchema, toolDateSchema } from '../schemas';
import { READ_ANNOTATIONS, type ReadTool } from '../types';
import { toolUser } from '../user';

/** §17.4.2: at most 200 rows a call; `offset` pages through the rest. */
export const MAX_TRANSACTIONS_LIMIT = 200;

const input = z
  .object({
    ...toolPeriodShape,
    kind: transactionKindSchema
      .optional()
      .describe('Only expenses, only income or only transfers.'),
    accountId: z
      .string()
      .min(1)
      .optional()
      .describe('Only rows moving money in or out of this account (either side of a transfer).'),
    categoryId: z
      .string()
      .min(1)
      .optional()
      .describe('Only rows in this category or, for a top-level category, in one of its children.'),
    tagId: z.string().min(1).optional().describe('Only rows carrying this tag.'),
    text: z
      .string()
      .max(100)
      .optional()
      .describe(
        'Words to find in the description, the category name or the account names; case and accents are ignored.',
      ),
    limit: z.number().int().min(1).max(MAX_TRANSACTIONS_LIMIT).default(50),
    offset: z.number().int().min(0).default(0),
  })
  .superRefine(checkToolPeriod);

const transactionOutput = z.object({
  id: z.string(),
  date: toolDateSchema,
  kind: transactionKindSchema,
  amount: moneySchema,
  description: z.string(),
  note: z.string().nullable(),
  accountId: z.string(),
  accountName: z.string().nullable(),
  toAccountId: z.string().nullable(),
  toAccountName: z.string().nullable(),
  categoryId: z.string().nullable(),
  categoryName: z.string().nullable(),
  tagIds: z.array(z.string()),
  tagNames: z.array(z.string()),
  excludeFromTotals: z.boolean(),
  recurring: z.boolean(),
  upcoming: z.boolean().describe('Dated after today: scheduled, not counted yet.'),
});

const output = z.object({
  period: dateRangeSchema,
  total: z.number().int().describe('How many rows match, over every page.'),
  offset: z.number().int(),
  limit: z.number().int(),
  totals: z
    .object({ expense: moneySchema, income: moneySchema, count: z.number().int() })
    .describe(
      'What the matching rows dated up to today add up to, excluded ones included and transfers in neither side: the line above the app’s filtered list.',
    ),
  transactions: z.array(transactionOutput),
});

export type ListTransactionsInput = z.infer<typeof input>;
export type ListTransactionsOutput = z.infer<typeof output>;

export const listTransactionsTool: ReadTool<ListTransactionsInput, ListTransactionsOutput> = {
  name: 'list_transactions',
  title: 'Transactions',
  description:
    'The transactions of a period (default: the current one), newest first, with optional filters by kind, account, category (children included), tag and text. Returns at most `limit` rows (up to 200) from `offset`, and `total`, the number of matching rows. Rows dated after today are scheduled (`upcoming`). For income and spending totals use get_period_summary or spending_by_category instead of adding rows up.',
  scope: 'read',
  input,
  output,
  annotations: READ_ANNOTATIONS,
  run(data, ctx, input) {
    const user = toolUser(data);
    const range = resolveToolPeriod(input, data, ctx);
    const accounts = new Map(data.accounts.map((account) => [account.id, account]));
    const categories = new Map(data.categories.map((category) => [category.id, category]));
    const tags = new Map(data.tags.map((tag) => [tag.id, tag]));
    const lookup: FilterLookup = {
      accountName: (id) => accounts.get(id)?.name ?? '',
      categoryName: (id) => categories.get(id)?.name ?? '',
      categoryParentId: (id) => categories.get(id)?.parentId ?? null,
    };
    const filters: TransactionFilters = {
      query: input.text ?? '',
      accountId: input.accountId ?? null,
      categoryId: input.categoryId ?? null,
      direction: input.kind ?? 'all',
      tagIds: input.tagId === undefined ? [] : [input.tagId],
      onlyExcluded: false,
    };
    // The order the phone's query returns, byte for byte (see `newestFirst`).
    const inRange = data.transactions.filter((tx) => isWithin(range, tx.date)).sort(newestFirst);
    const matched = filterTransactions(inRange, filters, lookup);
    const totals = totalsOf(splitUpcoming(matched, ctx.today).settled);
    return {
      period: range,
      total: matched.length,
      offset: input.offset,
      limit: input.limit,
      totals: {
        expense: user.money(totals.expense),
        income: user.money(totals.income),
        count: totals.count,
      },
      transactions: matched.slice(input.offset, input.offset + input.limit).map((tx) => ({
        id: tx.id,
        date: tx.date,
        kind: tx.kind,
        amount: user.money(tx.amount),
        description: tx.description,
        note: tx.note,
        accountId: tx.accountId,
        accountName: accounts.get(tx.accountId)?.name ?? null,
        toAccountId: tx.toAccountId,
        toAccountName:
          tx.toAccountId === null ? null : (accounts.get(tx.toAccountId)?.name ?? null),
        categoryId: tx.categoryId,
        categoryName: tx.categoryId === null ? null : (categories.get(tx.categoryId)?.name ?? null),
        tagIds: tx.tagIds,
        tagNames: tx.tagIds.flatMap((id) => {
          const found = tags.get(id);
          return found === undefined ? [] : [found.name];
        }),
        excludeFromTotals: tx.excludeFromTotals,
        recurring: tx.recurrenceId !== null,
        upcoming: isUpcoming(tx, ctx.today),
      })),
    };
  },
};
