import {
  type ArchiveAccountInput,
  type ArchivedOutput,
  archiveAccountTool,
  isPocket,
  resolveAccountInput,
  type SaveAccountInput,
  type SavedOutput,
  saveAccountTool,
} from '@saldo/core';
import { getDb } from '../../db/client';
import { readUserData } from '../../userData/read';
import * as writes from '../../write/accounts';
import type { WriteToolHandler } from '../types';
import { archivedState, type Clock, minorDigitsOf, refuse, saved } from './shared';

/** §17.4.2: `save_account` and `archive_account` on the account form's write functions. */
export function accountHandlers(clock: Clock) {
  const saveAccount: WriteToolHandler<SaveAccountInput, SavedOutput> = {
    spec: saveAccountTool,
    async handle(principal, input) {
      const data = await readUserData(getDb(), principal.userId);
      const existing =
        input.id === undefined ? null : (data.accounts.find((row) => row.id === input.id) ?? null);
      // A goal is an account of type pocket, changed only through save_goal (§5.14).
      if (input.id !== undefined && (existing === null || isPocket(existing))) {
        return refuse('account', { error: 'notFound' });
      }
      const resolved = resolveAccountInput(input, existing, minorDigitsOf(data));
      if (!resolved.ok) return resolved;
      const values: writes.AccountInput = resolved.value;
      const result = await writes.saveAccount(getDb(), principal.userId, values, clock());
      if (!result.ok) return refuse('account', result);
      return saved('account', 'account', principal.userId, result.id, existing === null);
    },
  };

  const archiveAccount: WriteToolHandler<ArchiveAccountInput, ArchivedOutput> = {
    spec: archiveAccountTool,
    async handle(principal, input) {
      const write = input.action === 'archive' ? writes.archiveAccount : writes.restoreAccount;
      const result = await write(getDb(), principal.userId, input.id, clock(), input.updatedAt);
      if (!result.ok) return refuse('account', result);
      return archivedState('account', principal.userId, input.id);
    },
  };

  return { saveAccount, archiveAccount };
}
