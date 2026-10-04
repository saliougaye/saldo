import {
  type Account,
  type AccountFormValues,
  accountBalances,
  accountFormFrom,
  accountTypesFor,
  type CurrencyCode,
  emptyAccountForm,
  emptyGoalForm,
  type GoalFormValues,
  getCurrency,
  goalFormFrom,
  isPocket,
  type LocalDate,
  type MinorDigits,
  paymentAccountCandidates,
  pocketParentCandidates,
  type UserData,
} from '@saldo/core';

export interface AccountFormView {
  mode: 'new' | 'edit';
  id: string | null;
  /**
   * The edited row's version as the page loaded it, sent back as `expectedUpdatedAt`: a phone's edit
   * after the page loaded answers `conflict` instead of being overwritten (§17.4.2). Null for a new one.
   */
  updatedAt: string | null;
  initial: AccountFormValues;
  /** Every type, or the ones a parent of goals may keep (§5.14, D24). */
  types: Account['type'][];
  /** Where a card may be charged; never the account itself. */
  paymentAccounts: { id: string; name: string }[];
  minorDigits: MinorDigits;
  /** The account's own name, for the archive dialog; empty for a new one. */
  name: string;
}

export interface GoalFormView {
  mode: 'new' | 'edit';
  id: string | null;
  /**
   * The edited row's version as the page loaded it, sent back as `expectedUpdatedAt`: a phone's edit
   * after the page loaded answers `conflict` instead of being overwritten (§17.4.2). Null for a new one.
   */
  updatedAt: string | null;
  initial: GoalFormValues;
  parents: { id: string; name: string; icon: string; colorIndex: number }[];
  minorDigits: MinorDigits;
  today: LocalDate;
}

interface Input {
  data: UserData;
  today: LocalDate;
  currency: CurrencyCode;
  mode: 'new' | 'edit';
  id: string | null;
}

/**
 * What the account panel reads (§6.22). An edit shows the *current* balance, which the server turns
 * back into an opening balance; a pocket, an archived account or an unknown id has no form here.
 */
export function accountFormView(input: Input): AccountFormView | null {
  const { data, today } = input;
  const { minorDigits } = getCurrency(input.currency);
  const editing =
    input.mode === 'edit' ? data.accounts.find((account) => account.id === input.id) : undefined;
  if (
    input.mode === 'edit' &&
    (editing === undefined || isPocket(editing) || editing.archivedAt !== null)
  ) {
    return null;
  }
  const balances = accountBalances(data.accounts, data.transactions, today);
  return {
    mode: input.mode,
    id: editing?.id ?? null,
    updatedAt: editing?.updatedAt ?? null,
    initial:
      editing === undefined
        ? emptyAccountForm()
        : accountFormFrom(editing, balances.get(editing.id) ?? 0, minorDigits),
    types: accountTypesFor(data.accounts, editing?.id ?? null),
    paymentAccounts: paymentAccountCandidates(data.accounts, editing?.id ?? null).map(
      (account) => ({ id: account.id, name: account.name }),
    ),
    minorDigits,
    name: editing?.name ?? '',
  };
}

/** The goal form (§6.37). An edit needs a live pocket; the parent is chosen only when creating. */
export function goalFormView(input: Input): GoalFormView | null {
  const { data } = input;
  const { minorDigits } = getCurrency(input.currency);
  const editing =
    input.mode === 'edit' ? data.accounts.find((account) => account.id === input.id) : undefined;
  if (
    input.mode === 'edit' &&
    (editing === undefined || !isPocket(editing) || editing.archivedAt !== null)
  ) {
    return null;
  }
  return {
    mode: input.mode,
    id: editing?.id ?? null,
    updatedAt: editing?.updatedAt ?? null,
    initial: editing === undefined ? emptyGoalForm() : goalFormFrom(editing, minorDigits),
    parents: pocketParentCandidates(data.accounts).map((account) => ({
      id: account.id,
      name: account.name,
      icon: account.icon,
      colorIndex: account.colorIndex,
    })),
    minorDigits,
    today: input.today,
  };
}

/**
 * The balance the account form sends (§6.22, §17.4.2): null when the field still holds the balance
 * the page loaded, which keeps the stored opening balance. Recomputing it from that figure would
 * cancel any transaction a phone pushed after the page loaded; a balance the user typed is sent as is.
 */
export function balanceToSend(loaded: string, current: string): string | null {
  return current === loaded ? null : current;
}
