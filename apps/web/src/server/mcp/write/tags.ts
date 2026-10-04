import {
  type DeleteTagInput,
  deleteTagTool,
  type MergeTagsInput,
  type MergeTagsOutput,
  mergeTagsTool,
  type RemovedOutput,
  resolveTagInput,
  type SavedOutput,
  type SaveTagInput,
  saveTagTool,
} from '@saldo/core';
import { getDb } from '../../db/client';
import * as writes from '../../write/tags';
import type { WriteToolHandler } from '../types';
import { type Clock, refuse, saved } from './shared';

/** §17.4.2: `save_tag`, `merge_tags`, `delete_tag` on Profilo → Tag's write functions. */
export function tagHandlers(clock: Clock) {
  const saveTag: WriteToolHandler<SaveTagInput, SavedOutput> = {
    spec: saveTagTool,
    async handle(principal, input) {
      const request = resolveTagInput(input);
      if (!request.ok) return request;
      if (request.value.action === 'create') {
        const result = await writes.createTag(
          getDb(),
          principal.userId,
          request.value.name,
          clock(),
        );
        if (!result.ok) return refuse('tag', result);
        return saved('tag', 'tag', principal.userId, result.tag.id, result.created);
      }
      const { id, name, expectedUpdatedAt } = request.value;
      const result = await writes.renameTag(
        getDb(),
        principal.userId,
        { id, name, expectedUpdatedAt },
        clock(),
      );
      if (!result.ok) return refuse('tag', result);
      return saved('tag', 'tag', principal.userId, id, false);
    },
  };

  const mergeTags: WriteToolHandler<MergeTagsInput, MergeTagsOutput> = {
    spec: mergeTagsTool,
    async handle(principal, input) {
      const result = await writes.mergeTags(
        getDb(),
        principal.userId,
        {
          sourceId: input.sourceId,
          targetId: input.targetId,
          expectedUpdatedAt: input.sourceUpdatedAt,
        },
        clock(),
      );
      if (!result.ok) return refuse('tag', result);
      return { ok: true, value: { sourceId: input.sourceId, targetId: input.targetId } };
    },
  };

  const deleteTag: WriteToolHandler<DeleteTagInput, RemovedOutput> = {
    spec: deleteTagTool,
    async handle(principal, input) {
      const result = await writes.deleteTag(
        getDb(),
        principal.userId,
        input.id,
        clock(),
        input.updatedAt,
      );
      if (!result.ok) return refuse('tag', result);
      return { ok: true, value: { id: input.id } };
    },
  };

  return { saveTag, mergeTags, deleteTag };
}
