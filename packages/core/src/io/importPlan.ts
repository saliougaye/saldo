import { isLocalDate, type LocalDate } from '../dates';
import type { Account, Category, Tag } from '../entities';
import { normalizeText } from '../filters';
import { type CurrencyCode, getCurrency, type MinorUnits, parseDecimalAmount } from '../money';
import { transactionFingerprint } from './fingerprint';
import type { DateFormat, ImportMapping } from './importMapping';

/** Colour and icon new categories get (§11.3). */
export const IMPORTED_CATEGORY_COLOR = 9;
export const IMPORTED_CATEGORY_ICON = 'tag';

export type ImportedKind = 'expense' | 'income';

export interface PlannedTransaction {
  /** 1-based, header excluded: what the error list and the preview count. */
  rowNumber: number;
  date: LocalDate;
  kind: ImportedKind;
  /** Always positive; the kind carries the sign. */
  amount: MinorUnits;
  accountName: string;
  categoryName: string;
  description: string;
  note: string | null;
  tagNames: string[];
  /** `excludeFromTotals` (§4): our own export writes it (§11.2), so a round trip keeps it. */
  excluded: boolean;
  fingerprint: string;
}

export type ImportErrorReason =
  | 'date'
  | 'amount'
  | 'type'
  | 'currency'
  | 'account'
  | 'category'
  | 'columns';

export interface ImportRowError {
  rowNumber: number;
  reason: ImportErrorReason;
  /** The offending cell, so the preview can show what it choked on. */
  value: string;
}

export interface ImportPlan {
  transactions: PlannedTransaction[];
  duplicates: number;
  errors: ImportRowError[];
  newAccounts: string[];
  newCategories: { name: string; direction: ImportedKind }[];
  newTags: string[];
}

export interface ImportContext {
  currency: CurrencyCode;
  accounts: readonly Account[];
  categories: readonly Category[];
  tags: readonly Tag[];
  /** Fingerprints already in the database, so a second run of the same file adds nothing. */
  existingFingerprints: ReadonlySet<string>;
}

function cell(row: readonly string[], index: number | null): string | null {
  if (index === null) return null;
  const value = row[index];
  return value === undefined ? null : value.trim();
}

function pad(value: string): string {
  return value.padStart(2, '0');
}

/**
 * An ISO timestamp carries its own offset, so its first ten characters are already the local date
 * in that offset (§11.3). Converting to the device's zone would move an evening transaction to the
 * next day, which is not what the person who wrote it meant.
 */
function readDate(raw: string, format: DateFormat): LocalDate | null {
  if (format === 'iso') {
    const candidate = raw.slice(0, 10);
    return isLocalDate(candidate) ? candidate : null;
  }
  const parts = raw.split(format === 'dmy-dots' ? '.' : '/');
  if (parts.length !== 3) return null;
  const [first = '', second = '', third = ''] = parts;
  const year = third.length === 2 ? `20${third}` : third;
  const candidate =
    format === 'mdy'
      ? `${year}-${pad(first)}-${pad(second)}`
      : `${year}-${pad(second)}-${pad(first)}`;
  return isLocalDate(candidate) ? candidate : null;
}

function readKind(
  typeCell: string | null,
  amount: MinorUnits,
  mapping: ImportMapping,
): ImportedKind | null {
  if (mapping.signConvention === 'negative-is-expense' || typeCell === null || typeCell === '') {
    return amount < 0 ? 'expense' : 'income';
  }
  const value = normalizeText(typeCell);
  if (mapping.typeValues.expense.some((name) => normalizeText(name) === value)) return 'expense';
  if (mapping.typeValues.income.some((name) => normalizeText(name) === value)) return 'income';
  // Spendee's `Transfer` lands here: the sample had none, so it is reported rather than guessed.
  return null;
}

/**
 * Our export writes `true`/`false` (§11.2); the rest is for a column mapped by hand. Anything
 * unrecognised — an empty cell included — counts in the totals, since that is what a new transaction does.
 */
const EXCLUDED_VALUES = new Set(['true', '1', 'yes', 'si']);

function readExcluded(raw: string | null): boolean {
  return raw !== null && EXCLUDED_VALUES.has(normalizeText(raw));
}

/** Matches an existing name case- and accent-insensitively, and remembers what it has invented. */
class NameRegistry {
  private readonly known = new Map<string, string>();
  readonly created: string[] = [];

  constructor(existing: readonly { name: string }[]) {
    for (const row of existing) this.known.set(normalizeText(row.name), row.name);
  }

  resolve(name: string): string {
    const key = normalizeText(name);
    const found = this.known.get(key);
    if (found !== undefined) return found;
    this.known.set(key, name);
    this.created.push(name);
    return name;
  }
}

/**
 * §11.3. Decides everything and writes nothing: the preview and the import read the same answer,
 * so what the user confirmed is what happens.
 *
 * Rows are processed in order, and the fingerprints of the rows already planned join the existing
 * ones — two identical lines in the same file are one transaction and one duplicate.
 */
export function planImport(
  rows: readonly (readonly string[])[],
  mapping: ImportMapping,
  context: ImportContext,
): ImportPlan {
  const { minorDigits } = getCurrency(context.currency);
  const accounts = new NameRegistry(context.accounts);
  const tags = new NameRegistry(context.tags);
  // Categories live in two namespaces: "Money Back" as income and as expense are different rows.
  const categories = {
    expense: new NameRegistry(context.categories.filter((row) => row.direction === 'expense')),
    income: new NameRegistry(context.categories.filter((row) => row.direction === 'income')),
  };

  const plan: ImportPlan = {
    transactions: [],
    duplicates: 0,
    errors: [],
    newAccounts: [],
    newCategories: [],
    newTags: [],
  };
  const seen = new Set(context.existingFingerprints);

  rows.forEach((row, index) => {
    const rowNumber = index + 1;
    const fail = (reason: ImportErrorReason, value: string) => {
      plan.errors.push({ rowNumber, reason, value });
    };

    const rawDate = cell(row, mapping.columns.date);
    const rawAmount = cell(row, mapping.columns.amount);
    if (rawDate === null || rawAmount === null) {
      fail('columns', row.join(','));
      return;
    }

    const date = readDate(rawDate, mapping.dateFormat);
    if (date === null) {
      fail('date', rawDate);
      return;
    }

    const signed = parseDecimalAmount(rawAmount, mapping.decimalSeparator, minorDigits);
    if (signed === null || signed === 0) {
      fail('amount', rawAmount);
      return;
    }

    const kind = readKind(cell(row, mapping.columns.type), signed, mapping);
    if (kind === null) {
      fail('type', cell(row, mapping.columns.type) ?? '');
      return;
    }

    const currency = cell(row, mapping.columns.currency);
    // No conversion (§11.3): a row in another currency is reported, not silently taken at par.
    if (currency !== null && currency !== '' && currency.toUpperCase() !== context.currency) {
      fail('currency', currency);
      return;
    }

    const rawAccount = cell(row, mapping.columns.account);
    const accountName =
      rawAccount !== null && rawAccount !== '' ? rawAccount : mapping.defaultAccountName;
    if (accountName === null || accountName === '') {
      fail('account', rawAccount ?? '');
      return;
    }

    const rawCategory = cell(row, mapping.columns.category);
    const categoryName =
      rawCategory !== null && rawCategory !== '' ? rawCategory : mapping.defaultCategoryName;
    // Every expense and income has a category (§4), so an empty cell with no fallback is a row
    // the importer cannot write — saying so beats inventing a category nobody asked for.
    if (categoryName === null || categoryName === '') {
      fail('category', rawCategory ?? '');
      return;
    }

    const description = cell(row, mapping.columns.description) ?? '';
    const amount = Math.abs(signed);
    // The fingerprint is computed *before* anything is registered as "to create": resolving a
    // name normalises it the same way, so a duplicate row must not leave an unused account or
    // category behind in the plan.
    const fingerprint = transactionFingerprint({ date, amount, kind, description, accountName });
    if (seen.has(fingerprint)) {
      plan.duplicates += 1;
      return;
    }
    seen.add(fingerprint);

    const rawTags = cell(row, mapping.columns.tags);
    const note = cell(row, mapping.columns.note);

    plan.transactions.push({
      rowNumber,
      date,
      kind,
      amount,
      accountName: accounts.resolve(accountName),
      categoryName: categories[kind].resolve(categoryName),
      description,
      note: note === null || note === '' ? null : note,
      tagNames:
        rawTags === null || rawTags === ''
          ? []
          : rawTags
              .split(mapping.tagSeparator)
              .map((name) => name.trim())
              .filter((name) => name !== '')
              .map((name) => tags.resolve(name)),
      excluded: readExcluded(cell(row, mapping.columns.excluded)),
      fingerprint,
    });
  });

  plan.newAccounts = accounts.created;
  plan.newTags = tags.created;
  plan.newCategories = [
    ...categories.expense.created.map((name) => ({ name, direction: 'expense' as const })),
    ...categories.income.created.map((name) => ({ name, direction: 'income' as const })),
  ];
  return plan;
}

/**
 * What each new account's balance would be if the import were its whole history: §5.3 with an
 * opening balance of 0. Onboarding shows it as the starting balance, and subtracts it from the
 * balance the user enters to get the opening balance (§6.22).
 */
export function importedBalances(plan: ImportPlan, today: LocalDate): Map<string, MinorUnits> {
  const balances = new Map<string, MinorUnits>(plan.newAccounts.map((name) => [name, 0]));
  for (const row of plan.transactions) {
    if (row.date > today) continue;
    const signed = row.kind === 'income' ? row.amount : -row.amount;
    balances.set(row.accountName, (balances.get(row.accountName) ?? 0) + signed);
  }
  return balances;
}
