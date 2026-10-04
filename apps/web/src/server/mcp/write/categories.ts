import {
  type ArchiveCategoryInput,
  type ArchivedOutput,
  archiveCategoryTool,
  categoryArchiveRequest,
  resolveCategoryInput,
  type SaveCategoryInput,
  type SavedOutput,
  saveCategoryTool,
} from '@saldo/core';
import { getDb } from '../../db/client';
import { readUserData } from '../../userData/read';
import * as writes from '../../write/categories';
import type { WriteToolHandler } from '../types';
import { archivedState, type Clock, minorDigitsOf, refuse, saved } from './shared';

/** §17.4.2: `save_category` and `archive_category` (with §6's move) on the category writes. */
export function categoryHandlers(clock: Clock) {
  const saveCategory: WriteToolHandler<SaveCategoryInput, SavedOutput> = {
    spec: saveCategoryTool,
    async handle(principal, input) {
      const data = await readUserData(getDb(), principal.userId);
      const existing =
        input.id === undefined
          ? null
          : (data.categories.find((row) => row.id === input.id) ?? null);
      if (input.id !== undefined && existing === null) {
        return refuse('category', { error: 'notFound' });
      }
      const resolved = resolveCategoryInput(input, existing, data.budgets, minorDigitsOf(data));
      if (!resolved.ok) return resolved;
      const values: writes.CategoryInput = resolved.value;
      const result = await writes.saveCategory(getDb(), principal.userId, values, clock());
      if (!result.ok) return refuse('category', result);
      return saved('category', 'category', principal.userId, result.id, existing === null);
    },
  };

  const archiveCategory: WriteToolHandler<ArchiveCategoryInput, ArchivedOutput> = {
    spec: archiveCategoryTool,
    async handle(principal, input) {
      const request = categoryArchiveRequest(input);
      if (!request.ok) return request;
      const result =
        request.value.action === 'archive'
          ? await writes.archiveCategory(
              getDb(),
              principal.userId,
              {
                id: input.id,
                moveToId: request.value.moveToId,
                expectedUpdatedAt: input.updatedAt,
              },
              clock(),
            )
          : await writes.restoreCategory(
              getDb(),
              principal.userId,
              input.id,
              clock(),
              input.updatedAt,
            );
      if (!result.ok) return refuse('category', result);
      return archivedState('category', principal.userId, input.id);
    },
  };

  return { saveCategory, archiveCategory };
}
