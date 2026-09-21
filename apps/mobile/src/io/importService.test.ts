import { mappingFor, parseCsv, planImport } from '@saldo/core';
import { createRepositories, type Repositories } from '../db/repositories';
import type { RepositoryDatabase } from '../db/repositories/support';
import { createTestDatabase } from '../db/testing';
import { applyImport, existingFingerprints } from './importService';

const CREATED_AT = '2026-04-18T10:00:00.000Z';

/**
 * The same anonymised Spendee export `@saldo/core` plans against (§11.3), inlined here: the jest
 * projects have no `?raw` loader, and a second copy of eleven lines is cheaper than a transform.
 */
const FIXTURE = [
  'Date,Wallet,Type,"Category name",Amount,Currency,Note,Labels,Author',
  '2026-08-12T16:23:13+00:00,"My Money",Expense,Travel,-5.00000000,EUR,"aperitivo ",Banca🏦,"A Person"',
  '2026-08-12T16:23:58+00:00,"My Money",Income,"Money Back",70.00000000,EUR,"rimborso swap","Contanti 💵","A Person"',
  '2026-08-15T07:03:01+00:00,"My Money",Expense,Subscriptions,-13.99000000,EUR,"Streaming ","Carta 💳","A Person"',
  '2026-09-06T22:35:12+00:00,"My Money",Expense,Entertainment,-24.61000000,EUR,"Concerto",,"A Person"',
].join('\n');

function setup(): { db: RepositoryDatabase; repos: Repositories } {
  const db = createTestDatabase();
  const repos = createRepositories(db, () => CREATED_AT);
  repos.settings.create({
    periodKind: 'cycle',
    cycleStartDay: 27,
    currency: 'EUR',
    language: 'system',
    theme: 'dark',
    onboardingCompletedAt: CREATED_AT,
  });
  return { db, repos };
}

function plan(repos: Repositories) {
  const { rows } = parseCsv(FIXTURE);
  const headers = rows[0] ?? [];
  return planImport(rows.slice(1), mappingFor(headers, 'spendee'), {
    currency: 'EUR',
    accounts: repos.accounts.list(),
    categories: repos.categories.list(),
    tags: repos.tags.list(),
    existingFingerprints: existingFingerprints(repos),
  });
}

describe('applyImport', () => {
  it('creates what the file needs and then the transactions', () => {
    const { db, repos } = setup();
    const outcome = applyImport(db, repos, plan(repos));

    expect(outcome).toEqual({ imported: 4, skipped: 0 });
    expect(repos.accounts.list().map((row) => row.name)).toEqual(['My Money']);
    expect(
      repos.tags
        .list()
        .map((row) => row.name)
        .sort(),
    ).toEqual(['Banca🏦', 'Carta 💳', 'Contanti 💵']);
    expect(repos.categories.list()).toHaveLength(4);
    expect(repos.transactions.list()).toHaveLength(4);
  });

  it('points every transaction at the right account, category and tags', () => {
    const { db, repos } = setup();
    applyImport(db, repos, plan(repos));

    const [account] = repos.accounts.list();
    const aperitivo = repos.transactions.list().find((tx) => tx.description === 'aperitivo');
    expect(aperitivo?.accountId).toBe(account?.id);
    expect(aperitivo?.kind).toBe('expense');
    expect(aperitivo?.amount).toBe(500);

    const travel = repos.categories.list().find((row) => row.name === 'Travel');
    expect(aperitivo?.categoryId).toBe(travel?.id);
    expect(travel?.direction).toBe('expense');

    const banca = repos.tags.list().find((row) => row.name === 'Banca🏦');
    expect(aperitivo?.tagIds).toEqual([banca?.id]);
  });

  it('writes the excluded flag the plan read', () => {
    const { db, repos } = setup();
    const planned = plan(repos);
    applyImport(db, repos, {
      ...planned,
      transactions: planned.transactions.map((tx) => ({
        ...tx,
        excluded: tx.description === 'aperitivo',
      })),
    });

    const excluded = repos.transactions.list().filter((tx) => tx.excludeFromTotals);
    expect(excluded.map((tx) => tx.description)).toEqual(['aperitivo']);
  });

  it('creates an income category for an income row', () => {
    const { db, repos } = setup();
    applyImport(db, repos, plan(repos));
    const moneyBack = repos.categories.list().find((row) => row.name === 'Money Back');
    expect(moneyBack?.direction).toBe('income');
  });

  it('refuses a row with no category rather than writing one that has none', () => {
    const { db, repos } = setup();
    const header = FIXTURE.split('\n')[0] ?? '';
    const { rows } = parseCsv(
      `${header}\n2026-09-09T10:00:00+00:00,"My Money",Expense,,-1.00000000,EUR,Senza,,"A Person"`,
    );
    const withoutCategory = planImport(rows.slice(1), mappingFor(rows[0] ?? [], 'spendee'), {
      currency: 'EUR',
      accounts: repos.accounts.list(),
      categories: repos.categories.list(),
      tags: repos.tags.list(),
      existingFingerprints: existingFingerprints(repos),
    });
    expect(withoutCategory.errors[0]).toMatchObject({ reason: 'category' });
    expect(applyImport(db, repos, withoutCategory)).toEqual({ imported: 0, skipped: 0 });
    expect(repos.transactions.list()).toEqual([]);
  });

  it('adds nothing on a second run of the same file', () => {
    const { db, repos } = setup();
    applyImport(db, repos, plan(repos));

    const again = plan(repos);
    expect(again.transactions).toEqual([]);
    expect(again.duplicates).toBe(4);
    const outcome = applyImport(db, repos, again);

    expect(outcome).toEqual({ imported: 0, skipped: 4 });
    expect(repos.transactions.list()).toHaveLength(4);
    expect(repos.accounts.list()).toHaveLength(1);
    expect(repos.categories.list()).toHaveLength(4);
  });

  it('reuses an account that already exists under another casing', () => {
    const { db, repos } = setup();
    repos.accounts.create({
      name: 'MY MONEY',
      type: 'cash',
      institution: null,
      openingBalance: 0,
      includeInSpendable: true,
      colorIndex: 0,
      icon: 'wallet',
      creditCloseDay: null,
      creditChargeDay: null,
      creditPaymentAccountId: null,
      archivedAt: null,
      sortOrder: 0,
    });
    applyImport(db, repos, plan(repos));
    expect(repos.accounts.list()).toHaveLength(1);
    expect(repos.accounts.list()[0]?.type).toBe('cash');
  });

  it('creates a name the plan listed only if it is still missing when it writes', () => {
    const { db, repos } = setup();
    const planned = plan(repos);
    // Written after the plan was made — a seed row, or a sync landing before the confirm.
    repos.categories.create({
      name: 'Money Back',
      direction: 'income',
      parentId: null,
      colorIndex: 3,
      icon: 'arrowDL',
      archivedAt: null,
      sortOrder: 0,
    });
    applyImport(db, repos, planned);
    expect(repos.categories.list().filter((row) => row.name === 'Money Back')).toHaveLength(1);
    const moneyBack = repos.categories.list().find((row) => row.name === 'Money Back');
    const rimborso = repos.transactions.list().find((tx) => tx.description === 'rimborso swap');
    expect(rimborso?.categoryId).toBe(moneyBack?.id);
  });

  it('gives a new account the opening balance it is handed', () => {
    const { db, repos } = setup();
    applyImport(db, repos, plan(repos), { openingBalances: new Map([['My Money', 12000]]) });
    expect(repos.accounts.list()[0]?.openingBalance).toBe(12000);
  });
});

describe('existingFingerprints', () => {
  it('covers what was imported, so the same file is recognised again', () => {
    const { db, repos } = setup();
    applyImport(db, repos, plan(repos));
    expect(existingFingerprints(repos).size).toBe(4);
  });

  it('ignores transfers: the importer never produces one', () => {
    const { repos } = setup();
    const from = repos.accounts.create({
      name: 'A',
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
    });
    const to = repos.accounts.create({
      name: 'B',
      type: 'cash',
      institution: null,
      openingBalance: 0,
      includeInSpendable: true,
      colorIndex: 0,
      icon: 'wallet',
      creditCloseDay: null,
      creditChargeDay: null,
      creditPaymentAccountId: null,
      archivedAt: null,
      sortOrder: 1,
    });
    repos.transactions.create({
      date: '2026-09-01',
      kind: 'transfer',
      amount: 1000,
      accountId: from.id,
      toAccountId: to.id,
      categoryId: null,
      description: 'Giroconto',
      note: null,
      tagIds: [],
      excludeFromTotals: false,
      recurrenceId: null,
    });
    expect(existingFingerprints(repos).size).toBe(0);
  });
});
