import { z } from 'zod';
import { recurrenceFrequencySchema, transactionKindSchema } from '../../entities';
import { isUpcoming } from '../../ledger';
import { nextOccurrence, recurringMonthlyTotals } from '../../recurrence';
import { moneySchema } from '../money';
import { toolDateSchema } from '../schemas';
import { binary } from '../sort';
import { READ_ANNOTATIONS, type ReadTool } from '../types';
import { toolUser } from '../user';

const input = z.object({});

/** What both kinds of item say, named as list_transactions names them. */
const itemFields = {
  id: z.string(),
  transactionKind: transactionKindSchema.describe(
    'Which way the money goes: an expense, an income or a transfer (`kind` in list_transactions).',
  ),
  amount: moneySchema,
  description: z.string(),
  accountId: z.string(),
  accountName: z.string().nullable(),
  toAccountId: z.string().nullable(),
  toAccountName: z.string().nullable(),
  categoryId: z.string().nullable(),
  categoryName: z.string().nullable(),
};

const recurrenceItem = z.object({
  kind: z.literal('recurrence'),
  date: toolDateSchema.describe('The next date the recurrence fires, after today.'),
  ...itemFields,
  frequency: recurrenceFrequencySchema,
  interval: z.number().int().describe('Every `interval` units of `frequency`.'),
  startDate: toolDateSchema,
  endDate: toolDateSchema.nullable(),
});

const transactionItem = z.object({
  kind: z.literal('transaction'),
  date: toolDateSchema.describe('The date it is scheduled for, after today.'),
  ...itemFields,
  note: z.string().nullable(),
  excludeFromTotals: z.boolean(),
});

const output = z.object({
  monthly: z
    .object({ expense: moneySchema, income: moneySchema })
    .describe('What the live recurrences add up to in an average month.'),
  items: z
    .array(z.discriminatedUnion('kind', [recurrenceItem, transactionItem]))
    .describe(
      'Soonest first. `kind` "recurrence": a recurring transaction, at its next date; "transaction": a one-off transaction dated after today.',
    ),
});

export type ListUpcomingInput = z.infer<typeof input>;
export type ListUpcomingOutput = z.infer<typeof output>;
type UpcomingItem = ListUpcomingOutput['items'][number];

export const listUpcomingTool: ReadTool<ListUpcomingInput, ListUpcomingOutput> = {
  name: 'list_upcoming',
  title: 'Upcoming transactions',
  description:
    'What is scheduled after today, soonest first: each recurring transaction that has not ended, at the next date it fires (`kind` "recurrence"), and each one-off transaction dated after today (`kind` "transaction"). Also what the recurrences add up to in an average month. Recurrences that already ended are left out; an occurrence of a recurrence is listed once, as the recurrence.',
  scope: 'read',
  input,
  output,
  annotations: READ_ANNOTATIONS,
  run(data, ctx) {
    const user = toolUser(data);
    const accounts = new Map(data.accounts.map((account) => [account.id, account.name]));
    const categories = new Map(data.categories.map((category) => [category.id, category.name]));
    const accountName = (id: string) => accounts.get(id) ?? null;
    const toAccountName = (id: string | null) => (id === null ? null : accountName(id));
    const categoryName = (id: string | null) => (id === null ? null : (categories.get(id) ?? null));
    // The phone's «Ricorrenti» (§6.33): `nextOccurrence` after today, for the live ones.
    const live = data.recurrences.flatMap((recurrence) => {
      if (recurrence.deletedAt !== null) return [];
      const next = nextOccurrence(recurrence, ctx.today);
      return next === null ? [] : [{ recurrence, next }];
    });
    const monthly = recurringMonthlyTotals(live.map((entry) => entry.recurrence));
    const recurrences = live.map(({ recurrence, next }): UpcomingItem => {
      const { template } = recurrence;
      return {
        kind: 'recurrence',
        id: recurrence.id,
        date: next,
        transactionKind: template.kind,
        amount: user.money(template.amount),
        description: template.description,
        accountId: template.accountId,
        accountName: accountName(template.accountId),
        toAccountId: template.toAccountId,
        toAccountName: toAccountName(template.toAccountId),
        categoryId: template.categoryId,
        categoryName: categoryName(template.categoryId),
        frequency: recurrence.frequency,
        interval: recurrence.interval,
        startDate: recurrence.startDate,
        endDate: recurrence.endDate,
      };
    });
    // One-off rows only (decided 2026-10-03): a materialised occurrence is the recurrence's own,
    // already listed above at its next date.
    const oneOff = data.transactions
      .filter(
        (tx) => tx.deletedAt === null && tx.recurrenceId === null && isUpcoming(tx, ctx.today),
      )
      .map(
        (tx): UpcomingItem => ({
          kind: 'transaction',
          id: tx.id,
          date: tx.date,
          transactionKind: tx.kind,
          amount: user.money(tx.amount),
          description: tx.description,
          note: tx.note,
          accountId: tx.accountId,
          accountName: accountName(tx.accountId),
          toAccountId: tx.toAccountId,
          toAccountName: toAccountName(tx.toAccountId),
          categoryId: tx.categoryId,
          categoryName: categoryName(tx.categoryId),
          excludeFromTotals: tx.excludeFromTotals,
        }),
      );
    return {
      monthly: { expense: user.money(monthly.expense), income: user.money(monthly.income) },
      items: [...oneOff, ...recurrences].sort(
        (a, b) => binary(a.date, b.date) || binary(a.kind, b.kind) || binary(a.id, b.id),
      ),
    };
  },
};
