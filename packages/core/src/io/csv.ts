import type { Account, Category, Tag, Transaction } from '../entities';
import { type CurrencyCode, formatMinorUnits, getCurrency } from '../money';

/** §11.2, in this order. */
const HEADER = [
  'date',
  'type',
  'amount',
  'currency',
  'account',
  'to_account',
  'category',
  'parent_category',
  'description',
  'note',
  'tags',
  'excluded',
  'recurring',
  'id',
] as const;

/** RFC 4180: a field holding `"`, `,` or a line break is quoted, and its quotes are doubled. */
function field(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/**
 * §11.2. The leading BOM is what makes Excel read the file as UTF-8 instead of the local code
 * page — without it the tag "Caffè" arrives mangled — and `\r\n` is what RFC 4180 asks for.
 */
export function toCsv(rows: readonly (readonly string[])[]): string {
  return `﻿${rows.map((row) => row.map(field).join(',')).join('\r\n')}\r\n`;
}

export interface CsvContext {
  currency: CurrencyCode;
  accounts: readonly Account[];
  categories: readonly Category[];
  tags: readonly Tag[];
}

/**
 * The header row plus one row per transaction, in the order given. Ids are resolved to names
 * because a spreadsheet is for reading; the row's own id is kept in the last column so a
 * re-import can tell the same transaction from a new one.
 */
export function csvRows(transactions: readonly Transaction[], context: CsvContext): string[][] {
  const { minorDigits } = getCurrency(context.currency);
  const accountName = new Map(context.accounts.map((account) => [account.id, account.name]));
  const categoryById = new Map(context.categories.map((category) => [category.id, category]));
  const tagName = new Map(context.tags.map((tag) => [tag.id, tag.name]));

  const rows: string[][] = [[...HEADER]];
  for (const tx of transactions) {
    const own = tx.categoryId === null ? undefined : categoryById.get(tx.categoryId);
    const parentId = own?.parentId ?? null;
    const parent = parentId === null ? undefined : categoryById.get(parentId);
    rows.push([
      tx.date,
      tx.kind,
      // Amounts are stored positive and the kind carries the sign, which is also what §11.2 asks
      // the `type` column to do — so there is nothing to convert here.
      formatMinorUnits(tx.amount, minorDigits),
      context.currency,
      accountName.get(tx.accountId) ?? '',
      tx.toAccountId === null ? '' : (accountName.get(tx.toAccountId) ?? ''),
      own?.name ?? '',
      parent?.name ?? '',
      tx.description,
      tx.note ?? '',
      tx.tagIds
        .map((id) => tagName.get(id) ?? '')
        .filter((name) => name !== '')
        .join('|'),
      String(tx.excludeFromTotals),
      String(tx.recurrenceId !== null),
      tx.id,
    ]);
  }
  return rows;
}
