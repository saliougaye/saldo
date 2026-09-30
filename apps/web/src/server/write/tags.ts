import { canCreateTag, newId, type Tag, type UserData } from '@saldo/core';
import { z } from 'zod';
import type { ServerDatabase } from '../db/types';
import { readUserData } from '../userData/read';
import { tombstoned, unstamped } from './rows';
import { type EntityWrite, WriteRefused, writeInTransaction } from './writeChanges';

/**
 * Tag maintenance (§5.10), as the phone's `adminService`. `taken` is a name another tag already
 * holds: names are unique case-insensitively, on create and on rename.
 */
export type TagWriteError = 'invalid' | 'notFound' | 'conflict' | 'taken';
export type TagResult = { ok: true } | { ok: false; error: TagWriteError };
export type NewTagResult = { ok: true; id: string } | { ok: false; error: TagWriteError };

/** `tagSchema`'s own limit. */
const MAX_NAME = 40;

export const renameTagInputSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(MAX_NAME),
});

export const mergeTagsInputSchema = z.object({
  sourceId: z.string().min(1),
  targetId: z.string().min(1),
});

const fail = (error: TagWriteError) => ({ writes: [], result: { ok: false, error } }) as const;

/** The refusal a race turns into; anything else is a bug and propagates. */
function refused(error: unknown): { ok: false; error: TagWriteError } {
  if (error instanceof WriteRefused) return { ok: false, error: error.reason };
  throw error;
}

export type CreateTagResult =
  | { ok: true; tag: Pick<Tag, 'id' | 'name'>; created: boolean }
  | { ok: false; error: 'invalid' | 'conflict' };

/** «Crea «X»» in the tag field (§5.10): a new tag, or the one that already has the name. */
export async function createTag(
  db: ServerDatabase,
  userId: string,
  rawName: string,
  now: Date,
): Promise<CreateTagResult> {
  const name = rawName.trim();
  if (name.length === 0 || name.length > MAX_NAME) return { ok: false, error: 'invalid' };
  try {
    return await writeInTransaction<CreateTagResult>(db, userId, now, async (tx) => {
      const data = await readUserData(tx, userId);
      if (!canCreateTag(data.tags, name)) {
        const existing = data.tags.find(
          (tag) => tag.name.trim().toLowerCase() === name.toLowerCase(),
        );
        if (existing !== undefined) {
          return {
            writes: [],
            result: { ok: true, tag: { id: existing.id, name: existing.name }, created: false },
          };
        }
      }
      const id = newId();
      return {
        writes: [
          {
            entity: 'tag',
            id,
            data: { id, name, createdAt: now.toISOString(), deletedAt: null },
            basis: null,
          },
        ],
        result: { ok: true, tag: { id, name }, created: true },
      };
    });
  } catch (error) {
    if (error instanceof WriteRefused) return { ok: false, error: error.reason };
    throw error;
  }
}

/**
 * «Nuovo tag» on the tag admin (§5.10). Unlike the tag field's «Crea «X»», which picks the tag that
 * already has the name, a name in use is refused here: the person asked for a new tag.
 */
export async function newTag(
  db: ServerDatabase,
  userId: string,
  rawName: string,
  now: Date,
): Promise<NewTagResult> {
  const name = rawName.trim();
  if (name.length === 0 || name.length > MAX_NAME) return { ok: false, error: 'invalid' };
  try {
    return await writeInTransaction<NewTagResult>(db, userId, now, async (tx) => {
      const data = await readUserData(tx, userId);
      if (!canCreateTag(data.tags, name)) return fail('taken');
      const id = newId();
      return {
        writes: [
          {
            entity: 'tag',
            id,
            data: { id, name, createdAt: now.toISOString(), deletedAt: null },
            basis: null,
          },
        ],
        result: { ok: true, id },
      };
    });
  } catch (error) {
    return refused(error);
  }
}

/**
 * Renames a tag; the id, and so every transaction that carries it, stays (§5.10). A tag may keep
 * its own name or change only its case; the name it already has writes nothing.
 */
export async function renameTag(
  db: ServerDatabase,
  userId: string,
  raw: unknown,
  now: Date,
): Promise<TagResult> {
  const parsed = renameTagInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const { id, name } = parsed.data;
  try {
    return await writeInTransaction<TagResult>(db, userId, now, async (tx) => {
      const data = await readUserData(tx, userId);
      const existing = data.tags.find((tag) => tag.id === id);
      if (existing === undefined) return fail('notFound');
      if (existing.name === name) return { writes: [], result: { ok: true } };
      const others = data.tags.filter((tag) => tag.id !== id);
      if (!canCreateTag(others, name)) return fail('taken');
      return {
        writes: [
          { entity: 'tag', id, data: { ...unstamped(existing), name }, basis: existing.updatedAt },
        ],
        result: { ok: true },
      };
    });
  } catch (error) {
    return refused(error);
  }
}

/**
 * One write for every transaction and recurrence template that carries `tagId`, with its `tagIds`
 * as `next` gives them. A template carries tags too, so a row the recurrence materialises later
 * does not bring a tombstoned tag back.
 */
function retagged(
  data: UserData,
  tagId: string,
  next: (tagIds: readonly string[]) => string[],
): EntityWrite[] {
  const writes: EntityWrite[] = [];
  for (const row of data.transactions) {
    if (!row.tagIds.includes(tagId)) continue;
    writes.push({
      entity: 'transaction',
      id: row.id,
      data: { ...unstamped(row), tagIds: next(row.tagIds) },
      basis: row.updatedAt,
    });
  }
  for (const row of data.recurrences) {
    if (!row.template.tagIds.includes(tagId)) continue;
    writes.push({
      entity: 'recurrence',
      id: row.id,
      data: { ...unstamped(row), template: { ...row.template, tagIds: next(row.template.tagIds) } },
      basis: row.updatedAt,
    });
  }
  return writes;
}

/**
 * Merges the source into the target (§5.10): every transaction and template carrying the source
 * gets the target instead, once, and the source is tombstoned — all in one batch, because a
 * half-applied merge would leave rows pointing at a tag that is gone.
 */
export async function mergeTags(
  db: ServerDatabase,
  userId: string,
  raw: unknown,
  now: Date,
): Promise<TagResult> {
  const parsed = mergeTagsInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const { sourceId, targetId } = parsed.data;
  if (sourceId === targetId) return { ok: false, error: 'invalid' };
  try {
    return await writeInTransaction<TagResult>(db, userId, now, async (tx) => {
      const data = await readUserData(tx, userId);
      const source = data.tags.find((tag) => tag.id === sourceId);
      if (source === undefined || !data.tags.some((tag) => tag.id === targetId)) {
        return fail('notFound');
      }
      return {
        writes: [
          ...retagged(data, sourceId, (tagIds) => [
            ...new Set(tagIds.map((id) => (id === sourceId ? targetId : id))),
          ]),
          {
            entity: 'tag',
            id: sourceId,
            data: tombstoned(source, now.toISOString()),
            basis: source.updatedAt,
          },
        ],
        result: { ok: true },
      };
    });
  } catch (error) {
    return refused(error);
  }
}

/** Deletes a tag (§5.10): the id leaves every transaction and template, then the tag is tombstoned. */
export async function deleteTag(
  db: ServerDatabase,
  userId: string,
  id: string,
  now: Date,
): Promise<TagResult> {
  if (id === '') return { ok: false, error: 'invalid' };
  try {
    return await writeInTransaction<TagResult>(db, userId, now, async (tx) => {
      const data = await readUserData(tx, userId);
      const existing = data.tags.find((tag) => tag.id === id);
      if (existing === undefined) return fail('notFound');
      return {
        writes: [
          ...retagged(data, id, (tagIds) => tagIds.filter((each) => each !== id)),
          {
            entity: 'tag',
            id,
            data: tombstoned(existing, now.toISOString()),
            basis: existing.updatedAt,
          },
        ],
        result: { ok: true },
      };
    });
  } catch (error) {
    return refused(error);
  }
}
