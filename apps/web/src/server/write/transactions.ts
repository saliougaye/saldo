import {
  accountBalances,
  canCreateTag,
  getCurrency,
  isLocalDate,
  type MissingField,
  missingForSave,
  newId,
  previewFromBalances,
  readSettings,
  type Tag,
  type TransactionFormValues,
  toTransactionInput,
  touchesClosedGoal,
  transactionKindSchema,
  transferOverdrawsSource,
  type UserData,
} from '@saldo/core';
import { z } from 'zod';
import type { ServerDatabase } from '../db/types';
import { env } from '../env';
import { readUserData } from '../userData/read';
import { loadRow } from '../userData/row';
import { todayFor } from '../userData/today';
import { WriteRefused, writeInTransaction } from './writeChanges';

/** What the form sends. Parsed here, because a Server Action's argument is whatever a client posts. */
export const transactionInputSchema = z.object({
  /** Null for «Nuova transazione». */
  id: z.string().min(1).nullable(),
  kind: transactionKindSchema,
  /**
   * The amount as the field holds it: `sanitizeAmountInput`'s buffer, `.` as the separator. Empty
   * is a legitimate "missing amount" (`missingForSave` reports it as such); anything else must look
   * like a buffer the keypad could have produced — up to 13 integer digits, an optional `.` and up
   * to 3 decimals — so `amountBufferToMinor` never has to parse something no key press could type.
   */
  buffer: z
    .string()
    .max(32)
    .refine((value) => value === '' || /^\d{1,13}(\.\d{0,3})?$/.test(value), 'Not an amount'),
  date: z.string().refine(isLocalDate, 'Expected YYYY-MM-DD date'),
  accountId: z.string().min(1).nullable(),
  toAccountId: z.string().min(1).nullable(),
  categoryId: z.string().min(1).nullable(),
  description: z.string().max(120),
  tagIds: z.array(z.string().min(1)).max(50),
  excludeFromTotals: z.boolean(),
});

export type TransactionInput = z.infer<typeof transactionInputSchema>;

export type WriteError = 'invalid' | 'notFound' | 'closedGoal' | 'conflict';

export type SaveResult =
  | { ok: true; id: string }
  | { ok: false; missing: MissingField }
  | { ok: false; error: WriteError };

export type Result = { ok: true } | { ok: false; error: WriteError };

/**
 * §5.12: the undo toast that follows a delete lasts 5s. This window is not the timer for it — it
 * only guards against a stray «Annulla» resurrecting a deletion from long before, e.g. a replayed
 * or stale request.
 */
const RESTORE_WINDOW_MS = 10 * 60 * 1000;

const live = <T extends { id: string; archivedAt: string | null }>(
  rows: readonly T[],
  id: string | null,
) => id !== null && rows.some((row) => row.id === id && row.archivedAt === null);

/**
 * The phone's `missingForSave` (§6.16), with the two checks only a server has to make: every id the
 * form names must be one of **this user's** live rows, and a transfer must not overdraw its source
 * (`transferOverdrawsSource` over today's balances, the edited row left out — as the phone's form).
 *
 * `previewFromBalances` takes two balance maps: `now` over the full ledger and `without` over the
 * ledger with the edited row left out (a new transaction has nothing to leave out, so both maps are
 * the same one).
 */
function missing(
  data: UserData,
  values: TransactionFormValues,
  editingId: string | null,
  today: string,
): MissingField | null {
  const { minorDigits } = getCurrency(readSettings(data.settings).currency);
  const basic = missingForSave(values, minorDigits);
  if (basic !== null) return basic;
  if (!live(data.accounts, values.accountId)) return 'account';
  if (values.kind === 'transfer') {
    if (!live(data.accounts, values.toAccountId)) return 'destination';
    const now = accountBalances(data.accounts, data.transactions, today);
    const without =
      editingId === null
        ? now
        : accountBalances(
            data.accounts,
            data.transactions.filter((tx) => tx.id !== editingId),
            today,
          );
    const preview = previewFromBalances(
      now,
      without,
      {
        id: editingId ?? 'draft',
        amount: toTransactionInput(values, minorDigits).amount,
        date: values.date,
        fromAccountId: values.accountId,
        toAccountId: values.toAccountId,
      },
      today,
    );
    const source = data.accounts.find((account) => account.id === values.accountId);
    return transferOverdrawsSource(source, preview.from) ? 'insufficientFunds' : null;
  }
  // A non-transfer's category must not only be live but must point the same way as the
  // transaction: an expense filed under an income category (or the reverse) is not a form error
  // the phone's own picker can produce, but a server has to check it anyway.
  const category = data.categories.find((row) => row.id === values.categoryId);
  if (category === undefined || category.archivedAt !== null) return 'category';
  return category.direction === values.kind ? null : 'category';
}

export async function saveTransaction(
  db: ServerDatabase,
  userId: string,
  raw: unknown,
  now: Date,
): Promise<SaveResult> {
  const parsed = transactionInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const input = parsed.data;
  try {
    return await writeInTransaction<SaveResult>(db, userId, now, async (tx) => {
      const data = await readUserData(tx, userId);
      const settings = readSettings(data.settings);
      const { today } = todayFor(settings, env().defaultTimeZone, now);
      const existing =
        input.id === null ? null : (data.transactions.find((row) => row.id === input.id) ?? null);
      if (input.id !== null && existing === null) {
        return { writes: [], result: { ok: false, error: 'notFound' } };
      }
      if (existing !== null && touchesClosedGoal(existing, data.accounts)) {
        return { writes: [], result: { ok: false, error: 'closedGoal' } };
      }
      const values: TransactionFormValues = { ...input, recurrence: null };
      const gap = missing(data, values, existing?.id ?? null, today);
      if (gap !== null) return { writes: [], result: { ok: false, missing: gap } };
      const tagIds = [
        ...new Set(input.tagIds.filter((id) => data.tags.some((tag) => tag.id === id))),
      ];

      const { minorDigits } = getCurrency(settings.currency);
      const fields = { ...toTransactionInput(values, minorDigits), tagIds };
      const id = existing?.id ?? newId();
      const row =
        existing === null
          ? { ...fields, id, recurrenceId: null, createdAt: now.toISOString(), deletedAt: null }
          : // The note and the recurrence are not on the web's form (§17.1.9): an edit keeps them.
            { ...existing, ...fields, note: existing.note, recurrenceId: existing.recurrenceId };
      const { updatedAt: _stamp, ...unstamped } = row as typeof row & { updatedAt?: string };
      return {
        writes: [{ entity: 'transaction', id, data: unstamped }],
        result: { ok: true, id },
      };
    });
  } catch (error) {
    if (error instanceof WriteRefused) return { ok: false, error: 'conflict' };
    throw error;
  }
}

/** A tombstone (§7), as the phone's `repos.transactions.remove`: its attachments stay as they are. */
export async function deleteTransaction(
  db: ServerDatabase,
  userId: string,
  id: string,
  now: Date,
): Promise<Result> {
  try {
    return await writeInTransaction<Result>(db, userId, now, async (tx) => {
      const data = await readUserData(tx, userId);
      const existing = data.transactions.find((tx) => tx.id === id);
      if (existing === undefined) return { writes: [], result: { ok: false, error: 'notFound' } };
      if (touchesClosedGoal(existing, data.accounts)) {
        return { writes: [], result: { ok: false, error: 'closedGoal' } };
      }
      const { updatedAt: _stamp, ...row } = existing;
      return {
        writes: [{ entity: 'transaction', id, data: { ...row, deletedAt: now.toISOString() } }],
        result: { ok: true },
      };
    });
  } catch (error) {
    if (error instanceof WriteRefused) return { ok: false, error: 'conflict' };
    throw error;
  }
}

/** «Annulla» in the toast (§5.12): the row as it was, alive again, with a newer stamp. */
export async function restoreTransaction(
  db: ServerDatabase,
  userId: string,
  id: string,
  now: Date,
): Promise<Result> {
  try {
    return await writeInTransaction<Result>(db, userId, now, async (tx) => {
      const found = await loadRow(tx, userId, 'transaction', id);
      if (found.status !== 'found' || !found.deleted) {
        return { writes: [], result: { ok: false, error: 'notFound' } };
      }
      const row = found.row;
      const deletedAt = row.deletedAt === null ? Number.NaN : new Date(row.deletedAt).getTime();
      if (Number.isNaN(deletedAt) || now.getTime() - deletedAt > RESTORE_WINDOW_MS) {
        return { writes: [], result: { ok: false, error: 'notFound' } };
      }
      const data = await readUserData(tx, userId);
      if (touchesClosedGoal(row, data.accounts)) {
        return { writes: [], result: { ok: false, error: 'closedGoal' } };
      }
      if (!live(data.accounts, row.accountId)) {
        return { writes: [], result: { ok: false, error: 'invalid' } };
      }
      if (row.kind === 'transfer') {
        if (!live(data.accounts, row.toAccountId)) {
          return { writes: [], result: { ok: false, error: 'invalid' } };
        }
      } else {
        const category = data.categories.find((cat) => cat.id === row.categoryId);
        if (
          category === undefined ||
          category.archivedAt !== null ||
          category.direction !== row.kind
        ) {
          return { writes: [], result: { ok: false, error: 'invalid' } };
        }
      }
      const { updatedAt: _stamp, ...unstamped } = row;
      return {
        writes: [{ entity: 'transaction', id, data: { ...unstamped, deletedAt: null } }],
        result: { ok: true },
      };
    });
  } catch (error) {
    if (error instanceof WriteRefused) return { ok: false, error: 'conflict' };
    throw error;
  }
}

export type CreateTagResult =
  | { ok: true; tag: Pick<Tag, 'id' | 'name'> }
  | { ok: false; error: 'invalid' | 'conflict' };

/** «Crea «X»» in the tag field (§5.10): a new tag, or the one that already has the name. */
export async function createTag(
  db: ServerDatabase,
  userId: string,
  rawName: string,
  now: Date,
): Promise<CreateTagResult> {
  const name = rawName.trim();
  if (name.length === 0 || name.length > 40) return { ok: false, error: 'invalid' };
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
            result: { ok: true, tag: { id: existing.id, name: existing.name } },
          };
        }
      }
      const id = newId();
      return {
        writes: [
          { entity: 'tag', id, data: { id, name, createdAt: now.toISOString(), deletedAt: null } },
        ],
        result: { ok: true, tag: { id, name } },
      };
    });
  } catch (error) {
    if (error instanceof WriteRefused) return { ok: false, error: 'conflict' };
    throw error;
  }
}
