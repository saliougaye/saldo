import { describe, expect, it } from 'vitest';
import type { Account, Category, Tag } from '../entities';
// The anonymised Spendee export of §11.3, as bytes. `?raw` is Vite's, so the fixture stays a real
// .csv file — one that can also be dropped into the simulator — without `@saldo/core` ever
// reaching for a Node API.
import FIXTURE from './__fixtures__/spendee.csv?raw';
import { parseCsv } from './csvParse';
import { transactionFingerprint } from './fingerprint';
import { detectPreset, type ImportMapping, mappingFor, SALDO_HEADERS } from './importMapping';
import { type ImportContext, type ImportPlan, importedBalances, planImport } from './importPlan';

const { rows } = parseCsv(FIXTURE);
const headers = rows[0] ?? [];
const body = rows.slice(1);

const context = (overrides: Partial<ImportContext> = {}): ImportContext => ({
  currency: 'EUR',
  accounts: [],
  categories: [],
  tags: [],
  existingFingerprints: new Set<string>(),
  ...overrides,
});

const meta = {
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '000000000000001-0000-dev',
  deletedAt: null,
};

function account(name: string): Account {
  return {
    ...meta,
    id: `acc-${name}`,
    name,
    type: 'checking',
    institution: null,
    openingBalance: 0,
    includeInSpendable: true,
    colorIndex: 0,
    icon: 'landmark',
    creditCloseDay: null,
    creditChargeDay: null,
    creditPaymentAccountId: null,
    archivedAt: null,
    sortOrder: 0,
  };
}

function category(name: string, direction: 'expense' | 'income'): Category {
  return {
    ...meta,
    id: `cat-${name}-${direction}`,
    name,
    direction,
    parentId: null,
    colorIndex: 1,
    icon: 'tag',
    archivedAt: null,
    sortOrder: 0,
  };
}

function tag(name: string): Tag {
  return { ...meta, id: `tag-${name}`, name };
}

const spendee = (): ImportMapping => mappingFor(headers, 'spendee');

/** The mapping the user reaches by pointing "account" at the labels column instead (§11.3). */
function labelsAsAccounts(): ImportMapping {
  const mapping = spendee();
  return {
    ...mapping,
    columns: { ...mapping.columns, account: mapping.columns.tags, tags: null },
    defaultAccountName: 'Contanti',
  };
}

describe('the fixture itself', () => {
  it('is a Spendee export of eleven rows', () => {
    expect(detectPreset(headers)).toBe('spendee');
    expect(body).toHaveLength(11);
  });
});

describe('planImport, Spendee preset', () => {
  it('plans every row with no errors', () => {
    const plan = planImport(body, spendee(), context());
    expect(plan.errors).toEqual([]);
    expect(plan.transactions).toHaveLength(11);
    expect(plan.duplicates).toBe(0);
  });

  it('takes the local date out of the offset timestamp', () => {
    const plan = planImport(body, spendee(), context());
    expect(plan.transactions[0]?.date).toBe('2026-08-12');
    expect(plan.transactions.at(-1)?.date).toBe('2026-09-10');
  });

  it('reads eight decimal places into minor units, with the kind carrying the sign', () => {
    const plan = planImport(body, spendee(), context());
    expect(plan.transactions[0]).toMatchObject({ amount: 500, kind: 'expense' });
    expect(plan.transactions[2]).toMatchObject({ amount: 7000, kind: 'income' });
    // 1234.00000000 as income, and -9.99 as an expense: neither goes through a float.
    expect(plan.transactions.find((tx) => tx.description === 'Stipendio')).toMatchObject({
      amount: 123_400,
      kind: 'income',
    });
    expect(plan.transactions.find((tx) => tx.description === 'Telefono')?.amount).toBe(999);
  });

  it('creates categories in the direction of their row', () => {
    const plan = planImport(body, spendee(), context());
    expect(plan.newCategories).toContainEqual({
      name: 'Bills, Fees & Subscriptions',
      direction: 'expense',
    });
    expect(plan.newCategories).toContainEqual({ name: 'Money Back', direction: 'income' });
  });

  it('takes the wallet as the account and the labels as tags', () => {
    const plan = planImport(body, spendee(), context());
    expect(plan.newAccounts).toEqual(['My Money']);
    expect(plan.newTags).toEqual(['Banca🏦', 'Contanti 💵', 'Carta 💳']);
  });

  it('trims the trailing spaces a real export leaves in its notes', () => {
    const plan = planImport(body, spendee(), context());
    expect(plan.transactions[0]?.description).toBe('aperitivo');
  });

  it('matches an account that already exists, whatever its casing', () => {
    const plan = planImport(body, spendee(), context({ accounts: [account('MY MONEY')] }));
    expect(plan.newAccounts).toEqual([]);
    expect(plan.transactions[0]?.accountName).toBe('MY MONEY');
  });

  it('never maps a row to a pocket, even one with the same name', () => {
    const pocket: Account = {
      ...account('My Money'),
      type: 'pocket',
      includeInSpendable: false,
      parentAccountId: 'acc-checking',
      goalTarget: 100_000,
      goalDeadline: null,
      goalStartDate: '2026-09-01',
    };
    const plan = planImport(body, spendee(), context({ accounts: [pocket] }));
    expect(plan.newAccounts).toEqual(['My Money']);
  });

  it('reuses an existing category only in the same direction', () => {
    const plan = planImport(
      body,
      spendee(),
      context({ categories: [category('Money Back', 'expense')] }),
    );
    // The file's "Money Back" rows are income, so the expense category of that name is not it.
    expect(plan.newCategories).toContainEqual({ name: 'Money Back', direction: 'income' });
  });

  it('reuses an existing tag', () => {
    const plan = planImport(body, spendee(), context({ tags: [tag('Banca🏦')] }));
    expect(plan.newTags).not.toContain('Banca🏦');
  });
});

describe('planImport, account taken from the labels', () => {
  it('creates one account per label and falls back for the empty cell', () => {
    const plan = planImport(body, labelsAsAccounts(), context());
    expect(plan.errors).toEqual([]);
    expect(plan.newAccounts).toEqual(['Banca🏦', 'Contanti 💵', 'Carta 💳', 'Contanti']);
    expect(plan.newTags).toEqual([]);
    // "Concerto" is the row whose Labels cell is empty.
    expect(plan.transactions.find((tx) => tx.description === 'Concerto')?.accountName).toBe(
      'Contanti',
    );
  });

  it('reports the row instead of inventing an account when there is no fallback', () => {
    const mapping = { ...labelsAsAccounts(), defaultAccountName: null };
    const plan = planImport(body, mapping, context());
    expect(plan.errors).toEqual([{ rowNumber: 10, reason: 'account', value: '' }]);
    expect(plan.transactions).toHaveLength(10);
  });
});

describe('planImport, duplicates', () => {
  it('adds nothing on a second run of the same file', () => {
    const first = planImport(body, spendee(), context());
    const existingFingerprints = new Set(first.transactions.map((tx) => tx.fingerprint));
    const second = planImport(body, spendee(), context({ existingFingerprints }));
    expect(second.transactions).toEqual([]);
    expect(second.duplicates).toBe(11);
    // Nothing to create either: a duplicate row must not leave an account behind.
    expect(second.newAccounts).toEqual([]);
    expect(second.newCategories).toEqual([]);
    expect(second.newTags).toEqual([]);
  });

  it('counts a line repeated inside the same file once', () => {
    const first = body[0];
    if (first === undefined) throw new Error('the fixture lost its first row');
    const plan = planImport([first, [...first]], spendee(), context());
    expect(plan.transactions).toHaveLength(1);
    expect(plan.duplicates).toBe(1);
  });

  it('matches a row already in the database through its fingerprint', () => {
    const existingFingerprints = new Set([
      transactionFingerprint({
        date: '2026-08-12',
        amount: 500,
        kind: 'expense',
        description: 'APERITIVO',
        accountName: 'my money',
      }),
    ]);
    const plan = planImport(body, spendee(), context({ existingFingerprints }));
    expect(plan.duplicates).toBe(1);
    expect(plan.transactions).toHaveLength(10);
  });
});

describe('planImport, rows it refuses', () => {
  const row = (patch: Record<number, string>): string[] => {
    const copy = [...(body[0] ?? [])];
    for (const [index, value] of Object.entries(patch)) copy[Number(index)] = value;
    return copy;
  };

  it('reports a currency that is not the settings currency, and converts nothing', () => {
    const plan = planImport([row({ 5: 'USD' })], spendee(), context());
    expect(plan.errors).toEqual([{ rowNumber: 1, reason: 'currency', value: 'USD' }]);
    expect(plan.transactions).toEqual([]);
  });

  it('reports an unknown type rather than guessing: Transfer is not imported', () => {
    const plan = planImport([row({ 2: 'Transfer' })], spendee(), context());
    expect(plan.errors).toEqual([{ rowNumber: 1, reason: 'type', value: 'Transfer' }]);
  });

  it('reports an unreadable date and an unreadable amount', () => {
    expect(planImport([row({ 0: 'ieri' })], spendee(), context()).errors[0]).toMatchObject({
      reason: 'date',
      value: 'ieri',
    });
    expect(planImport([row({ 4: '' })], spendee(), context()).errors[0]).toMatchObject({
      reason: 'amount',
    });
  });

  it('reports a row with no category, since every expense needs one', () => {
    const plan = planImport([row({ 3: '' })], spendee(), context());
    expect(plan.errors).toEqual([{ rowNumber: 1, reason: 'category', value: '' }]);
  });

  it('files a row with no category under the fallback when there is one', () => {
    const mapping = { ...spendee(), defaultCategoryName: 'Altro' };
    const plan = planImport([row({ 3: '' })], mapping, context());
    expect(plan.errors).toEqual([]);
    expect(plan.transactions[0]?.categoryName).toBe('Altro');
    expect(plan.newCategories).toEqual([{ name: 'Altro', direction: 'expense' }]);
  });

  it('reports a row that is too short for its mapping', () => {
    const plan = planImport([['2026-08-12']], spendee(), context());
    expect(plan.errors[0]).toMatchObject({ rowNumber: 1, reason: 'columns' });
  });

  it('numbers the rows as the file does, header excluded', () => {
    const plan = planImport([row({}), row({ 0: 'ieri' })], spendee(), context());
    expect(plan.errors[0]?.rowNumber).toBe(2);
  });
});

describe('planImport, other shapes', () => {
  const generic = (): ImportMapping => ({
    ...mappingFor(['data', 'importo', 'descrizione'], 'generic'),
    columns: {
      date: 0,
      amount: 1,
      description: 2,
      type: null,
      account: null,
      category: null,
      note: null,
      tags: null,
      currency: null,
      excluded: null,
    },
    dateFormat: 'dmy',
    decimalSeparator: ',',
    defaultAccountName: 'Contanti',
    defaultCategoryName: 'Altro',
  });

  it('reads day-first dates and a comma decimal separator, with the sign giving the kind', () => {
    const plan = planImport(
      [
        ['18/04/2026', '-1.234,56', 'Spesa grossa'],
        ['1/5/26', '2.000,00', 'Entrata'],
      ],
      generic(),
      context(),
    );
    expect(plan.errors).toEqual([]);
    expect(plan.transactions[0]).toMatchObject({
      date: '2026-04-18',
      amount: 123_456,
      kind: 'expense',
      accountName: 'Contanti',
      categoryName: 'Altro',
    });
    expect(plan.transactions[1]).toMatchObject({
      date: '2026-05-01',
      amount: 200_000,
      kind: 'income',
    });
  });

  it('reads dotted day-first dates', () => {
    const plan = planImport(
      [['18.04.2026', '-10,00', 'Spesa']],
      { ...generic(), dateFormat: 'dmy-dots' },
      context(),
    );
    expect(plan.transactions[0]?.date).toBe('2026-04-18');
  });

  it('reads month-first dates', () => {
    const plan = planImport(
      [['04/18/2026', '-10,00', 'Spesa']],
      { ...generic(), dateFormat: 'mdy' },
      context(),
    );
    expect(plan.transactions[0]?.date).toBe('2026-04-18');
  });

  it('reads an excluded column mapped by hand, and counts an empty cell', () => {
    const plan = planImport(
      [
        ['18/04/2026', '-10,00', 'Uno', 'Sì'],
        ['19/04/2026', '-10,00', 'Due', ''],
        ['20/04/2026', '-10,00', 'Tre', 'no'],
      ],
      { ...generic(), columns: { ...generic().columns, excluded: 3 } },
      context(),
    );
    expect(plan.transactions.map((tx) => tx.excluded)).toEqual([true, false, false]);
  });
});

describe('planImport, Saldo export', () => {
  const saldoRow = (excluded: string, description: string): string[] => [
    '2026-04-18',
    'expense',
    '45.00',
    'EUR',
    'Carta',
    '',
    'Carburante',
    'Trasporti',
    description,
    '',
    'Vacanza|Auto',
    excluded,
    'false',
    `id-${description}`,
  ];

  it('keeps the excluded flag of a round trip (§11.2)', () => {
    const plan = planImport(
      [saldoRow('true', 'Benzina'), saldoRow('false', 'Pedaggio')],
      mappingFor(SALDO_HEADERS, 'saldo'),
      context(),
    );
    expect(plan.errors).toEqual([]);
    expect(plan.transactions.map((tx) => [tx.description, tx.excluded])).toEqual([
      ['Benzina', true],
      ['Pedaggio', false],
    ]);
  });
});

describe('importedBalances', () => {
  const row = (
    accountName: string,
    kind: 'expense' | 'income',
    amount: number,
    date: string,
  ): ImportPlan['transactions'][number] => ({
    rowNumber: 1,
    date,
    kind,
    amount,
    accountName,
    categoryName: 'Varie',
    description: '',
    note: null,
    tagNames: [],
    excluded: false,
    fingerprint: `${accountName}-${kind}-${amount}-${date}`,
  });

  const importPlan = (transactions: ImportPlan['transactions']): ImportPlan => ({
    transactions,
    duplicates: 0,
    errors: [],
    newAccounts: ['My Money', 'Carta', 'Vuoto'],
    newCategories: [],
    newTags: [],
  });

  it('adds up each account as if the import were its whole history', () => {
    const balances = importedBalances(
      importPlan([
        row('My Money', 'income', 7000, '2026-08-12'),
        row('My Money', 'expense', 500, '2026-08-12'),
        row('Carta', 'expense', 1399, '2026-08-15'),
      ]),
      '2026-09-17',
    );
    expect(balances).toEqual(
      new Map([
        ['My Money', 6500],
        ['Carta', -1399],
        ['Vuoto', 0],
      ]),
    );
  });

  it('leaves out what is still scheduled, as a balance does (§5.3)', () => {
    const balances = importedBalances(
      importPlan([row('My Money', 'expense', 500, '2026-09-18')]),
      '2026-09-17',
    );
    expect(balances.get('My Money')).toBe(0);
  });
});
