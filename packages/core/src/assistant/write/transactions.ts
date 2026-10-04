import { z } from 'zod';
import type { LocalDate } from '../../dates';
import { type Transaction, type TransactionKind, transactionKindSchema } from '../../entities';
import { type MinorDigits, minorToAmountBuffer } from '../../money';
import {
  changeKind,
  emptyForm,
  formFromTransaction,
  type TransactionFormValues,
} from '../../views/transactionForm';
import type { WriteToolSpec } from '../types';
import {
  idField,
  localDateField,
  positiveMinorField,
  provided,
  type RemovedOutput,
  type ResolveResult,
  removedOutput,
  type SavedOutput,
  savedOutput,
  updatedAtField,
  versionPairing,
  writeAnnotations,
} from './shared';

export const saveTransactionInput = z.object({
  id: idField
    .optional()
    .describe('Omit to create. To change a transaction, its id from list_transactions.'),
  updatedAt: updatedAtField.optional(),
  kind: transactionKindSchema
    .optional()
    .describe('expense, income or transfer. Required to create.'),
  amountMinor: positiveMinorField
    .optional()
    .describe('Positive integer in minor units of the user\'s currency: 4820 is 48.20 EUR.'),
  date: localDateField
    .optional()
    .describe('YYYY-MM-DD. Defaults to the user\'s today when creating.'),
  accountId: idField
    .optional()
    .describe(
      'The account the money leaves (expense, transfer) or enters (income), from list_accounts. Required to create.',
    ),
  toAccountId: idField
    .nullable()
    .optional()
    .describe('Transfers only: the account the money goes to, from list_accounts.'),
  categoryId: idField
    .nullable()
    .optional()
    .describe('Expenses and income only: a category of the same direction, from list_categories.'),
  description: z.string().max(120).optional(),
  tagIds: z
    .array(idField)
    .max(50)
    .optional()
    .describe('Replaces the whole list. Tag ids from list_tags or save_tag.'),
  excludeFromTotals: z
    .boolean()
    .optional()
    .describe('True keeps it out of the period totals and the statistics.'),
});
export type SaveTransactionInput = z.infer<typeof saveTransactionInput>;

/**
 * What `saveTransaction` (apps/web `src/server/write/transactions.ts`) takes: the web form's
 * values, plus the version the model read. Kept structurally equal to its `TransactionInput`; the
 * handler assigns one to the other, so a drift is a type error.
 */
export interface TransactionWriteValues {
  id: string | null;
  kind: TransactionKind;
  buffer: string;
  date: LocalDate;
  accountId: string | null;
  toAccountId: string | null;
  categoryId: string | null;
  description: string;
  tagIds: string[];
  excludeFromTotals: boolean;
  expectedUpdatedAt?: string;
}

const given = <T>(value: T | null | undefined): value is T => value !== undefined && value !== null;

/**
 * The model's input as the form the server already validates (§17.4.2). A create starts from the
 * new-transaction form, an update from the stored row; given fields override, so a partial update
 * leaves the rest as the phone last wrote it. Every rule — accounts, categories, pockets, funds —
 * stays in `saveTransaction`; this only refuses what no form could express.
 */
export function resolveTransactionInput(
  input: SaveTransactionInput,
  existing: Transaction | null,
  today: LocalDate,
  minorDigits: MinorDigits,
): ResolveResult<TransactionWriteValues> {
  const pairing = versionPairing(input);
  if (pairing !== null) return { ok: false, message: pairing };
  const kind = input.kind ?? existing?.kind;
  if (kind === undefined) {
    return {
      ok: false,
      message: 'To create a transaction, pass kind: expense, income or transfer.',
    };
  }
  if (kind === 'transfer' && given(input.categoryId)) {
    return { ok: false, message: 'A transfer has no category: leave categoryId out.' };
  }
  if (kind !== 'transfer' && given(input.toAccountId)) {
    return {
      ok: false,
      message: 'Only a transfer has toAccountId: leave it out for an expense or an income.',
    };
  }
  const start: TransactionFormValues =
    existing === null ? emptyForm(today, null) : formFromTransaction(existing, minorDigits);
  const base = start.kind === kind ? start : changeKind(start, kind);
  return {
    ok: true,
    value: {
      id: existing?.id ?? null,
      kind,
      buffer:
        input.amountMinor === undefined
          ? base.buffer
          : minorToAmountBuffer(input.amountMinor, minorDigits),
      date: input.date ?? base.date,
      accountId: input.accountId ?? base.accountId,
      toAccountId: kind === 'transfer' ? provided(input.toAccountId, base.toAccountId) : null,
      categoryId: kind === 'transfer' ? null : provided(input.categoryId, base.categoryId),
      description: input.description ?? base.description,
      tagIds: input.tagIds ?? base.tagIds,
      excludeFromTotals: input.excludeFromTotals ?? base.excludeFromTotals,
      expectedUpdatedAt: input.updatedAt,
    },
  };
}

export const saveTransactionTool: WriteToolSpec<SaveTransactionInput, SavedOutput> = {
  name: 'save_transaction',
  title: 'Save a transaction',
  description:
    "Create a transaction, or change one. To create: omit id and updatedAt; pass kind, amountMinor, accountId and, for an expense or an income, categoryId — for a transfer, toAccountId instead. date defaults to the user's today (see get_preferences). To change one: pass its id and updatedAt exactly as list_transactions returned them, plus only the fields to change; the others keep their value. If it changed since you read it (on the phone, say), nothing is written and you are asked to read it again. Amounts are positive integers in minor units of the user's currency (4820 = 48.20 EUR). Dates are YYYY-MM-DD. Account ids come from list_accounts, category ids from list_categories, tag ids from list_tags (create a missing tag with save_tag first); tagIds replaces the whole list. Money goes into or out of a goal only with move_goal_money. Returns the id and the new updatedAt.",
  scope: 'write',
  input: saveTransactionInput,
  output: savedOutput,
  annotations: writeAnnotations(false, false),
};

export const deleteTransactionInput = z.object({
  id: idField.describe('The transaction id from list_transactions.'),
  updatedAt: updatedAtField,
});
export type DeleteTransactionInput = z.infer<typeof deleteTransactionInput>;

export const deleteTransactionTool: WriteToolSpec<DeleteTransactionInput, RemovedOutput> = {
  name: 'delete_transaction',
  title: 'Delete a transaction',
  description:
    'Delete a transaction. Pass its id and updatedAt exactly as list_transactions returned them; if it changed since you read it, nothing is deleted. A transaction that moves money into or out of a closed goal cannot be deleted. Other devices receive the deletion on their next sync.',
  scope: 'write',
  input: deleteTransactionInput,
  output: removedOutput,
  annotations: writeAnnotations(true, true),
};
