import {
  amountBufferToMinor,
  type Category,
  categoryParentCandidates,
  childCategories,
  getCurrency,
  MAX_COLOR_INDEX,
  movableTargets,
  newId,
  readSettings,
  reorderSiblings,
  sanitizeAmountInput,
  topLevelCategories,
} from '@saldo/core';
import { z } from 'zod';
import type { ServerDatabase } from '../db/types';
import { readUserData } from '../userData/read';
import { tombstoned, unstamped } from './rows';
import type { WriteError } from './transactions';
import { type EntityWrite, movedSince, WriteRefused, writeInTransaction } from './writeChanges';

export type CategoryWriteError = WriteError | 'parentInvalid' | 'moveInvalid';

export const categoryInputSchema = z.object({
  /** Null for «Nuova categoria». */
  id: z.string().min(1).nullable(),
  name: z.string().trim().min(1).max(40),
  /** Only read when creating: the phone's edit never changes a category's direction. */
  direction: z.enum(['expense', 'income']),
  parentId: z.string().min(1).nullable(),
  icon: z.string().min(1).max(40),
  colorIndex: z.number().int().min(0).max(MAX_COLOR_INDEX),
  /** «Budget mensile» (§5.11, §6.19). */
  budgetEnabled: z.boolean(),
  budgetBuffer: z
    .string()
    .max(32)
    .refine((v) => v === '' || /^\d{1,13}(\.\d{0,3})?$/.test(v), 'Not an amount'),
  /** §17.4.2: the version the caller read the row at; a row that moved since is a `conflict`. */
  expectedUpdatedAt: z.string().min(1).optional(),
});

export const archiveCategoryInputSchema = z.object({
  id: z.string().min(1),
  /** «Sposta le transazioni in»; null archives without moving. */
  moveToId: z.string().min(1).nullable(),
  /** §17.4.2: the version the caller read the row at; a row that moved since is a `conflict`. */
  expectedUpdatedAt: z.string().min(1).optional(),
});

export const reorderCategoryInputSchema = z.object({
  id: z.string().min(1),
  direction: z.union([z.literal(-1), z.literal(1)]),
});

export type CategoryInput = z.infer<typeof categoryInputSchema>;
export type CategorySaveResult =
  | { ok: true; id: string }
  | { ok: false; error: CategoryWriteError };
export type CategoryResult = { ok: true } | { ok: false; error: CategoryWriteError };

const fail = (error: CategoryWriteError) => ({ writes: [], result: { ok: false, error } }) as const;

/** The refusal a race turns into; anything else is a bug and propagates. */
function refused(error: unknown): CategoryResult {
  if (error instanceof WriteRefused) return { ok: false, error: error.reason };
  throw error;
}

/**
 * Creates or edits a category, mirroring the phone's category screens: the parent must be a live
 * top-level category of the same direction (a child cannot have children, and a category that has
 * children cannot get a parent); «Budget mensile» creates, updates or removes the category's own
 * single-category budget.
 */
export async function saveCategory(
  db: ServerDatabase,
  userId: string,
  raw: unknown,
  now: Date,
): Promise<CategorySaveResult> {
  const parsed = categoryInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const input = parsed.data;
  try {
    return await writeInTransaction<CategorySaveResult>(db, userId, now, async (tx) => {
      const data = await readUserData(tx, userId);
      const { minorDigits } = getCurrency(readSettings(data.settings).currency);
      if (input.budgetBuffer !== sanitizeAmountInput(input.budgetBuffer, minorDigits)) {
        return fail('invalid');
      }
      const amount = amountBufferToMinor(input.budgetBuffer, minorDigits);
      if (!Number.isSafeInteger(amount)) return fail('invalid');

      const existing =
        input.id === null ? null : (data.categories.find((row) => row.id === input.id) ?? null);
      if (input.id !== null && existing === null) return fail('notFound');
      if (existing !== null && movedSince(existing, input.expectedUpdatedAt)) {
        return fail('conflict');
      }
      const direction = existing?.direction ?? input.direction;

      if (input.parentId !== null && input.parentId !== existing?.parentId) {
        const candidates = categoryParentCandidates(
          data.categories,
          direction,
          existing?.id ?? null,
        );
        if (!candidates.some((candidate) => candidate.id === input.parentId)) {
          return fail('parentInvalid');
        }
      } else if (input.parentId !== null && existing !== null) {
        // Unchanged parent: an edit may keep it even if it has since been archived, but a category
        // that grew children meanwhile still cannot hold one.
        if (data.categories.some((row) => row.parentId === existing.id)) {
          return fail('parentInvalid');
        }
      }

      const id = existing?.id ?? newId();
      const fields = {
        name: input.name,
        parentId: input.parentId,
        icon: input.icon,
        colorIndex: input.colorIndex,
      };
      const writes: EntityWrite[] = [
        {
          entity: 'category',
          id,
          data:
            existing === null
              ? {
                  ...fields,
                  id,
                  direction,
                  archivedAt: null,
                  sortOrder: data.categories.length,
                  createdAt: now.toISOString(),
                  deletedAt: null,
                }
              : { ...unstamped(existing), ...fields },
          basis: existing?.updatedAt ?? null,
        },
      ];

      // Income has nothing to cap: the form hides the switch, and a budget only covers spending.
      if (direction === 'expense') {
        const own =
          data.budgets.find(
            (budget) => budget.categoryIds.length === 1 && budget.categoryIds[0] === id,
          ) ?? null;
        if (input.budgetEnabled && amount > 0) {
          if (own === null) {
            const budgetId = newId();
            writes.push({
              entity: 'budget',
              id: budgetId,
              data: {
                id: budgetId,
                name: input.name,
                categoryIds: [id],
                amount,
                period: 'period',
                alertThreshold: 90,
                rollover: false,
                icon: input.icon,
                sortOrder: data.budgets.length,
                createdAt: now.toISOString(),
                deletedAt: null,
              },
              basis: null,
            });
          } else if (own.amount !== amount) {
            writes.push({
              entity: 'budget',
              id: own.id,
              data: { ...unstamped(own), amount },
              basis: own.updatedAt,
            });
          }
        } else if (own !== null) {
          writes.push({
            entity: 'budget',
            id: own.id,
            data: tombstoned(own, now.toISOString()),
            basis: own.updatedAt,
          });
        }
      }
      return { writes, result: { ok: true, id } };
    });
  } catch (error) {
    const result = refused(error);
    return result.ok ? { ok: false, error: 'conflict' } : result;
  }
}

/**
 * Archives a category and its children (§5.11). With `moveToId`, every live transaction and
 * recurrence template that uses it, and every budget that covers it, follow to the target in the
 * same batch. Already archived: ok, nothing written.
 */
export async function archiveCategory(
  db: ServerDatabase,
  userId: string,
  raw: unknown,
  now: Date,
): Promise<CategoryResult> {
  const parsed = archiveCategoryInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const { id, moveToId, expectedUpdatedAt } = parsed.data;
  try {
    return await writeInTransaction<CategoryResult>(db, userId, now, async (tx) => {
      const data = await readUserData(tx, userId);
      const existing = data.categories.find((row) => row.id === id);
      if (existing === undefined) return fail('notFound');
      if (movedSince(existing, expectedUpdatedAt)) return fail('conflict');
      if (existing.archivedAt !== null) return { writes: [], result: { ok: true } };
      if (
        moveToId !== null &&
        !movableTargets(data.categories, existing).some((target) => target.id === moveToId)
      ) {
        return fail('moveInvalid');
      }

      const at = now.toISOString();
      const writes: EntityWrite[] = [];
      // Children follow their parent, otherwise they would dangle under an archived category.
      for (const child of data.categories) {
        if (child.parentId === id && child.archivedAt === null) {
          writes.push({
            entity: 'category',
            id: child.id,
            data: { ...unstamped(child), archivedAt: at },
            basis: child.updatedAt,
          });
        }
      }
      writes.push({
        entity: 'category',
        id,
        data: { ...unstamped(existing), archivedAt: at },
        basis: existing.updatedAt,
      });

      if (moveToId !== null) {
        for (const row of data.transactions) {
          if (row.categoryId !== id) continue;
          writes.push({
            entity: 'transaction',
            id: row.id,
            data: { ...unstamped(row), categoryId: moveToId },
            basis: row.updatedAt,
          });
        }
        for (const row of data.recurrences) {
          if (row.template.categoryId !== id) continue;
          writes.push({
            entity: 'recurrence',
            id: row.id,
            data: { ...unstamped(row), template: { ...row.template, categoryId: moveToId } },
            basis: row.updatedAt,
          });
        }
        for (const row of data.budgets) {
          if (!row.categoryIds.includes(id)) continue;
          const categoryIds = [
            ...new Set(row.categoryIds.map((each) => (each === id ? moveToId : each))),
          ];
          writes.push({
            entity: 'budget',
            id: row.id,
            data: { ...unstamped(row), categoryIds },
            basis: row.updatedAt,
          });
        }
      }
      return { writes, result: { ok: true } };
    });
  } catch (error) {
    return refused(error);
  }
}

/**
 * Restores an archived category. A child whose parent is still archived stays refused
 * (`parentInvalid`): it would dangle under a category the lists hide. Live already: ok, nothing
 * written.
 */
export async function restoreCategory(
  db: ServerDatabase,
  userId: string,
  id: string,
  now: Date,
  /** §17.4.2: the version the caller read; none checks nothing. */
  expectedUpdatedAt?: string,
): Promise<CategoryResult> {
  if (id === '') return { ok: false, error: 'invalid' };
  try {
    return await writeInTransaction<CategoryResult>(db, userId, now, async (tx) => {
      const data = await readUserData(tx, userId);
      const existing = data.categories.find((row) => row.id === id);
      if (existing === undefined) return fail('notFound');
      if (movedSince(existing, expectedUpdatedAt)) return fail('conflict');
      if (existing.archivedAt === null) return { writes: [], result: { ok: true } };
      if (existing.parentId !== null) {
        const parent = data.categories.find((row) => row.id === existing.parentId);
        if (parent === undefined || parent.archivedAt !== null) return fail('parentInvalid');
      }
      return {
        writes: [
          {
            entity: 'category',
            id,
            data: { ...unstamped(existing), archivedAt: null },
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

/** One place up or down inside the sibling group (§5.11); the group is renumbered. */
export async function reorderCategory(
  db: ServerDatabase,
  userId: string,
  raw: unknown,
  now: Date,
): Promise<CategoryResult> {
  const parsed = reorderCategoryInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const { id, direction } = parsed.data;
  try {
    return await writeInTransaction<CategoryResult>(db, userId, now, async (tx) => {
      const data = await readUserData(tx, userId);
      const existing = data.categories.find((row) => row.id === id);
      if (existing === undefined || existing.archivedAt !== null) return fail('notFound');
      const siblings: Category[] =
        existing.parentId === null
          ? topLevelCategories(data.categories, existing.direction)
          : childCategories(data.categories, existing.parentId);
      const writes: EntityWrite[] = [];
      for (const move of reorderSiblings(siblings, id, direction)) {
        const row = siblings.find((sibling) => sibling.id === move.id);
        if (row === undefined || row.sortOrder === move.sortOrder) continue;
        writes.push({
          entity: 'category',
          id: row.id,
          data: { ...unstamped(row), sortOrder: move.sortOrder },
          basis: row.updatedAt,
        });
      }
      return { writes, result: { ok: true } };
    });
  } catch (error) {
    return refused(error);
  }
}
