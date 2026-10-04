import { z } from 'zod';
import { MAX_AMOUNT_SIGNIFICANT_DIGITS } from '../../money';
import type { BudgetMissing } from '../../views/budgetForm';
import type { GoalMissing } from '../../views/goalForm';
import type { MissingField } from '../../views/transactionForm';
import { toolDateSchema } from '../schemas';
import type { ToolAnnotations } from '../types';

/**
 * The largest amount the keypad types in any currency (§5.1): eight significant digits, the minor
 * ones included — 999,999.99 EUR, 99,999,999 JPY. The schemas refuse more, so a model hears it from
 * the tool's own schema instead of the server's bare `invalid`.
 */
export const MAX_TOOL_MINOR = 10 ** MAX_AMOUNT_SIGNIFICANT_DIGITS - 1;

export const idField = z.string().min(1);

/** §17.4.2: the version the model read, sent back so a phone's edit in between is never overwritten. */
export const updatedAtField = z
  .string()
  .min(1)
  .describe(
    'The updatedAt the read tool returned with this row, unchanged. If the row changed since (on the phone, the web or in another call), nothing is written and you are asked to read it again.',
  );

/** `YYYY-MM-DD`, a real calendar date: 0.4a-1's own date schema, so reads and writes agree. */
export const localDateField = toolDateSchema;

export const positiveMinorField = z.number().int().min(1).max(MAX_TOOL_MINOR);

/** A create or an edit: the row's id and its new version, which the next edit sends back. */
export const savedOutput = z.object({
  id: z.string(),
  updatedAt: z.string(),
  created: z.boolean(),
});
export type SavedOutput = z.infer<typeof savedOutput>;

/** A row that is gone (a tombstone, §7). */
export const removedOutput = z.object({ id: z.string() });
export type RemovedOutput = z.infer<typeof removedOutput>;

/** An archive or a restore: the state the row is in now, and its new version. */
export const archivedOutput = z.object({
  id: z.string(),
  archived: z.boolean(),
  updatedAt: z.string(),
});
export type ArchivedOutput = z.infer<typeof archivedOutput>;

/** What a resolver answers: the write function's input, or why the model's input cannot become one. */
export type ResolveResult<T> = { ok: true; value: T } | { ok: false; message: string };

export function writeAnnotations(destructive: boolean, idempotent: boolean): ToolAnnotations {
  return {
    readOnlyHint: false,
    destructiveHint: destructive,
    idempotentHint: idempotent,
    openWorldHint: false,
  };
}

/** `id` and `updatedAt` travel together: both to change a row, neither to create one. */
export function versionPairing(input: { id?: string; updatedAt?: string }): string | null {
  if (input.id !== undefined && input.updatedAt === undefined) {
    return 'To change an existing row, pass its updatedAt exactly as the read tool returned it, so an edit made meanwhile on the phone or the web is never overwritten.';
  }
  if (input.id === undefined && input.updatedAt !== undefined) {
    return 'updatedAt goes with id. To create a new row, omit both.';
  }
  return null;
}

/** A partial update's field: left out keeps the stored value; `null` is a value of its own. */
export function provided<T>(value: T | undefined, fallback: T): T {
  return value === undefined ? fallback : value;
}

export type WriteSubject = 'transaction' | 'account' | 'category' | 'tag' | 'budget' | 'goal';

/** Every `error` the server's write functions answer (`WriteError` and the per-module additions). */
export type WriteRefusalCode =
  | 'invalid'
  | 'notFound'
  | 'closedGoal'
  | 'conflict'
  | 'holdsGoals'
  | 'parentArchived'
  | 'taken'
  | 'parentInvalid'
  | 'moveInvalid';

/** Every `missing` the server's write functions answer: the forms' own "what is missing" names. */
export type WriteMissingCode = MissingField | BudgetMissing | GoalMissing;

export type WriteRefusal = { error: WriteRefusalCode } | { missing: WriteMissingCode };

const READ_TOOL: Record<WriteSubject, string> = {
  transaction: 'list_transactions',
  account: 'list_accounts',
  category: 'list_categories',
  tag: 'list_tags',
  budget: 'list_budgets',
  goal: 'list_goals',
};

const NOT_FOUND_HINT: Record<WriteSubject, string> = {
  transaction: '',
  account:
    ' A goal is changed with save_goal, and an archived account has to be restored with archive_account before it can be edited.',
  category: '',
  tag: '',
  budget: '',
  goal: ' A closed goal cannot be changed.',
};

const ERRORS: Record<WriteRefusalCode, (subject: WriteSubject) => string> = {
  invalid: (subject) =>
    `Saldo refused these values for the ${subject}. Check that amounts are integers in minor units (at most ${MAX_TOOL_MINOR}), dates are YYYY-MM-DD, names and descriptions are within their length, and every id is a live row of the right kind.`,
  notFound: (subject) =>
    `There is no live ${subject} with that id: it may be mistyped, or deleted or archived on another device. Read the current ids with ${READ_TOOL[subject]}.${NOT_FOUND_HINT[subject]}`,
  closedGoal: () =>
    'This transaction moves money into or out of a closed goal, and such rows are read-only.',
  conflict: (subject) =>
    `Nothing was written: the ${subject} changed after you read it (an edit from the phone, the web or another call). Read it again with ${READ_TOOL[subject]}, check that the change still makes sense, and retry with the new updatedAt.`,
  holdsGoals: () =>
    'This account holds open goals. Close them with close_goal before archiving the account.',
  parentArchived: () => "The goal's account is archived. Restore it with archive_account first.",
  taken: (subject) =>
    subject === 'tag'
      ? 'Another tag already has this name (names are unique, ignoring case). To fold one tag into the other, use merge_tags.'
      : 'One of these categories is already in another budget (a category, or the parent that covers it, can be in one budget only). See list_budgets.',
  parentInvalid: () =>
    'The parent must be a live top-level category of the same direction, other than the category itself. A category with subcategories cannot get a parent, and a subcategory cannot be restored while its parent is archived.',
  moveInvalid: () =>
    'moveToId must be a live category of the same direction that is neither the category being archived nor one of its subcategories.',
};

const MISSING: Record<WriteMissingCode, string> = {
  amount: 'The amount is missing or zero: pass amountMinor, a positive integer in minor units.',
  account:
    'The account is missing, archived, or not usable here. Account ids come from list_accounts; a goal takes or gives money only through move_goal_money.',
  category:
    'The category is missing, archived, or points the other way: an expense needs an expense category and an income an income category. Category ids come from list_categories.',
  destination: 'A transfer needs toAccountId, a live account from list_accounts.',
  sameAccount: 'A transfer needs two different accounts.',
  insufficientFunds:
    'This transfer would take its source account below zero, or deeper into the red. Lower the amount or move the money from another account.',
  categories: 'A budget needs at least one expense category: categoryIds from list_categories.',
  name: 'The name is missing.',
  target: 'The goal needs a target: targetMinor, a positive integer in minor units.',
  deadline: "The goal's deadline has to be after today, or null for none.",
  parent:
    'A new goal needs parentAccountId: a live cash, checking, debit card or savings account from list_accounts.',
};

/**
 * A write function's refusal as a model reads it (§17.4.2): what went wrong and which read tool to
 * call next. The one place these texts live, beside the descriptions they complete.
 */
export function refusalMessage(subject: WriteSubject, refusal: WriteRefusal): string {
  return 'missing' in refusal ? MISSING[refusal.missing] : ERRORS[refusal.error](subject);
}
