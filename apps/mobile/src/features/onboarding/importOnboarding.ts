import { type ImportPlan, importedBalances, type LocalDate, type MinorUnits } from '@saldo/core';
import type { Repositories } from '../../db/repositories';
import type { RepositoryDatabase } from '../../db/repositories/support';
import { type SeedInput, seedFromOnboarding } from '../../db/seed';
import { writeImport } from '../../io/importService';

export interface ImportSeedInput extends Omit<SeedInput, 'account' | 'selectedCategoryKeys'> {
  plan: ImportPlan;
  /** What the user says each imported account holds now, by the name the plan gave it. */
  currentBalances: ReadonlyMap<string, MinorUnits>;
  today: LocalDate;
}

/**
 * "Inizia" on the import path of onboarding (§6.29): settings, the hidden seed categories and the
 * import, in one transaction — an onboarding that stopped halfway would leave an account with
 * settings and half a history.
 *
 * Each account's opening balance is the entered balance minus what its imported history adds up
 * to, the same rule as editing a balance in the account sheet (§6.22), so the history stays as the
 * file had it and today's balance is the one the bank shows.
 *
 * Returns false and writes nothing when a sync already delivered the account's settings, as
 * `seedFromOnboarding` does.
 */
export function seedFromImport(
  db: RepositoryDatabase,
  repos: Repositories,
  input: ImportSeedInput,
): boolean {
  const { plan, currentBalances, today, ...seed } = input;
  return db.transaction(() => {
    if (!seedFromOnboarding(repos, { ...seed, account: null, selectedCategoryKeys: [] })) {
      return false;
    }
    const imported = importedBalances(plan, today);
    const openingBalances = new Map(
      [...currentBalances].map(([name, current]) => [name, current - (imported.get(name) ?? 0)]),
    );
    writeImport(repos, plan, { openingBalances });
    return true;
  });
}
