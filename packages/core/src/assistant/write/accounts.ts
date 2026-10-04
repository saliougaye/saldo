import { z } from 'zod';
import type { Account, AccountType } from '../../entities';
import { type MinorDigits, minorToAmountBuffer } from '../../money';
import {
  ACCOUNT_TYPES,
  type AccountFormValues,
  accountFormFrom,
  emptyAccountForm,
} from '../../views/accountForm';
import type { WriteToolSpec } from '../types';
import {
  type ArchivedOutput,
  archivedOutput,
  idField,
  MAX_TOOL_MINOR,
  provided,
  type ResolveResult,
  type SavedOutput,
  savedOutput,
  updatedAtField,
  versionPairing,
  writeAnnotations,
} from './shared';

const dayField = z.number().int().min(1).max(28);

export const saveAccountInput = z.object({
  id: idField
    .optional()
    .describe('Omit to create. To change an account, its id from list_accounts (not a goal).'),
  updatedAt: updatedAtField.optional(),
  name: z.string().max(60).optional().describe('Required to create.'),
  type: z
    .enum(ACCOUNT_TYPES as [AccountType, ...AccountType[]])
    .optional()
    .describe('cash, checking, debit_card, credit_card, savings or investment. Default checking.'),
  balanceMinor: z
    .number()
    .int()
    .min(-MAX_TOOL_MINOR)
    .max(MAX_TOOL_MINOR)
    .optional()
    .describe(
      "The account's balance today in minor units, negative for a card in debt. Creating: defaults to 0. Changing: leave it out to keep the balance.",
    ),
  institution: z.string().max(60).optional(),
  includeInSpendable: z
    .boolean()
    .optional()
    .describe('Whether it counts in the spendable total. Defaults to true when creating.'),
  creditCloseDay: dayField.nullable().optional().describe('credit_card only: statement day, 1-28.'),
  creditChargeDay: dayField.nullable().optional().describe('credit_card only: charge day, 1-28.'),
  creditPaymentAccountId: idField
    .nullable()
    .optional()
    .describe('credit_card only: the account the card is charged to, from list_accounts.'),
});
export type SaveAccountInput = z.infer<typeof saveAccountInput>;

/**
 * What `saveAccount` (apps/web `src/server/write/accounts.ts`) takes; kept structurally equal to its
 * `AccountInput`. `buffer: null` keeps the stored opening balance.
 */
export interface AccountWriteValues {
  id: string | null;
  name: string;
  institution: string;
  type: AccountType;
  buffer: string | null;
  includeInSpendable: boolean;
  colorIndex: number;
  icon: string;
  creditCloseDay: number | null;
  creditChargeDay: number | null;
  creditPaymentAccountId: string | null;
  expectedUpdatedAt?: string;
}

function balanceBuffer(
  balanceMinor: number | undefined,
  creating: boolean,
  minorDigits: MinorDigits,
): string | null {
  if (balanceMinor !== undefined) return minorToAmountBuffer(balanceMinor, minorDigits);
  return creating ? '' : null;
}

/** The model's input as the account form (§6.22), from its defaults or from the stored row. */
export function resolveAccountInput(
  input: SaveAccountInput,
  existing: Account | null,
  minorDigits: MinorDigits,
): ResolveResult<AccountWriteValues> {
  const pairing = versionPairing(input);
  if (pairing !== null) return { ok: false, message: pairing };
  if (existing === null && input.name === undefined) {
    return { ok: false, message: 'To create an account, pass name.' };
  }
  // The balance in the base is never used: `balanceBuffer` decides it.
  const base: AccountFormValues =
    existing === null ? emptyAccountForm() : accountFormFrom(existing, 0, minorDigits);
  return {
    ok: true,
    value: {
      id: existing?.id ?? null,
      name: input.name ?? base.name,
      institution: input.institution ?? base.institution,
      type: input.type ?? base.type,
      buffer: balanceBuffer(input.balanceMinor, existing === null, minorDigits),
      includeInSpendable: input.includeInSpendable ?? base.includeInSpendable,
      colorIndex: base.colorIndex,
      icon: base.icon,
      creditCloseDay: provided(input.creditCloseDay, base.creditCloseDay),
      creditChargeDay: provided(input.creditChargeDay, base.creditChargeDay),
      creditPaymentAccountId: provided(input.creditPaymentAccountId, base.creditPaymentAccountId),
      expectedUpdatedAt: input.updatedAt,
    },
  };
}

export const saveAccountTool: WriteToolSpec<SaveAccountInput, SavedOutput> = {
  name: 'save_account',
  title: 'Save an account',
  description:
    "Create an account, or change one. To create: omit id and updatedAt and pass name; type defaults to checking and balanceMinor to 0. To change one: pass its id and updatedAt exactly as list_accounts returned them, plus only the fields to change. balanceMinor is the account's balance today, an integer in minor units of the user's currency (negative for a card in debt): when changing an account, Saldo adjusts its opening balance so that today's balance becomes that number, and no transaction changes; leave it out to keep the balance as it is. Goals are not changed here (use save_goal), and an archived account must be restored with archive_account first. The credit-card fields are kept only for type credit_card. Returns the id and the new updatedAt.",
  scope: 'write',
  input: saveAccountInput,
  output: savedOutput,
  annotations: writeAnnotations(false, false),
};

export const archiveAccountInput = z.object({
  id: idField.describe('The account id from list_accounts.'),
  updatedAt: updatedAtField,
  action: z.enum(['archive', 'restore']),
});
export type ArchiveAccountInput = z.infer<typeof archiveAccountInput>;

export const archiveAccountTool: WriteToolSpec<ArchiveAccountInput, ArchivedOutput> = {
  name: 'archive_account',
  title: 'Archive or restore an account',
  description:
    'Archive an account (action "archive") or bring an archived one back (action "restore"). Pass its id and updatedAt exactly as list_accounts returned them (ask list_accounts for archived accounts to restore one). An archived account keeps its transactions but is hidden from the lists and takes no new ones. An account that holds open goals cannot be archived: close them with close_goal first. Goals themselves are closed with close_goal, not archived here.',
  scope: 'write',
  input: archiveAccountInput,
  output: archivedOutput,
  annotations: writeAnnotations(true, true),
};
