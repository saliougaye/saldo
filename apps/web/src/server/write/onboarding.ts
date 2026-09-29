import {
  accountTypeSchema,
  amountBufferToMinor,
  CURRENCY_CODES,
  getCurrency,
  newId,
  onboardingSeed,
  periodKindSchema,
  SEED_CATEGORIES,
  SETTINGS_ID,
  sanitizeAmountInput,
} from '@saldo/core';
import { type AppLocale, catalogs, isTimeZone, makeTranslator } from '@saldo/i18n';
import { accountTypeIcons } from '@saldo/ui';
import { z } from 'zod';
import type { ServerDatabase } from '../db/types';
import { readUserData } from '../userData/read';
import { type EntityWrite, WriteRefused, writeInTransaction } from './writeChanges';

const SEED_KEYS = new Set(SEED_CATEGORIES.map((category) => category.nameKey));

/** What the onboarding flow sends. Parsed here: a Server Action's argument is whatever a client posts. */
export const onboardingDraftSchema = z.object({
  periodKind: periodKindSchema,
  cycleStartDay: z.number().int().min(1).max(31),
  currency: z.enum(CURRENCY_CODES),
  accountName: z.string().max(60),
  /** A pocket is a goal (§5.14): only the goal wizard creates one. */
  accountType: accountTypeSchema.exclude(['pocket']),
  /**
   * The balance as the field holds it: an optional `-` (a card may start in debt), up to 13 integer
   * digits, an optional `.` and up to 3 decimals. Empty is a balance of zero, as on the phone.
   */
  balanceBuffer: z
    .string()
    .max(32)
    .refine((value) => /^-?(\d{1,13}(\.\d{0,3})?)?$/.test(value), 'Not an amount'),
  selectedCategoryKeys: z
    .array(z.string().refine((key) => SEED_KEYS.has(key), 'Not a seed category'))
    .max(SEED_CATEGORIES.length),
  /** The browser's `Intl` zone (§17.1.5). One `Intl` here does not know is saved as none. */
  timeZone: z.string().min(1).max(64),
});

export type OnboardingDraft = z.infer<typeof onboardingDraftSchema>;

export type OnboardingResult =
  | { ok: true }
  | { ok: false; error: 'invalid' | 'alreadyOnboarded' | 'conflict' };

/**
 * «Inizia» on the web (§17.1.3, decision 11): settings, the first account and the §4.2 seed in
 * **one** write, built by the same `onboardingSeed` the phone calls — so the seed categories carry
 * the ids every device gives them. An account that already has settings is left alone: a phone may
 * have onboarded it meanwhile, and its rows win (§8.3).
 *
 * The settings check runs inside the write's transaction, but under the epoch's *share* lock, so
 * two tabs finishing at the same instant can both see none. That race is accepted: the second
 * write overwrites `settings` with an equal row, converges on the same seed categories by id, and
 * adds a second first account, which the user can archive.
 */
export async function finishWebOnboarding(
  db: ServerDatabase,
  userId: string,
  raw: unknown,
  locale: AppLocale,
  now: Date,
): Promise<OnboardingResult> {
  const parsed = onboardingDraftSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const draft = parsed.data;

  const t = makeTranslator(catalogs[locale]);
  const { minorDigits } = getCurrency(draft.currency);
  // The shape above is currency-blind; this holds the buffer to what the keypad types in *this*
  // currency (§5.1), and to minor units that are a safe integer.
  const openingBalance = amountBufferToMinor(draft.balanceBuffer, minorDigits);
  if (
    draft.balanceBuffer !==
      sanitizeAmountInput(draft.balanceBuffer, minorDigits, { allowNegative: true }) ||
    !Number.isSafeInteger(openingBalance)
  ) {
    return { ok: false, error: 'invalid' };
  }
  const name = draft.accountName.trim();
  const seed = onboardingSeed({
    periodKind: draft.periodKind,
    cycleStartDay: draft.cycleStartDay,
    currency: draft.currency,
    language: 'system',
    theme: 'system',
    completedAt: now.toISOString(),
    timeZone: draft.timeZone,
    account: {
      name: name.length > 0 ? name : t('seed.firstAccount'),
      type: draft.accountType,
      openingBalance,
      icon: accountTypeIcons[draft.accountType],
    },
    selectedCategoryKeys: draft.selectedCategoryKeys,
    translate: (key) => t(`seed.${key}`),
  });
  const meta = { createdAt: now.toISOString(), deletedAt: null };
  const writes: EntityWrite[] = [
    {
      entity: 'settings',
      id: SETTINGS_ID,
      data: {
        ...seed.settings,
        timeZone: isTimeZone(draft.timeZone) ? draft.timeZone : null,
        ...meta,
      },
    },
    ...(seed.account === null
      ? []
      : [{ entity: 'account' as const, id: newId(), data: { ...seed.account, ...meta } }]),
    ...seed.categories.map((category) => ({
      entity: 'category' as const,
      id: category.id,
      data: { ...category, ...meta },
    })),
  ];

  try {
    return await writeInTransaction<OnboardingResult>(db, userId, now, async (tx) => {
      if ((await readUserData(tx, userId)).settings !== null) {
        return { writes: [], result: { ok: false, error: 'alreadyOnboarded' } };
      }
      return { writes, result: { ok: true } };
    });
  } catch (error) {
    if (error instanceof WriteRefused) return { ok: false, error: error.reason };
    throw error;
  }
}
