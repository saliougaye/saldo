import type { Tag } from '@saldo/core';

/**
 * What a new or renamed tag is waiting for, or `null` when nothing is: a tag is only its name, and
 * names are unique case-insensitively among live tags (§5.10). `selfId` is the tag being renamed,
 * which may keep its own name or change only its case.
 */
export function tagMissingForSave(
  name: string,
  tags: readonly Pick<Tag, 'id' | 'name'>[],
  selfId?: string,
): 'name' | 'taken' | null {
  const wanted = name.trim().toLowerCase();
  if (wanted.length === 0) return 'name';
  const clash = tags.some((tag) => tag.id !== selfId && tag.name.trim().toLowerCase() === wanted);
  return clash ? 'taken' : null;
}
