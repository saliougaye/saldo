'use server';

import { requireWebUser } from '../../../../src/server/auth/currentUser';
import { getDb } from '../../../../src/server/db/client';
import {
  type BudgetResult,
  type BudgetSaveResult,
  deleteBudget as deleteFor,
  saveBudget as saveFor,
} from '../../../../src/server/write/budgets';

export async function saveBudgetAction(input: unknown): Promise<BudgetSaveResult> {
  const user = await requireWebUser();
  return saveFor(getDb(), user.id, input, new Date());
}

export async function deleteBudgetAction(id: string): Promise<BudgetResult> {
  const user = await requireWebUser();
  return deleteFor(getDb(), user.id, String(id), new Date());
}
