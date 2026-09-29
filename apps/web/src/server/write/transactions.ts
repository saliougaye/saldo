import {
  accountBalances,
  canCreateTag,
  getCurrency,
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
import { writeChanges } from './writeChanges';

/** What the form sends. Parsed here, because a Server Action's argument is whatever a client posts. */
export const transactionInputSchema = z.object({
  /** Null for «Nuova transazione». */
  id: z.string().min(1).nullable(),
  kind: transactionKindSchema,
  /** The amount as the field holds it: `sanitizeAmountInput`'s buffer, `.` as the separator. */
  buffer: z.string().max(32),
  date: z.string(),
  accountId: z.string().min(1).nullable(),
  toAccountId: z.string().min(1).nullable(),
  categoryId: z.string().min(1).nullable(),
  description: z.string().max(120),
  tagIds: z.array(z.string().min(1)).max(50),
  excludeFromTotals: z.boolean(),
});

export type TransactionInput = z.infer<typeof transactionInputSchema>;

export type WriteError = 'invalid' | 'notFound' | 'closedGoal';

export type SaveResult =
  | { ok: true; id: string }
  | { ok: false; missing: MissingField }
  | { ok: false; error: WriteError };

export type Result = { ok: true } | { ok: false; error: WriteError };

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
  return live(data.categories, values.categoryId) ? null : 'category';
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
  const data = await readUserData(db, userId);
  const settings = readSettings(data.settings);
  const { today } = todayFor(settings, env().defaultTimeZone, now);
  const existing =
    input.id === null ? null : (data.transactions.find((tx) => tx.id === input.id) ?? null);
  if (input.id !== null && existing === null) return { ok: false, error: 'notFound' };
  if (existing !== null && touchesClosedGoal(existing, data.accounts)) {
    return { ok: false, error: 'closedGoal' };
  }
  const values: TransactionFormValues = { ...input, recurrence: null };
  const gap = missing(data, values, existing?.id ?? null, today);
  if (gap !== null) return { ok: false, missing: gap };
  const tagIds = input.tagIds.filter((id) => data.tags.some((tag) => tag.id === id));

  const { minorDigits } = getCurrency(settings.currency);
  const fields = { ...toTransactionInput(values, minorDigits), tagIds };
  const id = existing?.id ?? newId();
  const row =
    existing === null
      ? { ...fields, id, recurrenceId: null, createdAt: now.toISOString(), deletedAt: null }
      : // The note and the recurrence are not on the web's form (§17.1.9): an edit keeps them.
        { ...existing, ...fields, note: existing.note, recurrenceId: existing.recurrenceId };
  const { updatedAt: _stamp, ...unstamped } = row as typeof row & { updatedAt?: string };
  await writeChanges(db, userId, [{ entity: 'transaction', id, data: unstamped }], now);
  return { ok: true, id };
}

/** A tombstone (§7), as the phone's `repos.transactions.remove`: its attachments stay as they are. */
export async function deleteTransaction(
  db: ServerDatabase,
  userId: string,
  id: string,
  now: Date,
): Promise<Result> {
  const data = await readUserData(db, userId);
  const existing = data.transactions.find((tx) => tx.id === id);
  if (existing === undefined) return { ok: false, error: 'notFound' };
  if (touchesClosedGoal(existing, data.accounts)) return { ok: false, error: 'closedGoal' };
  const { updatedAt: _stamp, ...row } = existing;
  await writeChanges(
    db,
    userId,
    [{ entity: 'transaction', id, data: { ...row, deletedAt: now.toISOString() } }],
    now,
  );
  return { ok: true };
}

/** «Annulla» in the toast (§5.12): the row as it was, alive again, with a newer stamp. */
export async function restoreTransaction(
  db: ServerDatabase,
  userId: string,
  id: string,
  now: Date,
): Promise<Result> {
  const found = await loadRow(db, userId, 'transaction', id);
  if (found.status !== 'found' || !found.deleted) return { ok: false, error: 'notFound' };
  const { updatedAt: _stamp, ...row } = found.row;
  await writeChanges(
    db,
    userId,
    [{ entity: 'transaction', id, data: { ...row, deletedAt: null } }],
    now,
  );
  return { ok: true };
}

/** «Crea «X»» in the tag field (§5.10): a new tag, or the one that already has the name. */
export async function createTag(
  db: ServerDatabase,
  userId: string,
  rawName: string,
  now: Date,
): Promise<{ ok: true; tag: Pick<Tag, 'id' | 'name'> } | { ok: false; error: 'invalid' }> {
  const name = rawName.trim();
  if (name.length === 0 || name.length > 40) return { ok: false, error: 'invalid' };
  const data = await readUserData(db, userId);
  if (!canCreateTag(data.tags, name)) {
    const existing = data.tags.find((tag) => tag.name.trim().toLowerCase() === name.toLowerCase());
    if (existing !== undefined) return { ok: true, tag: { id: existing.id, name: existing.name } };
  }
  const id = newId();
  await writeChanges(
    db,
    userId,
    [{ entity: 'tag', id, data: { id, name, createdAt: now.toISOString(), deletedAt: null } }],
    now,
  );
  return { ok: true, tag: { id, name } };
}
