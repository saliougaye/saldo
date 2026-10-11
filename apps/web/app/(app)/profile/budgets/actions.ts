'use server';

import { requireWebUser } from '../../../../src/server/auth/currentUser';
import { getDb } from '../../../../src/server/db/client';
import { refreshAfterWrite } from '../../../../src/server/page/refreshAfterWrite';
import {
  type BudgetResult,
  type BudgetSaveResult,
  deleteBudget as deleteFor,
  saveBudget as saveFor,
} from '../../../../src/server/write/budgets';
import { postedVersion } from '../../../../src/server/write/writeChanges';

export async function saveBudgetAction(input: unknown): Promise<BudgetSaveResult> {
  const user = await requireWebUser();
  return refreshAfterWrite(await saveFor(getDb(), user.id, input, new Date()));
}

export async function deleteBudgetAction(id: string, updatedAt: string): Promise<BudgetResult> {
  const user = await requireWebUser();
  return refreshAfterWrite(
    await deleteFor(getDb(), user.id, String(id), new Date(), postedVersion(updatedAt)),
  );
}
