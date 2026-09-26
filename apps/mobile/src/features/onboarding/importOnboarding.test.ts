import { mappingFor, parseCsv, planImport } from '@saldo/core';
import { createRepositories } from '../../db/repositories';
import { createTestDatabase } from '../../db/testing';
import { seedFromImport } from './importOnboarding';

const COMPLETED_AT = '2026-09-17T10:00:00.000Z';

const CSV = [
  'Date,Wallet,Type,"Category name",Amount,Currency,Note,Labels,Author',
  '2026-08-12T16:23:13+00:00,"My Money",Expense,Travel,-5.00000000,EUR,"aperitivo ",,"A Person"',
  '2026-08-12T16:23:58+00:00,"My Money",Income,t:gifts,70.00000000,EUR,"regalo",,"A Person"',
].join('\n');

function importPlan() {
  const { rows } = parseCsv(CSV);
  return planImport(rows.slice(1), mappingFor(rows[0] ?? [], 'spendee'), {
    currency: 'EUR',
    accounts: [],
    categories: [],
    tags: [],
    existingFingerprints: new Set(),
  });
}

const INPUT = {
  periodKind: 'month',
  cycleStartDay: 27,
  currency: 'EUR',
  language: 'system',
  theme: 'system',
  translate: (key: string) => `t:${key}`,
  completedAt: COMPLETED_AT,
  timeZone: 'Europe/Rome',
  today: '2026-09-17',
} as const;

describe('seedFromImport', () => {
  it('writes settings, the hidden categories, and the imported history', () => {
    const db = createTestDatabase();
    const repos = createRepositories(db, () => COMPLETED_AT);
    const plan = importPlan();

    expect(
      seedFromImport(db, repos, {
        ...INPUT,
        plan,
        currentBalances: new Map([['My Money', 10000]]),
      }),
    ).toBe(true);

    expect(repos.settings.get()?.onboardingCompletedAt).toBe(COMPLETED_AT);
    expect(repos.transactions.list()).toHaveLength(2);
    // The file's "t:gifts" lands on the seeded row instead of beside it.
    expect(
      repos.categories
        .list()
        .map((category) => category.name)
        .sort(),
    ).toEqual(['Travel', 't:gifts', 't:refunds']);
  });

  it('stores the opening balance that makes the entered balance the current one (§6.22)', () => {
    const db = createTestDatabase();
    const repos = createRepositories(db, () => COMPLETED_AT);
    // The history adds up to +65,00 €; the bank says 100,00 €.
    seedFromImport(db, repos, {
      ...INPUT,
      plan: importPlan(),
      currentBalances: new Map([['My Money', 10000]]),
    });
    expect(repos.accounts.list()[0]?.openingBalance).toBe(3500);
  });

  it('writes nothing when a sync already delivered the account settings', () => {
    const db = createTestDatabase();
    const repos = createRepositories(db, () => COMPLETED_AT);
    repos.settings.create({
      periodKind: 'month',
      cycleStartDay: 1,
      currency: 'EUR',
      language: 'system',
      theme: 'system',
      onboardingCompletedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(
      seedFromImport(db, repos, { ...INPUT, plan: importPlan(), currentBalances: new Map() }),
    ).toBe(false);
    expect(repos.accounts.list()).toEqual([]);
    expect(repos.transactions.list()).toEqual([]);
  });
});
