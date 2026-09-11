import { normalizeText } from '../filters';

/** Every field the importer can fill from a column (§11.3). */
export const IMPORT_FIELDS = [
  'date',
  'amount',
  'type',
  'account',
  'category',
  'description',
  'note',
  'tags',
  'currency',
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number];

export type DateFormat = 'iso' | 'dmy' | 'mdy' | 'dmy-dots';

export interface ImportMapping {
  /** Field → column index, or null when the file has no such column. */
  columns: Record<ImportField, number | null>;
  dateFormat: DateFormat;
  decimalSeparator: '.' | ',';
  /** Where the kind comes from: a column, or the sign of the amount. */
  signConvention: 'negative-is-expense' | 'type-column';
  /** Values of the type column, compared case-insensitively. */
  typeValues: { expense: string[]; income: string[] };
  tagSeparator: string;
  /** Used when there is no account column, or its cell is empty. */
  defaultAccountName: string | null;
}

export type PresetName = 'saldo' | 'spendee' | 'generic';

const NO_COLUMNS: Record<ImportField, number | null> = {
  date: null,
  amount: null,
  type: null,
  account: null,
  category: null,
  description: null,
  note: null,
  tags: null,
  currency: null,
};

/** Our own export (§11.2). */
export const SALDO_HEADERS = [
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
];

/** A real Spendee export (§11.3), verified against the fixture. */
export const SPENDEE_HEADERS = [
  'date',
  'wallet',
  'type',
  'category name',
  'amount',
  'currency',
  'note',
  'labels',
  'author',
];

function indexOf(headers: readonly string[], name: string): number | null {
  const at = headers.indexOf(name);
  return at === -1 ? null : at;
}

function presetFor(headers: readonly string[], name: PresetName): ImportMapping {
  if (name === 'saldo') {
    return {
      columns: {
        ...NO_COLUMNS,
        date: indexOf(headers, 'date'),
        amount: indexOf(headers, 'amount'),
        type: indexOf(headers, 'type'),
        account: indexOf(headers, 'account'),
        category: indexOf(headers, 'category'),
        description: indexOf(headers, 'description'),
        note: indexOf(headers, 'note'),
        tags: indexOf(headers, 'tags'),
        currency: indexOf(headers, 'currency'),
      },
      dateFormat: 'iso',
      decimalSeparator: '.',
      signConvention: 'type-column',
      typeValues: { expense: ['expense'], income: ['income'] },
      tagSeparator: '|',
      defaultAccountName: null,
    };
  }
  if (name === 'spendee') {
    return {
      columns: {
        ...NO_COLUMNS,
        date: indexOf(headers, 'date'),
        amount: indexOf(headers, 'amount'),
        type: indexOf(headers, 'type'),
        // The wallet is the account *by default*. In the sample it is the same for every row while
        // the labels hold the real account, so the mapping step lets the user move this (§11.3).
        account: indexOf(headers, 'wallet'),
        category: indexOf(headers, 'category name'),
        description: indexOf(headers, 'note'),
        note: null,
        tags: indexOf(headers, 'labels'),
        currency: indexOf(headers, 'currency'),
      },
      dateFormat: 'iso',
      decimalSeparator: '.',
      signConvention: 'type-column',
      typeValues: { expense: ['expense'], income: ['income'] },
      tagSeparator: ',',
      defaultAccountName: null,
    };
  }
  return {
    columns: { ...NO_COLUMNS },
    dateFormat: 'iso',
    decimalSeparator: '.',
    signConvention: 'negative-is-expense',
    typeValues: { expense: ['expense', 'spesa', 'uscita'], income: ['income', 'entrata'] },
    tagSeparator: ',',
    defaultAccountName: null,
  };
}

function headerKeys(headers: readonly string[]): string[] {
  return headers.map((cell) => normalizeText(cell));
}

/** Which file this is, by its header row alone (§11.3 step 2). */
export function detectPreset(headers: readonly string[]): PresetName {
  const keys = new Set(headerKeys(headers));
  if (SALDO_HEADERS.every((name) => keys.has(name))) return 'saldo';
  if (SPENDEE_HEADERS.every((name) => keys.has(name))) return 'spendee';
  return 'generic';
}

/**
 * The mapping a file starts with: the preset's, resolved against this file's actual column order,
 * so a preset still works when the columns were reordered. Everything in it is editable.
 */
export function mappingFor(headers: readonly string[], preset: PresetName): ImportMapping {
  return presetFor(headerKeys(headers), preset);
}
