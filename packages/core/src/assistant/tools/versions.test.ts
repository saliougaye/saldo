import { describe, expect, it } from 'vitest';
import { CONTEXT, fixtureData } from '../__fixtures__/userData';
import { listAccountsTool } from './listAccounts';
import { listBudgetsTool } from './listBudgets';
import { listCategoriesTool } from './listCategories';
import { listGoalsTool } from './listGoals';
import { listTagsTool } from './listTags';
import { listTransactionsTool } from './listTransactions';

const data = fixtureData();

const stampOf = (rows: readonly { id: string; updatedAt: string }[], id: string) =>
  rows.find((row) => row.id === id)?.updatedAt;

describe("the list tools hand out each row's updatedAt (0.4b's write tools take it back)", () => {
  it('list_accounts, for the accounts and their pockets', () => {
    const { accounts } = listAccountsTool.run(data, CONTEXT, { includeArchived: true });
    expect(accounts.some((account) => account.pockets.length > 0)).toBe(true);
    for (const account of accounts) {
      expect(account.updatedAt).toBe(stampOf(data.accounts, account.id));
      for (const pocket of account.pockets) {
        expect(pocket.updatedAt).toBe(stampOf(data.accounts, pocket.id));
      }
    }
  });

  it('list_categories and list_tags', () => {
    const { categories } = listCategoriesTool.run(data, CONTEXT, { includeArchived: true });
    for (const category of categories) {
      expect(category.updatedAt).toBe(stampOf(data.categories, category.id));
    }
    const { tags } = listTagsTool.run(data, CONTEXT, {});
    expect(tags.length).toBeGreaterThan(0);
    for (const tag of tags) expect(tag.updatedAt).toBe(stampOf(data.tags, tag.id));
  });

  it('list_transactions', () => {
    const { transactions } = listTransactionsTool.run(data, CONTEXT, { limit: 200, offset: 0 });
    expect(transactions.length).toBeGreaterThan(0);
    for (const tx of transactions) expect(tx.updatedAt).toBe(stampOf(data.transactions, tx.id));
  });

  it('list_budgets and list_goals (a goal is its pocket account)', () => {
    const { budgets } = listBudgetsTool.run(data, CONTEXT, {});
    expect(budgets.length).toBeGreaterThan(0);
    for (const budget of budgets) expect(budget.updatedAt).toBe(stampOf(data.budgets, budget.id));
    const { goals } = listGoalsTool.run(data, CONTEXT, {});
    expect(goals.length).toBeGreaterThan(0);
    for (const goal of goals) expect(goal.updatedAt).toBe(stampOf(data.accounts, goal.id));
  });
});
