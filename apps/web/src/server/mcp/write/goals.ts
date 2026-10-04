import {
  type CloseGoalInput,
  closeGoalTool,
  isPocket,
  type MoveGoalMoneyInput,
  type MoveGoalMoneyOutput,
  moveGoalMoneyTool,
  type RemovedOutput,
  resolveGoalInput,
  resolveGoalTransfer,
  type SavedOutput,
  type SaveGoalInput,
  saveGoalTool,
} from '@saldo/core';
import { getDb } from '../../db/client';
import { readUserData } from '../../userData/read';
import * as goalWrites from '../../write/goals';
import * as transactionWrites from '../../write/transactions';
import type { WriteToolHandler } from '../types';
import { type Clock, currentStamp, minorDigitsOf, refuse, saved } from './shared';

/**
 * §17.4.2: `save_goal` and `close_goal` on the goal writes; `move_goal_money` is the transfer
 * «Metti da parte» / «Preleva» prefill, saved through `saveTransaction` like any transfer.
 */
export function goalHandlers(clock: Clock) {
  const saveGoal: WriteToolHandler<SaveGoalInput, SavedOutput> = {
    spec: saveGoalTool,
    async handle(principal, input) {
      const data = await readUserData(getDb(), principal.userId);
      const existing =
        input.id === undefined ? null : (data.accounts.find((row) => row.id === input.id) ?? null);
      // An account that is not an open goal is not one save_goal can change (§5.14).
      if (
        input.id !== undefined &&
        (existing === null || !isPocket(existing) || existing.archivedAt !== null)
      ) {
        return refuse('goal', { error: 'notFound' });
      }
      const resolved = resolveGoalInput(input, existing, minorDigitsOf(data));
      if (!resolved.ok) return resolved;
      const values: goalWrites.GoalInput = resolved.value;
      const result = await goalWrites.saveGoal(getDb(), principal.userId, values, clock());
      if (!result.ok) return refuse('goal', result);
      return saved('goal', 'account', principal.userId, result.id, existing === null);
    },
  };

  const moveGoalMoney: WriteToolHandler<MoveGoalMoneyInput, MoveGoalMoneyOutput> = {
    spec: moveGoalMoneyTool,
    async handle(principal, input, ctx) {
      const data = await readUserData(getDb(), principal.userId);
      const goal = data.accounts.find((row) => row.id === input.goalId);
      if (goal === undefined) return refuse('goal', { error: 'notFound' });
      const resolved = resolveGoalTransfer(goal, input, ctx.today, minorDigitsOf(data));
      if (!resolved.ok) return resolved;
      const values: transactionWrites.TransactionInput = resolved.value;
      const result = await transactionWrites.saveTransaction(
        getDb(),
        principal.userId,
        values,
        clock(),
      );
      if (!result.ok) return refuse('goal', result);
      const updatedAt = await currentStamp(principal.userId, 'transaction', result.id);
      if (updatedAt === null) return refuse('transaction', { error: 'notFound' });
      return { ok: true, value: { transactionId: result.id, updatedAt } };
    },
  };

  const closeGoal: WriteToolHandler<CloseGoalInput, RemovedOutput> = {
    spec: closeGoalTool,
    async handle(principal, input) {
      const result = await goalWrites.closeGoal(
        getDb(),
        principal.userId,
        input.id,
        clock(),
        input.updatedAt,
      );
      if (!result.ok) return refuse('goal', result);
      return { ok: true, value: { id: input.id } };
    },
  };

  return { saveGoal, moveGoalMoney, closeGoal };
}
