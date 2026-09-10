import { z } from 'zod';
import { isLocalDate } from './dates';
import { CURRENCY_CODES } from './money';

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
const colorIndex = z.number().int().min(0).max(9);
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

/** Thresholds offered by the "Avvisami a" segmented control (§6.18). Any percent is valid. */
export const BUDGET_ALERT_THRESHOLDS = [75, 90, 100] as const;

export const settingsSchema = z.object({
  ...syncMeta,
  id: z.literal('settings'),
  cycleStartDay: dayOfMonth,
  currency: z.enum(CURRENCY_CODES),
  language: z.enum(['system', 'it', 'en']),
  theme: z.enum(['system', 'dark', 'light']),
  onboardingCompletedAt: isoTimestamp.nullable(),
});

export const accountTypeSchema = z.enum([
  'cash',
  'checking',
  'credit_card',
  'savings',
  'investment',
]);

export const accountSchema = z.object({
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
});

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

export const recurrenceSchema = z.object({
  ...syncMeta,
  frequency: z.literal('monthly'),
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

export const budgetSchema = z.object({
  ...syncMeta,
  name: z.string().min(1).max(40),
  categoryIds: z.array(id).min(1),
  amount: positiveMinorUnits,
  period: z.enum(['cycle', 'week', 'year']),
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
export type Settings = z.infer<typeof settingsSchema>;
export type AccountType = z.infer<typeof accountTypeSchema>;
export type Account = z.infer<typeof accountSchema>;
export type CategoryDirection = z.infer<typeof categoryDirectionSchema>;
export type Category = z.infer<typeof categorySchema>;
export type Tag = z.infer<typeof tagSchema>;
export type TransactionKind = z.infer<typeof transactionKindSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type Recurrence = z.infer<typeof recurrenceSchema>;
export type Budget = z.infer<typeof budgetSchema>;
export type Attachment = z.infer<typeof attachmentSchema>;
