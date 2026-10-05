import { createRepositories } from './repositories';
import { seedFromOnboarding } from './seed';
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

describe('seedFromOnboarding', () => {
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

  it('leaves alone a seed category a partial first sync already delivered', () => {
    const db = createTestDatabase();
    const repos = createRepositories(db, () => BASE.completedAt);
    // A pull that brought the web's seed categories but not yet its settings row.
    repos.categories.create({
      id: 'seed-category-groceries',
      name: 'Spesa (dal web)',
      direction: 'expense',
      parentId: null,
      icon: 'cart',
      colorIndex: 1,
      archivedAt: null,
      sortOrder: 0,
    });

    expect(seedFromOnboarding(repos, { ...BASE, selectedCategoryKeys: ['groceries'] })).toBe(true);
    const categories = repos.categories.list();
    expect(categories.filter((category) => category.id === 'seed-category-groceries')).toEqual([
      expect.objectContaining({ name: 'Spesa (dal web)' }),
    ]);
    expect(categories.map((category) => category.name)).toContain('t:supermarket');
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
});
