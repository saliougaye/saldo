import {
  type DeleteBudgetInput,
  deleteBudgetTool,
  type RemovedOutput,
  resolveBudgetInput,
  type SaveBudgetInput,
  type SavedOutput,
  saveBudgetTool,
} from '@saldo/core';
import { getDb } from '../../db/client';
import { readUserData } from '../../userData/read';
import * as writes from '../../write/budgets';
import type { WriteToolHandler } from '../types';
import { type Clock, minorDigitsOf, refuse, saved } from './shared';

/** §17.4.2: `save_budget` and `delete_budget` on the budget form's write functions. */
export function budgetHandlers(clock: Clock) {
  const saveBudget: WriteToolHandler<SaveBudgetInput, SavedOutput> = {
    spec: saveBudgetTool,
    async handle(principal, input) {
      const data = await readUserData(getDb(), principal.userId);
      const existing =
        input.id === undefined ? null : (data.budgets.find((row) => row.id === input.id) ?? null);
      if (input.id !== undefined && existing === null) {
        return refuse('budget', { error: 'notFound' });
      }
      const resolved = resolveBudgetInput(input, existing, data.categories, minorDigitsOf(data));
      if (!resolved.ok) return resolved;
      const values: writes.BudgetInput = resolved.value;
      const result = await writes.saveBudget(getDb(), principal.userId, values, clock());
      if (!result.ok) return refuse('budget', result);
      return saved('budget', 'budget', principal.userId, result.id, existing === null);
    },
  };

  const deleteBudget: WriteToolHandler<DeleteBudgetInput, RemovedOutput> = {
    spec: deleteBudgetTool,
    async handle(principal, input) {
      const result = await writes.deleteBudget(
        getDb(),
        principal.userId,
        input.id,
        clock(),
        input.updatedAt,
      );
      if (!result.ok) return refuse('budget', result);
      return { ok: true, value: { id: input.id } };
    },
  };

  return { saveBudget, deleteBudget };
}
