import { z } from 'zod';
import type { LocalDate } from '../../dates';
import type { Account } from '../../entities';
import { type MinorDigits, minorToAmountBuffer } from '../../money';
import { isPocket } from '../../pockets';
import { emptyGoalForm, goalFormFrom } from '../../views/goalForm';
import type { WriteToolSpec } from '../types';
import {
  idField,
  localDateField,
  MAX_TOOL_MINOR,
  positiveMinorField,
  provided,
  type RemovedOutput,
  type ResolveResult,
  refusalMessage,
  removedOutput,
  type SavedOutput,
  savedOutput,
  updatedAtField,
  versionPairing,
  writeAnnotations,
} from './shared';
import type { TransactionWriteValues } from './transactions';

export const saveGoalInput = z.object({
  id: idField.optional().describe('Omit to create. To change a goal, its id from list_goals.'),
  updatedAt: updatedAtField.optional(),
  name: z.string().trim().min(1).max(60).optional().describe('Required to create.'),
  targetMinor: positiveMinorField
    .optional()
    .describe("The target, in minor units of the user's currency. Required to create."),
  deadline: localDateField
    .nullable()
    .optional()
    .describe('YYYY-MM-DD, after today; null for no deadline.'),
  parentAccountId: idField
    .optional()
    .describe(
      'Only when creating: the cash, checking, debit_card or savings account from list_accounts the money sits in.',
    ),
  alreadySavedMinor: z
    .number()
    .int()
    .min(0)
    .max(MAX_TOOL_MINOR)
    .optional()
    .describe('Only when creating: moved from that account into the goal today, as a transfer.'),
});
export type SaveGoalInput = z.infer<typeof saveGoalInput>;

/** What `saveGoal` (apps/web `src/server/write/goals.ts`) takes; equal to its `GoalInput`. */
export interface GoalWriteValues {
  id: string | null;
  name: string;
  icon: string;
  colorIndex: number;
  buffer: string;
  deadline: LocalDate | null;
  parentAccountId: string | null;
  savedBuffer: string;
  expectedUpdatedAt?: string;
}

/** The model's input as the goal form (§6.37): the wizard's fields to create, the edit page's to change. */
export function resolveGoalInput(
  input: SaveGoalInput,
  existing: Account | null,
  minorDigits: MinorDigits,
): ResolveResult<GoalWriteValues> {
  const pairing = versionPairing(input);
  if (pairing !== null) return { ok: false, message: pairing };
  if (existing !== null) {
    if (input.parentAccountId !== undefined && input.parentAccountId !== existing.parentAccountId) {
      return { ok: false, message: "A goal's account never changes." };
    }
    if (input.alreadySavedMinor !== undefined) {
      return {
        ok: false,
        message: 'alreadySavedMinor is only for a new goal. Move money with move_goal_money.',
      };
    }
  }
  const base = existing === null ? emptyGoalForm() : goalFormFrom(existing, minorDigits);
  const saved = existing === null ? (input.alreadySavedMinor ?? 0) : 0;
  return {
    ok: true,
    value: {
      id: existing?.id ?? null,
      name: input.name ?? base.name,
      icon: base.icon,
      colorIndex: base.colorIndex,
      buffer:
        input.targetMinor === undefined
          ? base.buffer
          : minorToAmountBuffer(input.targetMinor, minorDigits),
      deadline: provided(input.deadline, base.deadline),
      parentAccountId: existing === null ? (input.parentAccountId ?? null) : base.parentAccountId,
      savedBuffer: saved > 0 ? minorToAmountBuffer(saved, minorDigits) : '',
      expectedUpdatedAt: input.updatedAt,
    },
  };
}

export const saveGoalTool: WriteToolSpec<SaveGoalInput, SavedOutput> = {
  name: 'save_goal',
  title: 'Save a goal',
  description:
    "Create a savings goal, or change one. A goal is money set aside inside an account. To create: omit id and updatedAt and pass name, targetMinor and parentAccountId (a live cash, checking, debit_card or savings account from list_accounts); deadline (YYYY-MM-DD, after today) is optional; alreadySavedMinor moves that much from the account into the goal today, as a transfer. To change one: pass its id and updatedAt exactly as list_goals returned them, plus name, targetMinor or deadline (null removes it); the account never changes. Amounts are positive integers in minor units of the user's currency. To put money in or take it out later, use move_goal_money. Returns the id and the new updatedAt.",
  scope: 'write',
  input: saveGoalInput,
  output: savedOutput,
  annotations: writeAnnotations(false, false),
};

export const moveGoalMoneyInput = z.object({
  goalId: idField.describe('An open goal from list_goals.'),
  direction: z
    .enum(['set_aside', 'withdraw'])
    .describe("set_aside: from the goal's account into the goal. withdraw: back to the account."),
  amountMinor: positiveMinorField.describe("In minor units of the user's currency."),
  date: localDateField.optional().describe("YYYY-MM-DD. Defaults to the user's today."),
  description: z.string().max(120).optional().describe("Defaults to the goal's name."),
});
export type MoveGoalMoneyInput = z.infer<typeof moveGoalMoneyInput>;

export const moveGoalMoneyOutput = z.object({ transactionId: z.string(), updatedAt: z.string() });
export type MoveGoalMoneyOutput = z.infer<typeof moveGoalMoneyOutput>;

/**
 * «Metti da parte» / «Preleva» (§5.14): a transfer between the goal and its parent, the one way
 * money enters or leaves a pocket. The same transfer the web's links prefill (`goalLinks.ts`).
 */
export function resolveGoalTransfer(
  goal: Account,
  input: MoveGoalMoneyInput,
  today: LocalDate,
  minorDigits: MinorDigits,
): ResolveResult<TransactionWriteValues> {
  const parent = goal.parentAccountId ?? null;
  if (!isPocket(goal) || goal.archivedAt !== null || parent === null) {
    return { ok: false, message: refusalMessage('goal', { error: 'notFound' }) };
  }
  const setAside = input.direction === 'set_aside';
  return {
    ok: true,
    value: {
      id: null,
      kind: 'transfer',
      buffer: minorToAmountBuffer(input.amountMinor, minorDigits),
      date: input.date ?? today,
      accountId: setAside ? parent : goal.id,
      toAccountId: setAside ? goal.id : parent,
      categoryId: null,
      description: input.description ?? goal.name,
      tagIds: [],
      excludeFromTotals: false,
    },
  };
}

export const moveGoalMoneyTool: WriteToolSpec<MoveGoalMoneyInput, MoveGoalMoneyOutput> = {
  name: 'move_goal_money',
  title: 'Move money in or out of a goal',
  description:
    'Move money between a goal and the account it sits in: direction "set_aside" moves amountMinor from the account into the goal, "withdraw" moves it back. It is recorded as a transfer dated date (YYYY-MM-DD, defaults to the user\'s today) with description (defaults to the goal\'s name). goalId is an open goal from list_goals. amountMinor is a positive integer in minor units of the user\'s currency. Refused if it would take the source below zero. Returns the transfer\'s id and updatedAt, which save_transaction and delete_transaction accept like any other transaction.',
  scope: 'write',
  input: moveGoalMoneyInput,
  output: moveGoalMoneyOutput,
  annotations: writeAnnotations(false, false),
};

export const closeGoalInput = z.object({
  id: idField.describe('The goal id from list_goals.'),
  updatedAt: updatedAtField,
});
export type CloseGoalInput = z.infer<typeof closeGoalInput>;

export const closeGoalTool: WriteToolSpec<CloseGoalInput, RemovedOutput> = {
  name: 'close_goal',
  title: 'Close a goal',
  description:
    "Close a goal: the transfers into it planned for the future stop, the money left in it goes back to its account as a transfer dated today, and the goal is archived. Pass its id and updatedAt exactly as list_goals returned them. A closed goal's transactions become read-only.",
  scope: 'write',
  input: closeGoalInput,
  output: removedOutput,
  annotations: writeAnnotations(true, true),
};
