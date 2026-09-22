import { mappingFor, parseCsv, planImport } from '@saldo/core';
import { createRepositories } from '../../db/repositories';
import { createTestDatabase } from '../../db/testing';
import { finishOnboarding } from './finish';
import type { OnboardingDraft } from './state';

const COMPLETED_AT = '2026-09-22T10:00:00.000Z';

const CSV = [
  'Date,Wallet,Type,"Category name",Amount,Currency,Note,Labels,Author',
  '2026-08-12T16:23:13+00:00,"My Money",Expense,Travel,-5.00000000,EUR,"aperitivo ",,"A Person"',
].join('\n');

const DRAFT: OnboardingDraft = {
  path: 'fresh',
  importPlan: null,
  periodKind: 'month',
  cycleStartDay: 27,
  currency: 'EUR',
  accountName: 'Banca',
  accountType: 'checking',
  balanceBuffer: '10.00',
  selectedCategoryKeys: ['groceries'],
  importBalanceBuffers: {},
  appLock: false,
};

function setup() {
  const db = createTestDatabase();
  const repos = createRepositories(db, () => COMPLETED_AT);
  const kv = { set: jest.fn() };
  const input = {
    translate: (key: string) => `t:${key}`,
    today: '2026-09-22',
    completedAt: COMPLETED_AT,
  } as const;
  return { db, repos, kv, input };
}

describe('finishOnboarding', () => {
  it('writes the fresh path: settings, the account and the kept categories', () => {
    const { db, repos, kv, input } = setup();
    finishOnboarding(db, repos, kv, { ...input, draft: DRAFT });
    expect(repos.settings.get()?.onboardingCompletedAt).toBe(COMPLETED_AT);
    expect(repos.accounts.list().map((account) => [account.name, account.openingBalance])).toEqual([
      ['Banca', 1000],
    ]);
    expect(kv.set).not.toHaveBeenCalled();
  });

  it('writes the import path with the balances step 4 left in the draft', () => {
    const { db, repos, kv, input } = setup();
    const { rows } = parseCsv(CSV);
    const plan = planImport(rows.slice(1), mappingFor(rows[0] ?? [], 'spendee'), {
      currency: 'EUR',
      accounts: [],
      categories: [],
      tags: [],
      existingFingerprints: new Set(),
    });
    finishOnboarding(db, repos, kv, {
      ...input,
      draft: {
        ...DRAFT,
        path: 'import',
        importPlan: plan,
        importBalanceBuffers: { 'My Money': '20.00' },
      },
    });
    // The history adds up to −5,00 €; the user says 20,00 € now.
    expect(repos.accounts.list()[0]?.openingBalance).toBe(2500);
    expect(repos.transactions.list()).toHaveLength(1);
  });

  it('turns the lock on for this device when step 5 did', () => {
    const { db, repos, kv, input } = setup();
    finishOnboarding(db, repos, kv, { ...input, draft: { ...DRAFT, appLock: true } });
    expect(kv.set).toHaveBeenCalledWith('appLockEnabled', 'true');
  });
});
