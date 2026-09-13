import { describe, expect, it } from 'vitest';
import type { Account, Category, Tag, Transaction } from '../entities';
import { csvRows, toCsv } from './csv';
import { parseCsv } from './csvParse';
import { detectPreset, mappingFor } from './importMapping';
import { planImport } from './importPlan';

const meta = {
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '000000000000001-0000-dev',
  deletedAt: null,
};

const carta: Account = {
  ...meta,
  id: 'acc-1',
  name: 'Carta',
  type: 'checking',
  institution: null,
  openingBalance: 0,
  includeInSpendable: true,
  colorIndex: 3,
  icon: 'card',
  creditCloseDay: null,
  creditChargeDay: null,
  creditPaymentAccountId: null,
  archivedAt: null,
  sortOrder: 0,
};
const contanti: Account = { ...carta, id: 'acc-2', name: 'Contanti', type: 'cash', sortOrder: 1 };

const trasporti: Category = {
  ...meta,
  id: 'cat-1',
  name: 'Trasporti',
  direction: 'expense',
  parentId: null,
  colorIndex: 1,
  icon: 'car',
  archivedAt: null,
  sortOrder: 0,
};
const carburante: Category = {
  ...trasporti,
  id: 'cat-2',
  name: 'Carburante',
  parentId: 'cat-1',
  sortOrder: 1,
};
const stipendio: Category = {
  ...trasporti,
  id: 'cat-3',
  name: 'Stipendio',
  direction: 'income',
  parentId: null,
};

const vacanza: Tag = { ...meta, id: 'tag-1', name: 'Vacanza' };
const auto: Tag = { ...meta, id: 'tag-2', name: 'Auto' };

const expense: Transaction = {
  ...meta,
  id: 'tx-1',
  date: '2026-04-18',
  kind: 'expense',
  amount: 4500,
  accountId: 'acc-1',
  toAccountId: null,
  categoryId: 'cat-2',
  description: 'Benzina Q8',
  note: null,
  tagIds: ['tag-1', 'tag-2'],
  excludeFromTotals: false,
  recurrenceId: null,
};

const context = {
  currency: 'EUR' as const,
  accounts: [carta, contanti],
  categories: [trasporti, carburante, stipendio],
  tags: [vacanza, auto],
};

describe('toCsv', () => {
  it('writes a BOM and CRLF endings', () => {
    expect(
      toCsv([
        ['date', 'type'],
        ['2026-04-18', 'expense'],
      ]),
    ).toBe('﻿date,type\r\n2026-04-18,expense\r\n');
  });

  it('quotes a field holding a comma, a quote or a newline, and doubles the quotes', () => {
    expect(toCsv([['a,b', 'say "hi"', 'two\nlines', 'plain']])).toBe(
      '﻿"a,b","say ""hi""","two\nlines",plain\r\n',
    );
  });
});

describe('csvRows', () => {
  it('starts with the header of §11.2', () => {
    expect(csvRows([], context)[0]).toEqual([
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
    ]);
  });

  it('writes an expense with its parent category and its tags', () => {
    expect(csvRows([expense], context)[1]).toEqual([
      '2026-04-18',
      'expense',
      '45.00',
      'EUR',
      'Carta',
      '',
      'Carburante',
      'Trasporti',
      'Benzina Q8',
      '',
      'Vacanza|Auto',
      'false',
      'false',
      'tx-1',
    ]);
  });

  it('writes the amount positive: the type column carries the sign', () => {
    const income: Transaction = {
      ...expense,
      id: 'tx-2',
      kind: 'income',
      amount: 261_000,
      categoryId: 'cat-3',
      tagIds: [],
      description: '',
    };
    const row = csvRows([income], context)[1];
    expect(row?.[1]).toBe('income');
    expect(row?.[2]).toBe('2610.00');
    expect(row?.[6]).toBe('Stipendio');
    expect(row?.[7]).toBe('');
    expect(row?.[8]).toBe('');
    expect(row?.[10]).toBe('');
  });

  it('names both accounts of a transfer and leaves its category empty', () => {
    const transfer: Transaction = {
      ...expense,
      id: 'tx-3',
      kind: 'transfer',
      toAccountId: 'acc-2',
      categoryId: null,
      tagIds: [],
    };
    const row = csvRows([transfer], context)[1];
    expect(row?.[4]).toBe('Carta');
    expect(row?.[5]).toBe('Contanti');
    expect(row?.[6]).toBe('');
  });

  it('flags an excluded and a recurring row', () => {
    const row = csvRows(
      [{ ...expense, excludeFromTotals: true, recurrenceId: 'rec-1' }],
      context,
    )[1];
    expect(row?.[11]).toBe('true');
    expect(row?.[12]).toBe('true');
  });

  it('leaves a name empty when the row points at something that is gone', () => {
    const orphan: Transaction = { ...expense, accountId: 'missing', categoryId: 'missing' };
    const row = csvRows([orphan], context)[1];
    expect(row?.[4]).toBe('');
    expect(row?.[6]).toBe('');
  });
});

describe('formula injection', () => {
  const hostile = {
    currency: 'EUR' as const,
    accounts: [{ ...carta, name: '=HYPERLINK("http://evil","click")' }],
    categories: [],
    tags: [{ ...vacanza, name: '@SUM(A1:A9)' }],
  };

  it('prefixes a cell that starts with =, +, - or @ with an apostrophe', () => {
    const rows = csvRows(
      [{ ...expense, accountId: 'acc-1', description: '+1 caffè', tagIds: ['tag-1'] }],
      hostile,
    );
    const row = rows[1] ?? [];
    expect(row[4]).toBe('\'=HYPERLINK("http://evil","click")');
    expect(row[8]).toBe("'+1 caffè");
    expect(row[10]).toBe("'@SUM(A1:A9)");
  });

  it('prefixes a cell hidden behind a leading tab, carriage return or line feed', () => {
    const row = csvRows([{ ...expense, description: '\t=1+1', note: '\r-1' }], context)[1] ?? [];
    expect(row[8]).toBe("'\t=1+1");
    expect(row[9]).toBe("'\r-1");
    // A note pasted with a blank line in front: `field()` quotes it either way, and a quoted
    // formula is still a formula.
    const pasted = csvRows([{ ...expense, description: '\n=1+1' }], context)[1] ?? [];
    expect(pasted[8]).toBe("'\n=1+1");
    expect(toCsv([pasted])).toContain('"\'\n=1+1"');
  });

  it('leaves the amount alone, because a minus there is a sign and not a formula', () => {
    expect(csvRows([{ ...expense, amount: 1250 }], context)[1]?.[2]).toBe('12.50');
    // Amounts are stored positive (the type column carries the sign), but if one ever reaches the
    // column negative it must still be a number to the spreadsheet.
    expect(csvRows([{ ...expense, amount: -1250 }], context)[1]?.[2]).toBe('-12.50');
  });

  it('leaves an ordinary cell untouched', () => {
    expect(csvRows([{ ...expense, description: 'Caffè' }], context)[1]?.[8]).toBe('Caffè');
  });

  it('both prefixes and quotes a description that starts with = and holds a comma', () => {
    const rows = csvRows([{ ...expense, description: '=Caffè, e brioche' }], context);
    expect(toCsv(rows).split('\r\n')[1]).toContain(',"\'=Caffè, e brioche",');
  });
});

describe('export → import round-trip', () => {
  /** Writes the file the export writes, then reads it back the way the import screen does. */
  const reimport = (transaction: Transaction) => {
    const parsed = parseCsv(toCsv(csvRows([transaction], context)));
    const headers = parsed.rows[0] ?? [];
    return planImport(parsed.rows.slice(1), mappingFor(headers, detectPreset(headers)), {
      ...context,
      existingFingerprints: new Set<string>(),
    });
  };

  it('gives back the text the user typed, guard apostrophe and all', () => {
    const plan = reimport({
      ...expense,
      description: '=SUM(A1:A9)',
      note: '@casa',
      tagIds: ['tag-1'],
    });
    expect(plan.errors).toEqual([]);
    const planned = plan.transactions[0];
    expect(planned?.description).toBe('=SUM(A1:A9)');
    expect(planned?.note).toBe('@casa');
    expect(planned?.tagNames).toEqual(['Vacanza']);
    expect(plan.newAccounts).toEqual([]);
    expect(plan.newTags).toEqual([]);
  });

  it('keeps a description that genuinely begins with an apostrophe', () => {
    const plan = reimport({ ...expense, description: "'90s playlist" });
    expect(plan.transactions[0]?.description).toBe("'90s playlist");
  });
});
