import { z } from 'zod';
import { accountBalances, netWorth, spendableTotal } from '../../accounts';
import { accountTypeSchema } from '../../entities';
import { goalRatio } from '../../goals';
import { bankBalance, isPocket, pocketsOf } from '../../pockets';
import { moneySchema } from '../money';
import { bySortOrder } from '../sort';
import { READ_ANNOTATIONS, type ReadTool } from '../types';
import { toolUser } from '../user';

const input = z.object({
  includeArchived: z.boolean().default(false).describe('Also list archived accounts.'),
});

const pocketOutput = z.object({
  id: z.string(),
  name: z.string(),
  saved: moneySchema,
  target: moneySchema,
  ratio: z.number().describe('Saved over target, 0 to 1.'),
});

const accountOutput = z.object({
  id: z.string(),
  name: z.string(),
  type: accountTypeSchema,
  institution: z.string().nullable(),
  archived: z.boolean(),
  includeInSpendable: z.boolean(),
  balance: moneySchema.describe('What the bank shows: the account and its open pockets together.'),
  free: moneySchema.describe('The account without its pockets.'),
  pockets: z.array(pocketOutput),
});

const output = z.object({
  netWorth: moneySchema,
  spendable: moneySchema,
  accounts: z.array(accountOutput),
});

export type ListAccountsInput = z.infer<typeof input>;
export type ListAccountsOutput = z.infer<typeof output>;

export const listAccountsTool: ReadTool<ListAccountsInput, ListAccountsOutput> = {
  name: 'list_accounts',
  title: 'Accounts',
  description:
    "The user's accounts with today's balances, in the user's order. `balance` is what the bank shows (the account plus its open pockets); `free` is the account alone. Pockets are savings goals set aside inside an account. `netWorth` is every open account; `spendable` only those the user counts as spendable. Archived accounts only with includeArchived.",
  scope: 'read',
  input,
  output,
  annotations: READ_ANNOTATIONS,
  run(data, ctx, { includeArchived }) {
    const user = toolUser(data);
    const balances = accountBalances(data.accounts, data.transactions, ctx.today);
    const accounts = data.accounts
      .filter((account) => !isPocket(account) && (includeArchived || account.archivedAt === null))
      .sort(bySortOrder)
      .map((account) => ({
        id: account.id,
        name: account.name,
        type: account.type,
        institution: account.institution,
        archived: account.archivedAt !== null,
        includeInSpendable: account.includeInSpendable,
        balance: user.money(bankBalance(data.accounts, balances, account.id)),
        free: user.money(balances.get(account.id) ?? 0),
        pockets: pocketsOf(data.accounts, account.id).map((pocket) => {
          const saved = balances.get(pocket.id) ?? 0;
          const target = pocket.goalTarget ?? 0;
          return {
            id: pocket.id,
            name: pocket.name,
            saved: user.money(saved),
            target: user.money(target),
            ratio: goalRatio(saved, target),
          };
        }),
      }));
    return {
      netWorth: user.money(netWorth(data.accounts, balances)),
      spendable: user.money(spendableTotal(data.accounts, balances)),
      accounts,
    };
  },
};
