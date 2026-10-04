import {
  type AmountSign,
  type LocalDate,
  type Recurrence,
  type TransactionKind,
  type TransactionRow,
  type TransactionRowDeps,
  transactionRow,
  type UserData,
} from '@saldo/core';

/** The rows of facts the phone's detail screen shows, in the order it shows them (§6.6). */
export type DetailFactKind = 'from' | 'to' | 'category' | 'account' | 'date';

export interface DetailFact {
  kind: DetailFactKind;
  /**
   * The fact **as data**: a name or a raw `LocalDate`. `null` when the name does not resolve — a
   * missing category, an account that is gone — which the page shows as the phone's «—». The label
   * beside it and the formatting of a date belong to the page, which has the catalog and locale.
   */
  value: string | null;
  /** Where the fact leads, when it leads anywhere: an account, and nothing else in 0.3d. */
  href: string | null;
}

export interface DetailView extends TransactionRow {
  id: string;
  /** The row's version, for «Elimina»: a phone's edit after the page loaded is a `conflict`. */
  updatedAt: string;
  kind: TransactionKind;
  date: LocalDate;
  /**
   * The detail screen's big figure, which is **not** the list row's `amount`: the phone's detail
   * screen shows every non-income as `-amount`, a transfer included, where its list row leaves a
   * transfer unsigned. The web matches the phone screen for screen, so both are carried.
   */
  hero: { minor: number; signDisplay: AmountSign };
  facts: DetailFact[];
  /** The note as typed; `null` leaves the page the phone's fallback («Registrata manualmente»…). */
  note: string | null;
  tagNames: string[];
  /**
   * The recurrence this row is an occurrence of, when it still resolves — the phone hides both its
   * row and its note wording for a recurrence that is gone. Shown, never edited (§17.1.9).
   */
  recurrence: Pick<Recurrence, 'frequency' | 'interval' | 'startDate' | 'endDate'> | null;
  /** How many attachments the row has. The web says the number and opens none in 0.3d. */
  attachmentCount: number;
  excluded: boolean;
}

export interface DetailViewInput {
  data: UserData;
  id: string;
  /** `t('kinds.<kind>')`, injected so this stays pure; the page passes its translator. */
  kindLabel?: (kind: TransactionKind) => string;
}

/**
 * The trailing panel of §17.1.7. It reads the projection it is given — no second load — and returns
 * `null` for an id that is not there, which is what a stale `?t=` in a shared link looks like.
 *
 * The title and the icon come from `transactionRow`, the same `@saldo/core` the list rows come
 * from, so the panel cannot title a row differently from the one that opened it.
 */
export function detailView({ data, id, kindLabel }: DetailViewInput): DetailView | null {
  const tx = data.transactions.find((row) => row.id === id);
  if (tx === undefined) return null;

  const accounts = new Map(data.accounts.map((account) => [account.id, account]));
  const categories = new Map(data.categories.map((category) => [category.id, category]));
  const tags = new Map(data.tags.map((tag) => [tag.id, tag]));

  const deps: TransactionRowDeps = {
    category: (categoryId) => categories.get(categoryId),
    accountName: (accountId) => accounts.get(accountId)?.name ?? '',
    kindLabel: kindLabel ?? ((kind) => kind),
    viewpointAccountId: null,
  };

  const accountFact = (kind: DetailFactKind, accountId: string | null): DetailFact => ({
    kind,
    value: accountId === null ? null : (accounts.get(accountId)?.name ?? null),
    href: accountId === null ? null : `/accounts?a=${accountId}`,
  });
  // The category page arrives with the writes (§17.1.9); until then the name is not a link. The
  // row is there even without a category, as on the phone, which shows «—» in it.
  const categoryFact: DetailFact = {
    kind: 'category',
    value: tx.categoryId === null ? null : (categories.get(tx.categoryId)?.name ?? null),
    href: null,
  };

  const facts: DetailFact[] = [
    ...(tx.kind === 'transfer'
      ? [accountFact('from', tx.accountId), accountFact('to', tx.toAccountId)]
      : [categoryFact, accountFact('account', tx.accountId)]),
    { kind: 'date', value: tx.date, href: null },
  ];

  const recurrence =
    tx.recurrenceId === null
      ? undefined
      : data.recurrences.find((row) => row.id === tx.recurrenceId && row.deletedAt === null);

  const income = tx.kind === 'income';
  return {
    ...transactionRow(tx, deps),
    id: tx.id,
    updatedAt: tx.updatedAt,
    kind: tx.kind,
    date: tx.date,
    // The phone's detail screen: `income ? amount : -amount`, signed `always` / `negative`.
    hero: { minor: income ? tx.amount : -tx.amount, signDisplay: income ? 'always' : 'negative' },
    facts,
    note: tx.note,
    tagNames: tx.tagIds.map((tagId) => tags.get(tagId)?.name ?? '').filter((name) => name !== ''),
    recurrence:
      recurrence === undefined
        ? null
        : {
            frequency: recurrence.frequency,
            interval: recurrence.interval,
            startDate: recurrence.startDate,
            endDate: recurrence.endDate,
          },
    attachmentCount: data.attachments.filter((row) => row.transactionId === tx.id).length,
    excluded: tx.excludeFromTotals,
  };
}
