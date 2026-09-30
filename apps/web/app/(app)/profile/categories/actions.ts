'use server';

import { requireWebUser } from '../../../../src/server/auth/currentUser';
import { getDb } from '../../../../src/server/db/client';
import {
  archiveCategory as archiveFor,
  type CategoryResult,
  type CategorySaveResult,
  reorderCategory as reorderFor,
  restoreCategory as restoreFor,
  saveCategory as saveFor,
} from '../../../../src/server/write/categories';

export async function saveCategoryAction(input: unknown): Promise<CategorySaveResult> {
  const user = await requireWebUser();
  return saveFor(getDb(), user.id, input, new Date());
}

export async function archiveCategoryAction(input: unknown): Promise<CategoryResult> {
  const user = await requireWebUser();
  return archiveFor(getDb(), user.id, input, new Date());
}

export async function restoreCategoryAction(id: string): Promise<CategoryResult> {
  const user = await requireWebUser();
  return restoreFor(getDb(), user.id, String(id), new Date());
}

export async function reorderCategoryAction(input: unknown): Promise<CategoryResult> {
  const user = await requireWebUser();
  return reorderFor(getDb(), user.id, input, new Date());
}
