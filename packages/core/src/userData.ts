import { z } from 'zod';
import {
  accountSchema,
  attachmentSchema,
  budgetSchema,
  categorySchema,
  type EntityName,
  recurrenceSchema,
  type Settings,
  settingsSchema,
  tagSchema,
  transactionSchema,
} from './entities';
import { SETTINGS_ID } from './ids';
import { formatHlc } from './sync/hlc';

/**
 * Everything one user has, typed (§17.1.2). The backup (§11.1) and the server's projection share
 * this shape, and so will MCP and AI: one type crosses all of them. `settings` is null until the
 * user onboards, and again after «Elimina tutti i dati».
 */
export const userDataSchema = z.object({
  settings: settingsSchema.nullable(),
  accounts: z.array(accountSchema),
  categories: z.array(categorySchema),
  tags: z.array(tagSchema),
  transactions: z.array(transactionSchema),
  recurrences: z.array(recurrenceSchema),
  budgets: z.array(budgetSchema),
  attachments: z.array(attachmentSchema),
});

export type UserData = z.infer<typeof userDataSchema>;

type Collection = Exclude<keyof UserData, 'settings'>;

/** Which collection of `UserData` holds each entity; `settings` is a singleton, not a list. */
export const USER_DATA_COLLECTIONS = {
  account: 'accounts',
  category: 'categories',
  tag: 'tags',
  transaction: 'transactions',
  recurrence: 'recurrences',
  budget: 'budgets',
  attachment: 'attachments',
} as const satisfies Record<Exclude<EntityName, 'settings'>, Collection>;

export function emptyUserData(): UserData {
  return {
    settings: null,
    accounts: [],
    categories: [],
    tags: [],
    transactions: [],
    recurrences: [],
    budgets: [],
    attachments: [],
  };
}

/** What a settings field falls back to when the stored value cannot be read (§17.1.2). */
export const SETTINGS_DEFAULTS = {
  periodKind: 'month',
  cycleStartDay: 27,
  currency: 'EUR',
  language: 'system',
  theme: 'system',
} as const satisfies Pick<
  Settings,
  'periodKind' | 'cycleStartDay' | 'currency' | 'language' | 'theme'
>;

const EPOCH = '1970-01-01T00:00:00.000Z';
/** Older than any real write, and still an HLC for code that parses it. */
const OLDEST_HLC = formatHlc({ wallMs: 0, counter: 0, deviceId: 'unknown' });
const shape = settingsSchema.shape;

/**
 * `settingsSchema`, with every field that fails replaced by its default instead of failing the row.
 * Read-only: push still validates with the strict schema, and this one never reaches storage.
 */
const lenientSettingsSchema = z.object({
  id: z.literal(SETTINGS_ID).catch(SETTINGS_ID),
  createdAt: shape.createdAt.catch(EPOCH),
  updatedAt: shape.updatedAt.catch(OLDEST_HLC),
  deletedAt: shape.deletedAt.catch(null),
  periodKind: shape.periodKind.catch(SETTINGS_DEFAULTS.periodKind),
  cycleStartDay: shape.cycleStartDay.catch(SETTINGS_DEFAULTS.cycleStartDay),
  currency: shape.currency.catch(SETTINGS_DEFAULTS.currency),
  language: shape.language.catch(SETTINGS_DEFAULTS.language),
  theme: shape.theme.catch(SETTINGS_DEFAULTS.theme),
  onboardingCompletedAt: shape.onboardingCompletedAt.catch(null),
  timeZone: shape.timeZone.catch(null),
});

/**
 * The settings row as the server reads it (§17.1.2): **never skipped**. Skipping an unreadable row
 * would look like «never onboarded», and onboarding would then write a new `settings` over the real
 * one. A field this build cannot read gets its default; the rest of the row is kept.
 */
export function readSettings(data: unknown): Settings {
  const object = typeof data === 'object' && data !== null && !Array.isArray(data) ? data : {};
  return lenientSettingsSchema.parse(object);
}
