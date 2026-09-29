import {
  type AccountType,
  type CurrencyCode,
  onboardingSeed,
  type PeriodKind,
  PICKABLE_SEED_CATEGORIES,
  SEED_CATEGORIES,
  type SeedCategory,
  type Settings,
} from '@saldo/core';
import type { IconName } from '@saldo/ui';
import type { Repositories } from './repositories';

export type { SeedCategory };
export { PICKABLE_SEED_CATEGORIES, SEED_CATEGORIES };

export interface SeedInput {
  /** Written straight into `settings`, so it mirrors that row rather than a `PeriodDef`. */
  periodKind: PeriodKind;
  cycleStartDay: number;
  currency: CurrencyCode;
  language: Settings['language'];
  theme: 'system' | 'dark' | 'light';
  /** Null when the accounts come from somewhere else — an import (§6.29). */
  account: {
    name: string;
    type: AccountType;
    openingBalance: number;
    icon: IconName;
  } | null;
  /** `nameKey`s the user kept selected. Hidden rows are created regardless. */
  selectedCategoryKeys: readonly string[];
  /** Resolves a `seed.*` key to the user's language. */
  translate: (key: string) => string;
  completedAt: string;
  /** The device's zone at onboarding (D37). */
  timeZone: string;
}

/**
 * Writes what onboarding collected: the settings singleton, the first account, and the selected
 * categories with their children (§4.2, §6.29), through `onboardingSeed` (`@saldo/core`) — the
 * same function the web's onboarding calls. Every write goes through a repository, so each row is
 * validated and stamped; seed categories get the deterministic id `onboardingSeed` assigns them,
 * so a phone that onboarded offline and a web onboarding of the same account converge on one row
 * per category (§17.1.3).
 *
 * Returns false and writes nothing when the account already has settings: a first sync can land
 * while the user is still stepping through onboarding, and the account's own rows win over a
 * second set of seed data (§8.3). Inserting anyway broke on `UNIQUE constraint failed: settings.id`.
 */
export function seedFromOnboarding(repos: Repositories, input: SeedInput): boolean {
  if (repos.settings.get() !== null) return false;

  const seed = onboardingSeed(input);

  repos.settings.create(seed.settings);
  if (seed.account !== null) repos.accounts.create(seed.account);
  for (const category of seed.categories) repos.categories.create(category);

  return true;
}
