'use server';

import { requireWebUser } from '../../../src/server/auth/currentUser';
import { getDb } from '../../../src/server/db/client';
import {
  type AccountResult,
  type AccountSaveResult,
  archiveAccount as archiveFor,
  restoreAccount as restoreFor,
  saveAccount as saveFor,
} from '../../../src/server/write/accounts';
import {
  closeGoal as closeFor,
  type GoalSaveResult,
  restoreGoal as restoreGoalFor,
  saveGoal as saveGoalFor,
} from '../../../src/server/write/goals';
import { postedVersion } from '../../../src/server/write/writeChanges';

export async function saveAccountAction(input: unknown): Promise<AccountSaveResult> {
  const user = await requireWebUser();
  return saveFor(getDb(), user.id, input, new Date());
}
export async function archiveAccountAction(id: string, updatedAt: string): Promise<AccountResult> {
  const user = await requireWebUser();
  return archiveFor(getDb(), user.id, String(id), new Date(), postedVersion(updatedAt));
}
export async function restoreAccountAction(id: string): Promise<AccountResult> {
  const user = await requireWebUser();
  return restoreFor(getDb(), user.id, String(id), new Date());
}
export async function saveGoalAction(input: unknown): Promise<GoalSaveResult> {
  const user = await requireWebUser();
  return saveGoalFor(getDb(), user.id, input, new Date());
}
export async function closeGoalAction(id: string, updatedAt: string): Promise<AccountResult> {
  const user = await requireWebUser();
  return closeFor(getDb(), user.id, String(id), new Date(), postedVersion(updatedAt));
}
export async function restoreGoalAction(id: string): Promise<AccountResult> {
  const user = await requireWebUser();
  return restoreGoalFor(getDb(), user.id, String(id), new Date());
}
