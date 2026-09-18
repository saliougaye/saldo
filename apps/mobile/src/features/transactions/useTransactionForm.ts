import {
  addDays,
  amountBufferToMinor,
  type LocalDate,
  type MinorDigits,
  minorToAmountBuffer,
  type RecurrenceRule,
  type Transaction,
  type TransactionKind,
} from '@saldo/core';

export interface TransactionFormValues {
  kind: TransactionKind;
  buffer: string;
  date: LocalDate;
  accountId: string | null;
  toAccountId: string | null;
  categoryId: string | null;
  description: string;
  tagIds: string[];
  excludeFromTotals: boolean;
  /** Null = does not repeat. On an occurrence this stays null: its rule lives on the recurrence. */
  recurrence: RecurrenceRule | null;
}

export function emptyForm(today: LocalDate, accountId: string | null): TransactionFormValues {
  return {
    kind: 'expense',
    buffer: '',
    date: today,
    accountId,
    toAccountId: null,
    categoryId: null,
    description: '',
    tagIds: [],
    excludeFromTotals: false,
    recurrence: null,
  };
}

export function formFromTransaction(
  transaction: Transaction,
  minorDigits: MinorDigits,
): TransactionFormValues {
  return {
    kind: transaction.kind,
    buffer: minorToAmountBuffer(transaction.amount, minorDigits),
    date: transaction.date,
    accountId: transaction.accountId,
    toAccountId: transaction.toAccountId,
    categoryId: transaction.categoryId,
    description: transaction.description,
    tagIds: [...transaction.tagIds],
    excludeFromTotals: transaction.excludeFromTotals,
    recurrence: null,
  };
}

/** What a form is still missing, in the order the screen asks for it. */
export type MissingField =
  | 'amount'
  | 'account'
  | 'category'
  | 'destination'
  | 'sameAccount'
  | 'insufficientFunds';

/**
 * §6.16: save is disabled until the amount is above zero, an account is chosen, a non-transfer has
 * a category, and a transfer has a different destination. This says **which** of those is missing,
 * so the screen can name it instead of leaving a dead button to be puzzled over.
 *
 * Order matters: it is the order of the form, so the answer is always the next thing to fix rather
 * than the last one checked. `overdrawn` comes last because it is the only one that depends on the
 * ledger rather than on the form, and it can only be judged once both accounts are settled — it is
 * `transferOverdrawsSource` run over the screen's balances, and defaults to false so a caller with
 * no balances at hand still gets the field rules.
 */
export function missingForSave(
  values: TransactionFormValues,
  minorDigits: MinorDigits,
  overdrawn = false,
): MissingField | null {
  if (amountBufferToMinor(values.buffer, minorDigits) <= 0) return 'amount';
  if (values.accountId === null) return 'account';
  if (values.kind === 'transfer') {
    if (values.toAccountId === null) return 'destination';
    // Named apart from a missing destination: the fix is different, and so is the sentence.
    if (values.toAccountId === values.accountId) return 'sameAccount';
    if (overdrawn) return 'insufficientFunds';
    return null;
  }
  return values.categoryId === null ? 'category' : null;
}

export function canSave(
  values: TransactionFormValues,
  minorDigits: MinorDigits,
  overdrawn = false,
): boolean {
  return missingForSave(values, minorDigits, overdrawn) === null;
}

/**
 * The fields a transaction write needs. Transfers carry no category and expenses/income no
 * destination, which is the invariant `transactionSchema` enforces.
 */
export function toTransactionInput(
  values: TransactionFormValues,
  minorDigits: MinorDigits,
): Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'recurrenceId'> {
  const isTransfer = values.kind === 'transfer';
  return {
    kind: values.kind,
    amount: amountBufferToMinor(values.buffer, minorDigits),
    date: values.date,
    accountId: values.accountId ?? '',
    toAccountId: isTransfer ? values.toAccountId : null,
    categoryId: isTransfer ? null : values.categoryId,
    description: values.description.trim(),
    note: null,
    tagIds: values.tagIds,
    excludeFromTotals: values.excludeFromTotals,
  };
}

/** Switching kind clears the fields the new kind cannot hold, so save stays reachable. */
export function changeKind(
  values: TransactionFormValues,
  kind: TransactionKind,
): TransactionFormValues {
  if (kind === 'transfer') return { ...values, kind, categoryId: null };
  return { ...values, kind, toAccountId: null };
}

/** Date chips of §6.16. */
export function dateChoices(today: LocalDate): { key: 'today' | 'yesterday'; date: LocalDate }[] {
  return [
    { key: 'today', date: today },
    { key: 'yesterday', date: addDays(today, -1) },
  ];
}

/** Tag suggestions for the inline input: name match first, then usage (§5.10). */
export function tagSuggestions(
  tags: readonly { id: string; name: string }[],
  transactions: readonly Pick<Transaction, 'tagIds'>[],
  query: string,
  selected: readonly string[],
  limit = 6,
): { id: string; name: string }[] {
  const normalized = query.trim().toLowerCase();
  const usage = new Map<string, number>();
  for (const tx of transactions) {
    for (const id of tx.tagIds) usage.set(id, (usage.get(id) ?? 0) + 1);
  }
  return tags
    .filter((tag) => !selected.includes(tag.id))
    .filter((tag) => normalized.length === 0 || tag.name.toLowerCase().includes(normalized))
    .sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0))
    .slice(0, limit);
}

/** Whether the typed name is new, so the input can offer "Crea «X»" (§5.10). */
export function canCreateTag(tags: readonly { name: string }[], query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (normalized.length === 0) return false;
  return !tags.some((tag) => tag.name.trim().toLowerCase() === normalized);
}

/**
 * What the form's "Dettagli" disclosure is holding (§6.16).
 *
 * Tags, attachments and exclude are the three fields that are rarely touched and that
 * together pushed the frequent ones off the screen. Collapsing them is only safe if a *set* value
 * stays readable without opening anything, which is what this counts.
 */
export interface DetailsSummary {
  tags: number;
  attachments: number;
  excludeFromTotals: boolean;
}

export function detailsSummary(
  values: Pick<TransactionFormValues, 'tagIds' | 'excludeFromTotals'>,
  attachments: number,
): DetailsSummary {
  return { tags: values.tagIds.length, attachments, excludeFromTotals: values.excludeFromTotals };
}

export function detailsAreEmpty(summary: DetailsSummary): boolean {
  return summary.tags === 0 && summary.attachments === 0 && !summary.excludeFromTotals;
}

/**
 * Closed on a new transaction — nothing is set, and the point of the disclosure is that the form
 * fits in one screen. Open on an edit that has something in it: edit is random access, and the
 * field you came back for is the one that is already filled.
 */
export function detailsOpenInitially(mode: 'new' | 'edit', summary: DetailsSummary): boolean {
  return mode === 'edit' && !detailsAreEmpty(summary);
}
