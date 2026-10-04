import {
  type Account,
  amountBufferToMinor,
  canRestoreGoal,
  type GoalMissing,
  getCurrency,
  goalStepMissing,
  isLocalDate,
  isPocket,
  MAX_COLOR_INDEX,
  newGoalFields,
  newGoalTransferFields,
  newId,
  planCloseGoal,
  pocketParentCandidates,
  readSettings,
  restoreGoalFields,
  sanitizeAmountInput,
  type Transaction,
  type UserData,
} from '@saldo/core';
import { z } from 'zod';
import type { ServerDatabase } from '../db/types';
import { env } from '../env';
import { readUserData } from '../userData/read';
import { todayFor } from '../userData/today';
import type { AccountResult, AccountWriteError } from './accounts';
import { tombstoned, unstamped } from './rows';
import { type EntityWrite, movedSince, WriteRefused, writeInTransaction } from './writeChanges';

export const goalInputSchema = z.object({
  /** Null for «Nuovo obiettivo». */
  id: z.string().min(1).nullable(),
  name: z.string().max(60),
  icon: z.string().min(1).max(40),
  colorIndex: z.number().int().min(0).max(MAX_COLOR_INDEX),
  /** The target, as the field holds it. */
  buffer: z
    .string()
    .max(32)
    .refine((v) => v === '' || /^\d{1,13}(\.\d{0,3})?$/.test(v), 'Not an amount'),
  deadline: z.string().refine(isLocalDate, 'Expected YYYY-MM-DD date').nullable(),
  parentAccountId: z.string().min(1).nullable(),
  /** «Già da parte». Only read when creating. */
  savedBuffer: z
    .string()
    .max(32)
    .refine((v) => v === '' || /^\d{1,13}(\.\d{0,3})?$/.test(v), 'Not an amount'),
  /** §17.4.2: the version the caller read the pocket at; a pocket that moved since is a `conflict`. */
  expectedUpdatedAt: z.string().min(1).optional(),
});

export type GoalInput = z.infer<typeof goalInputSchema>;

export type GoalSaveResult =
  | { ok: true; id: string }
  | { ok: false; missing: GoalMissing }
  | { ok: false; error: AccountWriteError };

/**
 * The writes that close `goalId` (§5.14): its future rows and recurrences stop, the pocket is
 * brought to zero and archived. Shared by «Chiudi» and by «Registra la spesa», whose expense
 * `saveTransaction` writes beside them. `null` when there is no open goal by that id.
 */
export function closeGoalWrites(
  data: UserData,
  goalId: string,
  today: string,
  now: Date,
  /** Rows written in the same batch, not yet stored: the plan reads them as part of the ledger. */
  extra: readonly Transaction[] = [],
): EntityWrite[] | null {
  const pocket = data.accounts.find((row) => row.id === goalId);
  if (pocket === undefined || !isPocket(pocket) || pocket.archivedAt !== null) return null;
  const plan = planCloseGoal({
    pocket,
    transactions: [...data.transactions, ...extra],
    recurrences: data.recurrences,
    today,
  });
  const at = now.toISOString();
  const writes: EntityWrite[] = [];
  for (const id of plan.tombstoneTransactionIds) {
    const row = data.transactions.find((tx) => tx.id === id);
    if (row === undefined) continue;
    writes.push({ entity: 'transaction', id, data: tombstoned(row, at), basis: row.updatedAt });
  }
  for (const edit of plan.recurrenceEdits) {
    const row = data.recurrences.find((rec) => rec.id === edit.id);
    if (row === undefined) continue;
    writes.push({
      entity: 'recurrence',
      id: edit.id,
      data: edit.delete ? tombstoned(row, at) : { ...unstamped(row), endDate: edit.endDate },
      basis: row.updatedAt,
    });
  }
  if (plan.settlement !== null) {
    const id = newId();
    writes.push({
      entity: 'transaction',
      id,
      data: { ...plan.settlement, id, createdAt: at, deletedAt: null },
      basis: null,
    });
  }
  writes.push({
    entity: 'account',
    id: goalId,
    data: { ...unstamped(pocket), archivedAt: at },
    basis: pocket.updatedAt,
  });
  return writes;
}

export async function saveGoal(
  db: ServerDatabase,
  userId: string,
  raw: unknown,
  now: Date,
): Promise<GoalSaveResult> {
  const parsed = goalInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const input = parsed.data;
  try {
    return await writeInTransaction<GoalSaveResult>(db, userId, now, async (tx) => {
      const data = await readUserData(tx, userId);
      const settings = readSettings(data.settings);
      const { minorDigits } = getCurrency(settings.currency);
      const { today } = todayFor(settings, env().defaultTimeZone, now);
      const fail = (error: AccountWriteError) => ({
        writes: [],
        result: { ok: false, error } as const,
      });

      // The buffers are ones the keypad could have typed in this currency.
      for (const buffer of [input.buffer, input.savedBuffer]) {
        if (buffer !== sanitizeAmountInput(buffer, minorDigits)) return fail('invalid');
        if (!Number.isSafeInteger(amountBufferToMinor(buffer, minorDigits))) return fail('invalid');
      }

      const existing =
        input.id === null ? null : (data.accounts.find((row) => row.id === input.id) ?? null);
      if (
        input.id !== null &&
        (existing === null || !isPocket(existing) || existing.archivedAt !== null)
      ) {
        return fail('notFound');
      }
      if (existing !== null && movedSince(existing, input.expectedUpdatedAt)) {
        return fail('conflict');
      }
      const values = { ...input, icon: input.icon };
      const gap = goalStepMissing(
        existing === null ? 'account' : 'edit',
        values,
        today,
        minorDigits,
      );
      if (gap !== null) return { writes: [], result: { ok: false, missing: gap } };

      const goalTarget = amountBufferToMinor(input.buffer, minorDigits);
      const name = input.name.trim();
      if (existing !== null) {
        return {
          writes: [
            {
              entity: 'account',
              id: existing.id,
              data: {
                ...unstamped(existing),
                name,
                icon: input.icon,
                colorIndex: input.colorIndex,
                goalTarget,
                goalDeadline: input.deadline,
              },
              basis: existing.updatedAt,
            },
          ],
          result: { ok: true, id: existing.id },
        };
      }

      const parent = pocketParentCandidates(data.accounts).find(
        (row) => row.id === input.parentAccountId,
      );
      if (parent === undefined) return fail('invalid');
      const goal = {
        name,
        icon: input.icon,
        colorIndex: input.colorIndex,
        parentAccountId: parent.id,
        goalTarget,
        goalDeadline: input.deadline,
        alreadySaved: amountBufferToMinor(input.savedBuffer, minorDigits),
        today,
        sortOrder: data.accounts.length,
      };
      const id = newId();
      const at = now.toISOString();
      const writes: EntityWrite[] = [
        {
          entity: 'account',
          id,
          data: { ...newGoalFields(goal), id, createdAt: at, deletedAt: null },
          basis: null,
        },
      ];
      const transfer = newGoalTransferFields(goal, id);
      if (transfer !== null) {
        const transferId = newId();
        writes.push({
          entity: 'transaction',
          id: transferId,
          data: { ...transfer, id: transferId, createdAt: at, deletedAt: null },
          basis: null,
        });
      }
      return { writes, result: { ok: true, id } };
    });
  } catch (error) {
    if (error instanceof WriteRefused) return { ok: false, error: error.reason };
    throw error;
  }
}

/** «Riporta in {conto}» and the close of an empty goal (§6.38). */
export async function closeGoal(
  db: ServerDatabase,
  userId: string,
  goalId: string,
  now: Date,
  /** §17.4.2: the version the caller read; none checks nothing. */
  expectedUpdatedAt?: string,
): Promise<AccountResult> {
  try {
    return await writeInTransaction<AccountResult>(db, userId, now, async (tx) => {
      const data = await readUserData(tx, userId);
      // Only an open goal's version is compared: any other id is `notFound` below, not `conflict`.
      const pocket = data.accounts.find(
        (row) => row.id === goalId && isPocket(row) && row.archivedAt === null,
      );
      if (pocket !== undefined && movedSince(pocket, expectedUpdatedAt)) {
        return { writes: [], result: { ok: false, error: 'conflict' } };
      }
      const { today } = todayFor(readSettings(data.settings), env().defaultTimeZone, now);
      const writes = closeGoalWrites(data, goalId, today, now);
      if (writes === null) return { writes: [], result: { ok: false, error: 'notFound' } };
      return { writes, result: { ok: true } };
    });
  } catch (error) {
    if (error instanceof WriteRefused) return { ok: false, error: error.reason };
    throw error;
  }
}

/** Ripristina on a closed goal (§5.14): from today, or refused while its account is archived. */
export async function restoreGoal(
  db: ServerDatabase,
  userId: string,
  goalId: string,
  now: Date,
): Promise<AccountResult> {
  try {
    return await writeInTransaction<AccountResult>(db, userId, now, async (tx) => {
      const data = await readUserData(tx, userId);
      const { today } = todayFor(readSettings(data.settings), env().defaultTimeZone, now);
      const pocket: Account | undefined = data.accounts.find((row) => row.id === goalId);
      if (pocket === undefined || !isPocket(pocket) || pocket.archivedAt === null) {
        return { writes: [], result: { ok: false, error: 'notFound' } };
      }
      if (!canRestoreGoal(pocket, data.accounts)) {
        return { writes: [], result: { ok: false, error: 'parentArchived' } };
      }
      return {
        writes: [
          {
            entity: 'account',
            id: goalId,
            data: { ...unstamped(pocket), ...restoreGoalFields(pocket, today) },
            basis: pocket.updatedAt,
          },
        ],
        result: { ok: true },
      };
    });
  } catch (error) {
    if (error instanceof WriteRefused) return { ok: false, error: error.reason };
    throw error;
  }
}
