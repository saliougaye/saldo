import { openingBalanceForCurrent } from '../accountSeries';
import { type Account, accountTypeSchema } from '../entities';
import { amountBufferToMinor, type MinorDigits, minorToAmountBuffer } from '../money';
import { POCKET_PARENT_TYPES, pocketsOf } from '../pockets';

/** A pocket is a goal (§5.14): made by the goal form, never picked as a type. */
export const ACCOUNT_TYPES = accountTypeSchema.options.filter((type) => type !== 'pocket');

export interface AccountFormValues {
  name: string;
  institution: string;
  type: Account['type'];
  /** Keypad buffer of the **current** balance, not the opening one (§6.22). */
  buffer: string;
  includeInSpendable: boolean;
  colorIndex: number;
  icon: string;
  creditCloseDay: number | null;
  creditChargeDay: number | null;
  /** Credit cards only: the account the card is charged to (§4, §6.22). */
  creditPaymentAccountId: string | null;
}

export function emptyAccountForm(): AccountFormValues {
  return {
    name: '',
    institution: '',
    type: 'checking',
    buffer: '',
    includeInSpendable: true,
    colorIndex: 0,
    icon: 'landmark',
    creditCloseDay: null,
    creditChargeDay: null,
    creditPaymentAccountId: null,
  };
}

export function accountFormFrom(
  account: Account,
  currentBalance: number,
  minorDigits: MinorDigits,
): AccountFormValues {
  return {
    name: account.name,
    institution: account.institution ?? '',
    type: account.type,
    buffer: minorToAmountBuffer(currentBalance, minorDigits),
    includeInSpendable: account.includeInSpendable,
    colorIndex: account.colorIndex,
    icon: account.icon,
    creditCloseDay: account.creditCloseDay,
    creditChargeDay: account.creditChargeDay,
    creditPaymentAccountId: account.creditPaymentAccountId,
  };
}

/**
 * The opening balance to store for what the user typed (§6.22). In edit mode the amount is the
 * *current* balance, so it is turned back into an opening balance.
 */
export function openingBalanceFrom(
  values: Pick<AccountFormValues, 'buffer'>,
  minorDigits: MinorDigits,
  context: {
    accountId: string | null;
    txs: Parameters<typeof openingBalanceForCurrent>[0]['txs'];
    today: string;
  },
): number {
  const current = amountBufferToMinor(values.buffer, minorDigits);
  if (context.accountId === null) return current;
  return openingBalanceForCurrent({
    accountId: context.accountId,
    currentBalance: current,
    txs: context.txs,
    today: context.today,
  });
}

/**
 * What the form is still waiting for, or `null` when nothing is. The name is the only thing an
 * account cannot be saved without (§6.22): a balance of zero is a balance.
 */
export function accountMissingForSave(values: Pick<AccountFormValues, 'name'>): 'name' | null {
  return values.name.trim().length > 0 ? null : 'name';
}

/** An account that holds goals stays one that can (§5.14, D24): no card, no investments. */
export function accountTypesFor(
  accounts: readonly (Pick<Account, 'id' | 'type' | 'archivedAt'> & {
    parentAccountId?: string | null;
  })[],
  accountId: string | null,
): Account['type'][] {
  return accountId !== null && pocketsOf(accounts, accountId).length > 0
    ? ACCOUNT_TYPES.filter((type) => POCKET_PARENT_TYPES.includes(type))
    : [...ACCOUNT_TYPES];
}
