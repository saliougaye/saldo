'use server';

import { requireWebUser } from '../../../src/server/auth/currentUser';
import { getDb } from '../../../src/server/db/client';
import { refreshAfterWrite } from '../../../src/server/page/refreshAfterWrite';
import { createTag as createTagFor } from '../../../src/server/write/tags';
import {
  deleteTransaction as deleteFor,
  type Result,
  restoreTransaction as restoreFor,
  type SaveResult,
  saveTransaction as saveFor,
} from '../../../src/server/write/transactions';
import { postedVersion } from '../../../src/server/write/writeChanges';

/**
 * §17.1.3: the form's writes. Each resolves the session itself — a Server Action is a public
 * endpoint, whatever page rendered the button — and hands the rest to `src/server/write`.
 */
export async function saveTransactionAction(input: unknown): Promise<SaveResult> {
  const user = await requireWebUser();
  return refreshAfterWrite(await saveFor(getDb(), user.id, input, new Date()));
}

export async function deleteTransactionAction(id: string, updatedAt: string): Promise<Result> {
  const user = await requireWebUser();
  return refreshAfterWrite(
    await deleteFor(getDb(), user.id, String(id), new Date(), postedVersion(updatedAt)),
  );
}

export async function restoreTransactionAction(id: string): Promise<Result> {
  const user = await requireWebUser();
  return refreshAfterWrite(await restoreFor(getDb(), user.id, String(id), new Date()));
}

export async function createTagAction(name: string) {
  const user = await requireWebUser();
  return createTagFor(getDb(), user.id, String(name), new Date());
}
