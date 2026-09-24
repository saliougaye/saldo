import { z } from 'zod';
import { isLocalDate } from './dates';
import { CURRENCY_CODES } from './money';
import { PERIOD_KINDS } from './period';

const id = z.string().min(1);
/** ISO-8601 instant in UTC (D8). `z.iso.datetime()` rejects local times and offsets by default. */
const isoTimestamp = z.iso.datetime();
/**
 * `YYYY-MM-DD` calendar date. Validated with core's own `isLocalDate` rather than `z.iso.date()`
 * (which behaves identically) so the schemas and the date arithmetic in `dates.ts` can never
 * disagree about what a `LocalDate` is.
 */
const localDate = z.string().refine(isLocalDate, 'Expected YYYY-MM-DD date');
const minorUnits = z.number().int();
const positiveMinorUnits = z.number().int().positive();
/** Swatches in `categoryColors` (`@saldo/ui`) minus one; a mobile test keeps the two equal. */
export const MAX_COLOR_INDEX = 23;
const colorIndex = z.number().int().min(0).max(MAX_COLOR_INDEX);
const dayOfMonth = z.number().int().min(1).max(31);
const percent = z.number().int().min(1).max(100);

/** Fields shared by every synced entity. */
const syncMeta = {
  id,
  createdAt: isoTimestamp,
  /** Hybrid logical clock string, lexicographically ordered. */
  updatedAt: z.string().min(1),
  deletedAt: isoTimestamp.nullable(),
};

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** §10. Enforced by the repository, not only by the screen. */
export const MAX_ATTACHMENTS_PER_TRANSACTION = 5;

/** Thresholds offered by the "Avvisami a" segmented control (§6.18). Any percent is valid. */
export const BUDGET_ALERT_THRESHOLDS = [75, 90, 100] as const;

export const periodKindSchema = z.enum(PERIOD_KINDS);

/**
 * The `language` setting: `system`, then every locale `@saldo/i18n` has a catalog for (its tests
 * keep the two lists in step). Widening it means an older build rejects a settings row a newer one
 * wrote; accepted while no build is public (`SYNC_SCHEMA_VERSION` stays frozen until then).
 */
export const LANGUAGE_PREFERENCES = ['system', 'it', 'en', 'fr', 'de', 'sv', 'es', 'pt'] as const;

export const settingsSchema = z.object({
  ...syncMeta,
  id: z.literal('settings'),
  /** How the user tracks spending (§5.2); the pay cycle is one kind among four. */
  periodKind: periodKindSchema,
  /** Read only when `periodKind === 'cycle'`, and kept so switching back remembers the day. */
  cycleStartDay: dayOfMonth,
  currency: z.enum(CURRENCY_CODES),
  language: z.enum(LANGUAGE_PREFERENCES),
  theme: z.enum(['system', 'dark', 'light']),
  onboardingCompletedAt: isoTimestamp.nullable(),
});

export const accountTypeSchema = z.enum([
  'cash',
  'checking',
  'debit_card',
  'credit_card',
  'savings',
  'investment',
  /** A goal (D24, §5.14): money set aside inside another account. Created by the goal wizard only. */
  'pocket',
]);

const present = (value: unknown): boolean => value !== null && value !== undefined;

const GOAL_FIELDS = ['parentAccountId', 'goalTarget', 'goalDeadline', 'goalStartDate'] as const;

interface AccountShape {
  type: z.infer<typeof accountTypeSchema>;
  includeInSpendable: boolean;
  parentAccountId?: string | null;
  goalTarget?: number | null;
  goalDeadline?: string | null;
  goalStartDate?: string | null;
}

/**
 * §4.1, §5.14: a pocket needs its parent, its target and its start, is never spendable, and its
 * deadline (optional) is not before its start; every other account carries none of the four.
 */
function refineAccountShape(account: AccountShape, ctx: z.RefinementCtx): void {
  if (account.type !== 'pocket') {
    for (const field of GOAL_FIELDS) {
      if (present(account[field])) {
        ctx.addIssue({ code: 'custom', message: 'Only a pocket carries a goal', path: [field] });
      }
    }
    return;
  }
  for (const field of ['parentAccountId', 'goalTarget', 'goalStartDate'] as const) {
    if (!present(account[field])) {
      ctx.addIssue({ code: 'custom', message: 'A pocket needs this field', path: [field] });
    }
  }
  if (account.includeInSpendable) {
    ctx.addIssue({
      code: 'custom',
      message: 'A pocket is never spendable',
      path: ['includeInSpendable'],
    });
  }
  const { goalDeadline, goalStartDate } = account;
  if (
    typeof goalDeadline === 'string' &&
    typeof goalStartDate === 'string' &&
    goalDeadline < goalStartDate
  ) {
    ctx.addIssue({
      code: 'custom',
      message: 'The deadline comes after the start',
      path: ['goalDeadline'],
    });
  }
}

export const accountSchema = z
  .object({
    ...syncMeta,
    name: z.string().min(1).max(60),
    type: accountTypeSchema,
    institution: z.string().max(60).nullable(),
    openingBalance: minorUnits,
    includeInSpendable: z.boolean(),
    colorIndex,
    icon: z.string().min(1),
    creditCloseDay: z.number().int().min(1).max(28).nullable(),
    creditChargeDay: z.number().int().min(1).max(28).nullable(),
    creditPaymentAccountId: id.nullable(),
    archivedAt: isoTimestamp.nullable(),
    sortOrder: z.number().int(),
    /**
     * The four goal fields (§5.14). Optional as well as nullable: a row written before they
     * existed still parses on pull (§8.1). Widened before any public build, so
     * `SYNC_SCHEMA_VERSION` does not move.
     */
    parentAccountId: id.nullable().optional(),
    goalTarget: positiveMinorUnits.nullable().optional(),
    goalDeadline: localDate.nullable().optional(),
    goalStartDate: localDate.nullable().optional(),
  })
  .superRefine(refineAccountShape);

export const categoryDirectionSchema = z.enum(['expense', 'income']);

export const categorySchema = z.object({
  ...syncMeta,
  name: z.string().min(1).max(40),
  direction: categoryDirectionSchema,
  parentId: id.nullable(),
  icon: z.string().min(1),
  colorIndex,
  archivedAt: isoTimestamp.nullable(),
  sortOrder: z.number().int(),
});

export const tagSchema = z.object({
  ...syncMeta,
  name: z.string().min(1).max(40),
});

export const transactionKindSchema = z.enum(['expense', 'income', 'transfer']);

/** Fields the transfer/category invariant applies to, shared by transactions and templates. */
interface TransactionShape {
  kind: z.infer<typeof transactionKindSchema>;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
}

/**
 * Cross-field rule of §4: transfers move money between two different accounts and carry no
 * category; expenses and income need a category and no destination. Applied to recurrence
 * templates too, otherwise the materialiser could build occurrences that fail this very schema.
 */
function refineTransactionShape(tx: TransactionShape, ctx: z.RefinementCtx): void {
  if (tx.kind === 'transfer') {
    if (tx.toAccountId === null || tx.toAccountId === tx.accountId) {
      ctx.addIssue({
        code: 'custom',
        message: 'Transfers need a different destination account',
        path: ['toAccountId'],
      });
    }
    if (tx.categoryId !== null) {
      ctx.addIssue({
        code: 'custom',
        message: 'Transfers have no category',
        path: ['categoryId'],
      });
    }
    return;
  }
  if (tx.categoryId === null) {
    ctx.addIssue({ code: 'custom', message: 'Category is required', path: ['categoryId'] });
  }
  if (tx.toAccountId !== null) {
    ctx.addIssue({
      code: 'custom',
      message: 'Only transfers have a destination account',
      path: ['toAccountId'],
    });
  }
}

export const transactionSchema = z
  .object({
    ...syncMeta,
    kind: transactionKindSchema,
    amount: positiveMinorUnits,
    date: localDate,
    accountId: id,
    toAccountId: id.nullable(),
    categoryId: id.nullable(),
    description: z.string().max(120),
    note: z.string().max(1000).nullable(),
    tagIds: z.array(id),
    excludeFromTotals: z.boolean(),
    recurrenceId: id.nullable(),
  })
  .superRefine(refineTransactionShape);

export const recurrenceFrequencySchema = z.enum(['daily', 'weekly', 'monthly', 'yearly']);

export const recurrenceSchema = z.object({
  ...syncMeta,
  frequency: recurrenceFrequencySchema,
  /**
   * Every `interval` units of `frequency`: 2 + weekly = every two weeks. Defaults to 1 so a row
   * written before the column existed still parses on pull (§8).
   */
  interval: z.number().int().min(1).max(99).default(1),
  startDate: localDate,
  endDate: localDate.nullable(),
  template: z
    .object({
      kind: transactionKindSchema,
      amount: positiveMinorUnits,
      accountId: id,
      toAccountId: id.nullable(),
      categoryId: id.nullable(),
      description: z.string().max(120),
      tagIds: z.array(id),
      excludeFromTotals: z.boolean(),
    })
    .superRefine(refineTransactionShape),
});

/**
 * §5.8. `'period'` means the app's own period, whatever kind that is; the other three are
 * absolute windows, so a budget can be monthly while the app tracks a pay cycle.
 */
export const budgetPeriodSchema = z.enum(['period', 'week', 'month', 'year']);

export const budgetSchema = z.object({
  ...syncMeta,
  name: z.string().min(1).max(40),
  categoryIds: z.array(id).min(1),
  amount: positiveMinorUnits,
  period: budgetPeriodSchema,
  /** Percent of the limit that triggers the alert; null = "Mai". The UI offers
   * `BUDGET_ALERT_THRESHOLDS`, but the domain rule (§5.8) is plain arithmetic on any percentage. */
  alertThreshold: percent.nullable(),
  rollover: z.boolean(),
  icon: z.string().min(1),
  sortOrder: z.number().int(),
});

export const attachmentSchema = z.object({
  ...syncMeta,
  transactionId: id,
  mimeType: z.enum(['image/jpeg', 'image/png', 'application/pdf']),
  byteSize: z.number().int().positive().max(MAX_ATTACHMENT_BYTES),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
});

export const entitySchemas = {
  settings: settingsSchema,
  account: accountSchema,
  category: categorySchema,
  tag: tagSchema,
  transaction: transactionSchema,
  recurrence: recurrenceSchema,
  budget: budgetSchema,
  attachment: attachmentSchema,
} as const;

export type EntityName = keyof typeof entitySchemas;
export type PeriodKindValue = z.infer<typeof periodKindSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type AccountType = z.infer<typeof accountTypeSchema>;
export type Account = z.infer<typeof accountSchema>;
export type CategoryDirection = z.infer<typeof categoryDirectionSchema>;
export type Category = z.infer<typeof categorySchema>;
export type Tag = z.infer<typeof tagSchema>;
export type TransactionKind = z.infer<typeof transactionKindSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type Recurrence = z.infer<typeof recurrenceSchema>;
export type RecurrenceFrequency = z.infer<typeof recurrenceFrequencySchema>;
/** When a recurrence fires. The form and the sheets pass this around; the template travels apart. */
export type RecurrenceRule = Pick<Recurrence, 'frequency' | 'interval' | 'endDate'>;
export type BudgetPeriod = z.infer<typeof budgetPeriodSchema>;
export type Budget = z.infer<typeof budgetSchema>;
export type Attachment = z.infer<typeof attachmentSchema>;
