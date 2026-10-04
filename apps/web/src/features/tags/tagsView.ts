import { canCreateTag, type UserData } from '@saldo/core';

export interface TagRowView {
  id: string;
  name: string;
  /** The tag's version as loaded, for rename, merge and delete (§17.4.2). */
  updatedAt: string;
  /** Live transactions that carry it, over every date: a tag spans the periods (§5.10). */
  uses: number;
}

/** The phone's `useTags` order (name, byte for byte), here the tie-break under the usage. */
const binary = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Profilo → Tag (§5.10): every tag with its usage, most used first, then by name. */
export function tagsView(data: UserData): TagRowView[] {
  const usage = new Map<string, number>();
  for (const row of data.transactions) {
    if (row.deletedAt !== null) continue;
    for (const id of row.tagIds) usage.set(id, (usage.get(id) ?? 0) + 1);
  }
  return data.tags
    .map((tag) => ({
      id: tag.id,
      name: tag.name,
      updatedAt: tag.updatedAt,
      uses: usage.get(tag.id) ?? 0,
    }))
    .sort((a, b) => b.uses - a.uses || binary(a.name, b.name));
}

/**
 * What a new or renamed tag's name is waiting for, as the phone's `tagMissingForSave`: a name, or
 * one no other tag holds (case-insensitively). `selfId` is the tag being renamed, which may keep
 * its own name or change only its case. The server checks again.
 */
export function tagNameProblem(
  name: string,
  tags: readonly { id: string; name: string }[],
  selfId: string | null,
): 'name' | 'taken' | null {
  if (name.trim() === '') return 'name';
  const others = tags.filter((tag) => tag.id !== selfId);
  return canCreateTag(others, name) ? null : 'taken';
}
