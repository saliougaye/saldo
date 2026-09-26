import { createRepositories } from './repositories';
import { PICKABLE_SEED_CATEGORIES, SEED_CATEGORIES, seedFromOnboarding } from './seed';
import { createTestDatabase } from './testing';

const BASE = {
  periodKind: 'cycle',
  cycleStartDay: 27,
  currency: 'EUR',
  language: 'it',
  theme: 'dark',
  account: {
    name: 'Conto corrente',
    type: 'checking',
    openingBalance: 500000,
    icon: 'landmark',
  },
  translate: (key: string) => `t:${key}`,
  completedAt: '2026-04-18T10:00:00.000Z',
  timeZone: 'Europe/Rome',
} as const;

function seed(selectedCategoryKeys: readonly string[]) {
  const db = createTestDatabase();
  const repos = createRepositories(db, () => BASE.completedAt);
  seedFromOnboarding(repos, { ...BASE, selectedCategoryKeys });
  return repos;
}

describe('SEED_CATEGORIES', () => {
  it('offers exactly the 12 tiles of the onboarding grid', () => {
    expect(PICKABLE_SEED_CATEGORIES).toHaveLength(12);
    expect(SEED_CATEGORIES).toHaveLength(14);
  });

  it('keeps refunds and gifts out of the grid but in the catalogue', () => {
    const hidden = SEED_CATEGORIES.filter((category) => category.hidden === true);
    expect(hidden.map((category) => category.nameKey)).toEqual(['refunds', 'gifts']);
  });
});

describe('seedFromOnboarding', () => {
  it('writes settings and the first account', () => {
    const repos = seed([]);
    expect(repos.settings.get()?.cycleStartDay).toBe(27);
    expect(repos.settings.get()?.onboardingCompletedAt).toBe(BASE.completedAt);
    const [account] = repos.accounts.list();
    expect(account?.name).toBe('Conto corrente');
    expect(account?.openingBalance).toBe(500000);
    expect(account?.includeInSpendable).toBe(true);
  });

  it('writes no account when onboarding brings its own (an import, §6.29)', () => {
    const db = createTestDatabase();
    const repos = createRepositories(db, () => BASE.completedAt);
    expect(seedFromOnboarding(repos, { ...BASE, account: null, selectedCategoryKeys: [] })).toBe(
      true,
    );
    expect(repos.settings.get()?.onboardingCompletedAt).toBe(BASE.completedAt);
    expect(repos.accounts.list()).toEqual([]);
    expect(repos.categories.list().map((category) => category.name)).toEqual([
      't:refunds',
      't:gifts',
    ]);
  });

  it('writes nothing when a sync already delivered the account settings', () => {
    const db = createTestDatabase();
    const repos = createRepositories(db, () => BASE.completedAt);
    repos.settings.create({
      periodKind: 'month',
      cycleStartDay: 1,
      currency: 'EUR',
      language: 'system',
      theme: 'system',
      onboardingCompletedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(seedFromOnboarding(repos, { ...BASE, selectedCategoryKeys: ['groceries'] })).toBe(false);
    expect(repos.settings.get()?.cycleStartDay).toBe(1);
    expect(repos.accounts.list()).toHaveLength(0);
    expect(repos.categories.list()).toHaveLength(0);
  });

  it('creates the hidden income categories even when nothing is selected', () => {
    const names = seed([])
      .categories.list()
      .map((category) => category.name);
    expect(names).toEqual(['t:refunds', 't:gifts']);
  });

  it('creates a selected parent together with its children', () => {
    const categories = seed(['groceries']).categories.list();
    const parent = categories.find((category) => category.name === 't:groceries');
    expect(parent?.parentId).toBeNull();
    const children = categories.filter((category) => category.parentId === parent?.id);
    expect(children.map((child) => child.name)).toEqual(['t:supermarket', 't:bakery']);
  });

  it('skips categories the user unselected', () => {
    const names = seed(['utilities'])
      .categories.list()
      .map((category) => category.name);
    expect(names).toContain('t:utilities');
    expect(names).not.toContain('t:groceries');
    expect(names).not.toContain('t:supermarket');
  });

  it('inherits the parent direction for children, so income never mixes with expense', () => {
    const categories = seed(['salary', 'groceries']).categories.list();
    for (const category of categories) {
      const expected =
        category.name === 't:salary' ||
        category.name.startsWith('t:refund') ||
        category.name === 't:gifts'
          ? 'income'
          : 'expense';
      expect(category.direction).toBe(expected);
    }
  });

  it('numbers sortOrder so parents and children keep the catalogue order', () => {
    const categories = seed(['groceries', 'home']).categories.list();
    expect(categories.map((category) => category.name)).toEqual([
      't:groceries',
      't:supermarket',
      't:bakery',
      't:home',
      't:rent',
      't:maintenance',
      't:refunds',
      't:gifts',
    ]);
  });
});
