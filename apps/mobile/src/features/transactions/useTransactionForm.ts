import {
  addDays,
  amountBufferToMinor,
  type Category,
  type LocalDate,
  type MinorDigits,
  minorToAmountBuffer,
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
  repeat: boolean;
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
    repeat: false,
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
    repeat: transaction.recurrenceId !== null,
  };
}

/**
 * §6.16: save is disabled until the amount is above zero, an account is chosen, a non-transfer has
 * a category, and a transfer has a different destination.
 */
export function canSave(values: TransactionFormValues, minorDigits: MinorDigits): boolean {
  if (amountBufferToMinor(values.buffer, minorDigits) <= 0) return false;
  if (values.accountId === null) return false;
  if (values.kind === 'transfer') {
    return values.toAccountId !== null && values.toAccountId !== values.accountId;
  }
  return values.categoryId !== null;
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

/**
 * The category grid shows the most-used categories of the right direction, then "Altro" opens the
 * full picker (§6.16). Usage is counted over the rows the screen already loaded.
 *
 * Seven, not the ten the spec names: with the "Altro" tile that is two rows of four, and the grid
 * stops pushing the date, the tags and the attachments off the screen. Everything it drops is one
 * tap away in the picker, which also holds the subcategories the grid never showed.
 */
export function topCategories(
  categories: readonly Category[],
  transactions: readonly Pick<Transaction, 'categoryId'>[],
  kind: TransactionKind,
  limit = 7,
): Category[] {
  const direction = kind === 'income' ? 'income' : 'expense';
  const usage = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.categoryId === null) continue;
    usage.set(tx.categoryId, (usage.get(tx.categoryId) ?? 0) + 1);
  }
  return categories
    .filter((category) => category.direction === direction && category.archivedAt === null)
    .sort((a, b) => {
      const diff = (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0);
      return diff !== 0 ? diff : a.sortOrder - b.sortOrder;
    })
    .slice(0, limit);
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
