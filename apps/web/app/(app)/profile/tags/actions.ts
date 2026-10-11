'use server';

import { requireWebUser } from '../../../../src/server/auth/currentUser';
import { getDb } from '../../../../src/server/db/client';
import { refreshAfterWrite } from '../../../../src/server/page/refreshAfterWrite';
import {
  deleteTag as deleteFor,
  mergeTags as mergeFor,
  type NewTagResult,
  newTag as newFor,
  renameTag as renameFor,
  type TagResult,
} from '../../../../src/server/write/tags';
import { postedVersion } from '../../../../src/server/write/writeChanges';

/** §17.1.3: each action resolves the session itself and hands the rest to `src/server/write`. */
export async function newTagAction(name: string): Promise<NewTagResult> {
  const user = await requireWebUser();
  return refreshAfterWrite(await newFor(getDb(), user.id, String(name), new Date()));
}

export async function renameTagAction(input: unknown): Promise<TagResult> {
  const user = await requireWebUser();
  return refreshAfterWrite(await renameFor(getDb(), user.id, input, new Date()));
}

export async function mergeTagsAction(input: unknown): Promise<TagResult> {
  const user = await requireWebUser();
  return refreshAfterWrite(await mergeFor(getDb(), user.id, input, new Date()));
}

export async function deleteTagAction(id: string, updatedAt: string): Promise<TagResult> {
  const user = await requireWebUser();
  return refreshAfterWrite(
    await deleteFor(getDb(), user.id, String(id), new Date(), postedVersion(updatedAt)),
  );
}
