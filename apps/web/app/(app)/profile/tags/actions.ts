'use server';

import { requireWebUser } from '../../../../src/server/auth/currentUser';
import { getDb } from '../../../../src/server/db/client';
import {
  deleteTag as deleteFor,
  mergeTags as mergeFor,
  type NewTagResult,
  newTag as newFor,
  renameTag as renameFor,
  type TagResult,
} from '../../../../src/server/write/tags';

/** §17.1.3: each action resolves the session itself and hands the rest to `src/server/write`. */
export async function newTagAction(name: string): Promise<NewTagResult> {
  const user = await requireWebUser();
  return newFor(getDb(), user.id, String(name), new Date());
}

export async function renameTagAction(input: unknown): Promise<TagResult> {
  const user = await requireWebUser();
  return renameFor(getDb(), user.id, input, new Date());
}

export async function mergeTagsAction(input: unknown): Promise<TagResult> {
  const user = await requireWebUser();
  return mergeFor(getDb(), user.id, input, new Date());
}

export async function deleteTagAction(id: string, updatedAt: string): Promise<TagResult> {
  const user = await requireWebUser();
  return deleteFor(getDb(), user.id, String(id), new Date(), String(updatedAt));
}
