'use server';

import { requireWebUser } from '../../../../src/server/auth/currentUser';
import { getDb } from '../../../../src/server/db/client';
import { refreshAfterWrite } from '../../../../src/server/page/refreshAfterWrite';
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
  return refreshAfterWrite(await saveFor(getDb(), user.id, input, new Date()));
}

export async function archiveCategoryAction(input: unknown): Promise<CategoryResult> {
  const user = await requireWebUser();
  return refreshAfterWrite(await archiveFor(getDb(), user.id, input, new Date()));
}

export async function restoreCategoryAction(id: string): Promise<CategoryResult> {
  const user = await requireWebUser();
  return refreshAfterWrite(await restoreFor(getDb(), user.id, String(id), new Date()));
}

export async function reorderCategoryAction(input: unknown): Promise<CategoryResult> {
  const user = await requireWebUser();
  return refreshAfterWrite(await reorderFor(getDb(), user.id, input, new Date()));
}
