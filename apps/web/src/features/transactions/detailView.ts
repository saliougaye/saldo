import {
  isUpcoming,
  type LocalDate,
  type TransactionKind,
  type TransactionRow,
  type TransactionRowDeps,
  transactionRow,
  type UserData,
} from '@saldo/core';

/** The rows of facts the phone's detail screen shows, in the order it shows them (§6.6). */
export type DetailFactKind = 'from' | 'to' | 'category' | 'account' | 'date' | 'note';

export interface DetailFact {
  kind: DetailFactKind;
  /**
   * The fact **as data**: a name, a raw `LocalDate`, the note as it was typed. The label beside it
   * and the formatting of a date belong to the page, which has the catalog and the locale.
   */
  value: string;
  /** Where the fact leads, when it leads anywhere: an account, and nothing else in 0.3d. */
  href: string | null;
}

export interface DetailView extends TransactionRow {
  id: string;
  kind: TransactionKind;
  date: LocalDate;
  facts: DetailFact[];
  tagNames: string[];
  /** The recurrence this row is an occurrence of; shown, never edited (§17.1.9). */
  recurrenceId: string | null;
  /** Its last occurrence, `null` when it has no end — the phone's `endLabel`. */
  recurrenceEnd: LocalDate | null;
  /** How many receipts the phone holds for this row: the web says the number, never opens one. */
  attachmentCount: number;
  excluded: boolean;
  upcoming: boolean;
}

export interface DetailViewInput {
  data: UserData;
  id: string;
  today: LocalDate;
  /** `t('kinds.<kind>')`, injected so this stays pure; the page passes its translator. */
  kindLabel?: (kind: TransactionKind) => string;
}

/**
 * The trailing panel of §17.1.7. It reads the projection it is given — no second load — and returns
 * `null` for an id that is not there, which is what a stale `?t=` in a shared link looks like.
 *
 * The title, the icon and the signed amount come from `transactionRow`, the same `@saldo/core` the
 * list rows come from, so the panel cannot title or sign a transfer differently from the row that
 * opened it.
 */
export function detailView({ data, id, today, kindLabel }: DetailViewInput): DetailView | null {
  const tx = data.transactions.find((row) => row.id === id);
  if (tx === undefined) return null;

  const accounts = new Map(data.accounts.map((account) => [account.id, account]));
  const categories = new Map(data.categories.map((category) => [category.id, category]));
  const tags = new Map(data.tags.map((tag) => [tag.id, tag]));

  const deps: TransactionRowDeps = {
    category: (categoryId) => categories.get(categoryId),
    accountName: (accountId) => accounts.get(accountId)?.name ?? '',
    kindLabel: kindLabel ?? ((kind) => kind),
    // No account frames this screen: a transfer opened from the list keeps its unsigned amount.
    viewpointAccountId: null,
  };

  const accountFact = (kind: DetailFactKind, accountId: string | null): DetailFact | null =>
    accountId === null
      ? null
      : {
          kind,
          value: accounts.get(accountId)?.name ?? '',
          href: `/accounts?a=${accountId}`,
        };
  const categoryFact = (): DetailFact | null =>
    tx.categoryId === null
      ? null
      : // The category page arrives with the writes (§17.1.9); until then the name is not a link.
        { kind: 'category', value: categories.get(tx.categoryId)?.name ?? '', href: null };

  const facts = [
    ...(tx.kind === 'transfer'
      ? [accountFact('from', tx.accountId), accountFact('to', tx.toAccountId)]
      : [categoryFact(), accountFact('account', tx.accountId)]),
    { kind: 'date', value: tx.date, href: null } satisfies DetailFact,
    tx.note === null ? null : ({ kind: 'note', value: tx.note, href: null } satisfies DetailFact),
  ].filter((fact): fact is DetailFact => fact !== null);

  const recurrence =
    tx.recurrenceId === null
      ? undefined
      : data.recurrences.find((row) => row.id === tx.recurrenceId);

  return {
    ...transactionRow(tx, deps),
    id: tx.id,
    kind: tx.kind,
    date: tx.date,
    facts,
    tagNames: tx.tagIds.map((tagId) => tags.get(tagId)?.name ?? '').filter((name) => name !== ''),
    recurrenceId: tx.recurrenceId,
    recurrenceEnd: recurrence?.endDate ?? null,
    attachmentCount: data.attachments.filter((row) => row.transactionId === tx.id).length,
    excluded: tx.excludeFromTotals,
    upcoming: isUpcoming(tx, today),
  };
}
