import {
  ACCOUNT_TYPES,
  type Account,
  accountBalances,
  accountFormFrom,
  accountMissingForSave,
  accountTypesFor,
  canArchiveAccount,
  getCurrency,
  isPocket,
  MAX_COLOR_INDEX,
  newId,
  openingBalanceFrom,
  paymentAccountCandidates,
  readSettings,
} from '@saldo/core';
import { z } from 'zod';
import type { ServerDatabase } from '../db/types';
import { env } from '../env';
import { readUserData } from '../userData/read';
import { todayFor } from '../userData/today';
import { signedBufferOk } from './amounts';
import { unstamped } from './rows';
import type { WriteError } from './transactions';
import { WriteRefused, writeInTransaction } from './writeChanges';

export type AccountWriteError = WriteError | 'holdsGoals' | 'parentArchived';

export const accountInputSchema = z.object({
  /** Null for «Nuovo conto». */
  id: z.string().min(1).nullable(),
  name: z.string().max(60),
  institution: z.string().max(60),
  type: z.enum(ACCOUNT_TYPES as [Account['type'], ...Account['type'][]]),
  /** The **current** balance as the field holds it (§6.22): an optional `-`, `.` as the separator. */
  buffer: z
    .string()
    .max(32)
    .refine((value) => /^-?(\d{1,13}(\.\d{0,3})?)?$/.test(value), 'Not an amount'),
  includeInSpendable: z.boolean(),
  colorIndex: z.number().int().min(0).max(MAX_COLOR_INDEX),
  icon: z.string().min(1).max(40),
  creditCloseDay: z.number().int().min(1).max(28).nullable(),
  creditChargeDay: z.number().int().min(1).max(28).nullable(),
  creditPaymentAccountId: z.string().min(1).nullable(),
});

export type AccountInput = z.infer<typeof accountInputSchema>;

export type AccountSaveResult =
  | { ok: true; id: string }
  | { ok: false; missing: 'name' }
  | { ok: false; error: AccountWriteError };

export type AccountResult = { ok: true } | { ok: false; error: AccountWriteError };

export async function saveAccount(
  db: ServerDatabase,
  userId: string,
  raw: unknown,
  now: Date,
): Promise<AccountSaveResult> {
  const parsed = accountInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const input = parsed.data;
  const gap = accountMissingForSave(input);
  if (gap !== null) return { ok: false, missing: gap };
  try {
    return await writeInTransaction<AccountSaveResult>(db, userId, now, async (tx) => {
      const data = await readUserData(tx, userId);
      const settings = readSettings(data.settings);
      const { minorDigits } = getCurrency(settings.currency);
      const { today } = todayFor(settings, env().defaultTimeZone, now);
      const fail = (error: AccountWriteError) => ({
        writes: [],
        result: { ok: false, error } as const,
      });

      const existing =
        input.id === null ? null : (data.accounts.find((row) => row.id === input.id) ?? null);
      if (
        input.id !== null &&
        (existing === null || isPocket(existing) || existing.archivedAt !== null)
      ) {
        return fail('notFound');
      }
      const stored =
        existing === null
          ? undefined
          : accountFormFrom(
              existing,
              accountBalances(data.accounts, data.transactions, today).get(existing.id) ?? 0,
              minorDigits,
            ).buffer;
      if (!signedBufferOk(input.buffer, minorDigits, stored)) return fail('invalid');
      // §5.14: an account that holds goals stays one that can.
      if (!accountTypesFor(data.accounts, input.id).includes(input.type)) return fail('invalid');

      const card = input.type === 'credit_card';
      if (card && input.creditPaymentAccountId !== null) {
        const candidates = paymentAccountCandidates(data.accounts, input.id);
        const keepsOwn = input.creditPaymentAccountId === existing?.creditPaymentAccountId;
        if (!keepsOwn && !candidates.some((row) => row.id === input.creditPaymentAccountId)) {
          return fail('invalid');
        }
      }

      const fields = {
        name: input.name.trim(),
        type: input.type,
        institution: input.institution.trim().length > 0 ? input.institution.trim() : null,
        openingBalance: openingBalanceFrom(input, minorDigits, {
          accountId: existing?.id ?? null,
          txs: data.transactions,
          today,
        }),
        includeInSpendable: input.includeInSpendable,
        colorIndex: input.colorIndex,
        icon: input.icon,
        creditCloseDay: card ? input.creditCloseDay : null,
        creditChargeDay: card ? input.creditChargeDay : null,
        creditPaymentAccountId: card ? input.creditPaymentAccountId : null,
      };
      const id = existing?.id ?? newId();
      const row =
        existing === null
          ? {
              ...fields,
              id,
              archivedAt: null,
              sortOrder: data.accounts.length,
              createdAt: now.toISOString(),
              deletedAt: null,
            }
          : { ...unstamped(existing), ...fields };
      return {
        writes: [{ entity: 'account', id, data: row, basis: existing?.updatedAt ?? null }],
        result: { ok: true, id },
      };
    });
  } catch (error) {
    if (error instanceof WriteRefused) return { ok: false, error: error.reason };
    throw error;
  }
}

async function setArchived(
  db: ServerDatabase,
  userId: string,
  id: string,
  archive: boolean,
  now: Date,
): Promise<AccountResult> {
  try {
    return await writeInTransaction<AccountResult>(db, userId, now, async (tx) => {
      const data = await readUserData(tx, userId);
      const existing = data.accounts.find((row) => row.id === id);
      if (existing === undefined || isPocket(existing)) {
        return { writes: [], result: { ok: false, error: 'notFound' } };
      }
      // Already in the asked state (another tab got there first): nothing to write.
      if ((existing.archivedAt !== null) === archive) return { writes: [], result: { ok: true } };
      if (archive && !canArchiveAccount(data.accounts, id)) {
        return { writes: [], result: { ok: false, error: 'holdsGoals' } };
      }
      return {
        writes: [
          {
            entity: 'account',
            id,
            data: { ...unstamped(existing), archivedAt: archive ? now.toISOString() : null },
            basis: existing.updatedAt,
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

/** §5.6: its transactions stay, they still describe money that moved. An account with open goals is refused. */
export const archiveAccount = (db: ServerDatabase, userId: string, id: string, now: Date) =>
  setArchived(db, userId, id, true, now);

export const restoreAccount = (db: ServerDatabase, userId: string, id: string, now: Date) =>
  setArchived(db, userId, id, false, now);
