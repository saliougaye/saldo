import {
  type DeleteTransactionInput,
  deleteTransactionTool,
  type RemovedOutput,
  resolveTransactionInput,
  type SavedOutput,
  type SaveTransactionInput,
  saveTransactionTool,
} from '@saldo/core';
import { getDb } from '../../db/client';
import { readUserData } from '../../userData/read';
import * as writes from '../../write/transactions';
import type { WriteToolHandler } from '../types';
import { type Clock, minorDigitsOf, refuse, saved } from './shared';

/**
 * §17.4.2: `save_transaction` and `delete_transaction` on `saveTransaction` / `deleteTransaction`,
 * the functions the web's form calls. The handler reads only to merge a partial update; every rule
 * is the write function's, and the version the model read is checked inside its transaction.
 */
export function transactionHandlers(clock: Clock) {
  const saveTransaction: WriteToolHandler<SaveTransactionInput, SavedOutput> = {
    spec: saveTransactionTool,
    async handle(principal, input, ctx) {
      const data = await readUserData(getDb(), principal.userId);
      const existing =
        input.id === undefined
          ? null
          : (data.transactions.find((row) => row.id === input.id) ?? null);
      if (input.id !== undefined && existing === null) {
        return refuse('transaction', { error: 'notFound' });
      }
      const resolved = resolveTransactionInput(input, existing, ctx.today, minorDigitsOf(data));
      if (!resolved.ok) return resolved;
      const values: writes.TransactionInput = resolved.value;
      const result = await writes.saveTransaction(getDb(), principal.userId, values, clock());
      if (!result.ok) return refuse('transaction', result);
      return saved('transaction', 'transaction', principal.userId, result.id, existing === null);
    },
  };

  const deleteTransaction: WriteToolHandler<DeleteTransactionInput, RemovedOutput> = {
    spec: deleteTransactionTool,
    async handle(principal, input) {
      const result = await writes.deleteTransaction(
        getDb(),
        principal.userId,
        input.id,
        clock(),
        input.updatedAt,
      );
      if (!result.ok) return refuse('transaction', result);
      return { ok: true, value: { id: input.id } };
    },
  };

  return { saveTransaction, deleteTransaction };
}
