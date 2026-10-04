import { z } from 'zod';
import type { WriteToolSpec } from '../types';
import {
  idField,
  type RemovedOutput,
  type ResolveResult,
  removedOutput,
  type SavedOutput,
  savedOutput,
  updatedAtField,
  versionPairing,
  writeAnnotations,
} from './shared';

export const saveTagInput = z.object({
  id: idField.optional().describe('Omit to create. To rename a tag, its id from list_tags.'),
  updatedAt: updatedAtField.optional(),
  name: z.string().trim().min(1).max(40),
});
export type SaveTagInput = z.infer<typeof saveTagInput>;

export type TagWriteRequest =
  | { action: 'create'; name: string }
  | { action: 'rename'; id: string; name: string; expectedUpdatedAt: string };

/** Create (`createTag`, which answers the tag that already has the name) or rename (`renameTag`). */
export function resolveTagInput(input: SaveTagInput): ResolveResult<TagWriteRequest> {
  const pairing = versionPairing(input);
  if (pairing !== null) return { ok: false, message: pairing };
  if (input.id === undefined || input.updatedAt === undefined) {
    return { ok: true, value: { action: 'create', name: input.name } };
  }
  return {
    ok: true,
    value: { action: 'rename', id: input.id, name: input.name, expectedUpdatedAt: input.updatedAt },
  };
}

export const saveTagTool: WriteToolSpec<SaveTagInput, SavedOutput> = {
  name: 'save_tag',
  title: 'Save a tag',
  description:
    'Create a tag, or rename one. To create: pass name only; if a tag with that name already exists (ignoring case), that tag is returned with created false and nothing is written. To rename: pass its id and updatedAt exactly as list_tags returned them, and the new name; every transaction keeps the tag. Names are unique ignoring case, at most 40 characters. Returns the id and the new updatedAt.',
  scope: 'write',
  input: saveTagInput,
  output: savedOutput,
  annotations: writeAnnotations(false, true),
};

export const mergeTagsInput = z.object({
  sourceId: idField.describe('The tag that disappears, from list_tags.'),
  sourceUpdatedAt: updatedAtField,
  targetId: idField.describe('The tag that stays, from list_tags.'),
});
export type MergeTagsInput = z.infer<typeof mergeTagsInput>;

export const mergeTagsOutput = z.object({ sourceId: z.string(), targetId: z.string() });
export type MergeTagsOutput = z.infer<typeof mergeTagsOutput>;

export const mergeTagsTool: WriteToolSpec<MergeTagsInput, MergeTagsOutput> = {
  name: 'merge_tags',
  title: 'Merge two tags',
  description:
    'Merge one tag into another: every transaction and recurring template carrying the source tag gets the target tag instead (once), and the source tag is deleted, all in one write. Pass sourceId with sourceUpdatedAt exactly as list_tags returned them, and targetId from list_tags. It cannot be undone.',
  scope: 'write',
  input: mergeTagsInput,
  output: mergeTagsOutput,
  annotations: writeAnnotations(true, true),
};

export const deleteTagInput = z.object({
  id: idField.describe('The tag id from list_tags.'),
  updatedAt: updatedAtField,
});
export type DeleteTagInput = z.infer<typeof deleteTagInput>;

export const deleteTagTool: WriteToolSpec<DeleteTagInput, RemovedOutput> = {
  name: 'delete_tag',
  title: 'Delete a tag',
  description:
    'Delete a tag: it is removed from every transaction and recurring template that carries it, then deleted, in one write. Pass its id and updatedAt exactly as list_tags returned them. The transactions themselves stay.',
  scope: 'write',
  input: deleteTagInput,
  output: removedOutput,
  annotations: writeAnnotations(true, true),
};
