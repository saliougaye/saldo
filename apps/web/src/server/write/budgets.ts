import {
  amountBufferToMinor,
  BUDGET_ALERT_THRESHOLDS,
  budgetPeriodSchema,
  budgetStepMissing,
  getCurrency,
  newId,
  readSettings,
  sanitizeAmountInput,
  takenCategoryIds,
} from '@saldo/core';
import { z } from 'zod';
import type { ServerDatabase } from '../db/types';
import { readUserData } from '../userData/read';
import { tombstoned, unstamped } from './rows';
import type { WriteError } from './transactions';
import { movedSince, WriteRefused, writeInTransaction } from './writeChanges';

export type BudgetWriteError = WriteError | 'taken';

export const budgetInputSchema = z.object({
  /** Null for «Nuovo budget». */
  id: z.string().min(1).nullable(),
  /** Already resolved by the form: what was typed, or the name built from the categories (§6.18). */
  name: z.string().min(1).max(40),
  categoryIds: z.array(z.string().min(1)).max(50),
  buffer: z
    .string()
    .max(32)
    .refine((v) => v === '' || /^\d{1,13}(\.\d{0,3})?$/.test(v), 'Not an amount'),
  period: budgetPeriodSchema,
  alertThreshold: z
    .number()
    .refine((value) => (BUDGET_ALERT_THRESHOLDS as readonly number[]).includes(value))
    .nullable(),
  rollover: z.boolean(),
  icon: z.string().min(1).max(40),
  /** §17.4.2: the version the caller read the row at; a row that moved since is a `conflict`. */
  expectedUpdatedAt: z.string().min(1).optional(),
});

export type BudgetInput = z.infer<typeof budgetInputSchema>;

export type BudgetSaveResult =
  | { ok: true; id: string }
  | { ok: false; missing: 'categories' | 'amount' }
  | { ok: false; error: BudgetWriteError };

export type BudgetResult = { ok: true } | { ok: false; error: BudgetWriteError };

export async function saveBudget(
  db: ServerDatabase,
  userId: string,
  raw: unknown,
  now: Date,
): Promise<BudgetSaveResult> {
  const parsed = budgetInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const input = parsed.data;
  const name = input.name.trim();
  if (name === '') return { ok: false, error: 'invalid' };
  try {
    return await writeInTransaction<BudgetSaveResult>(db, userId, now, async (tx) => {
      const data = await readUserData(tx, userId);
      const { minorDigits } = getCurrency(readSettings(data.settings).currency);
      const fail = (error: BudgetWriteError) => ({
        writes: [],
        result: { ok: false, error } as const,
      });

      if (input.buffer !== sanitizeAmountInput(input.buffer, minorDigits)) return fail('invalid');
      const amount = amountBufferToMinor(input.buffer, minorDigits);
      if (!Number.isSafeInteger(amount)) return fail('invalid');

      const existing =
        input.id === null ? null : (data.budgets.find((row) => row.id === input.id) ?? null);
      if (input.id !== null && existing === null) return fail('notFound');
      if (existing !== null && movedSince(existing, input.expectedUpdatedAt)) {
        return fail('conflict');
      }

      const gap = budgetStepMissing('details', input, minorDigits);
      if (gap !== null) return { writes: [], result: { ok: false, missing: gap } };

      // Categories: distinct, spending ones, live unless the budget already holds them (the phone's
      // grid offers top-level expense categories; a child rides with its parent through
      // `expandCategoryIds`). An archived one it holds can stay, as an account keeps its own.
      const ids = [...new Set(input.categoryIds)];
      const valid = ids.every((id) =>
        data.categories.some(
          (category) =>
            category.id === id &&
            category.direction === 'expense' &&
            (category.archivedAt === null || existing?.categoryIds.includes(id) === true),
        ),
      );
      if (!valid) return fail('invalid');
      const taken = takenCategoryIds(data.budgets, data.categories, existing?.id ?? null);
      if (ids.some((id) => taken.has(id))) return fail('taken');

      const fields = {
        name,
        categoryIds: ids,
        amount,
        period: input.period,
        alertThreshold: input.alertThreshold,
        rollover: input.period === 'period' ? input.rollover : false,
        icon: input.icon,
      };
      const id = existing?.id ?? newId();
      const row =
        existing === null
          ? {
              ...fields,
              id,
              sortOrder: data.budgets.length,
              createdAt: now.toISOString(),
              deletedAt: null,
            }
          : { ...unstamped(existing), ...fields };
      return {
        writes: [{ entity: 'budget', id, data: row, basis: existing?.updatedAt ?? null }],
        result: { ok: true, id },
      };
    });
  } catch (error) {
    if (error instanceof WriteRefused) return { ok: false, error: error.reason };
    throw error;
  }
}

/** The budget is a tombstone (§7); the phone asks first and offers no undo, and so does the web. */
export async function deleteBudget(
  db: ServerDatabase,
  userId: string,
  id: string,
  now: Date,
  /** §17.4.2: the version the caller read; none checks nothing. */
  expectedUpdatedAt?: string,
): Promise<BudgetResult> {
  try {
    return await writeInTransaction<BudgetResult>(db, userId, now, async (tx) => {
      const data = await readUserData(tx, userId);
      const existing = data.budgets.find((row) => row.id === id);
      if (existing === undefined) return { writes: [], result: { ok: false, error: 'notFound' } };
      if (movedSince(existing, expectedUpdatedAt)) {
        return { writes: [], result: { ok: false, error: 'conflict' } };
      }
      return {
        writes: [
          {
            entity: 'budget',
            id,
            data: tombstoned(existing, now.toISOString()),
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
