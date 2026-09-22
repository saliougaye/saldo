import { amountBufferToMinor, getCurrency, type LocalDate } from '@saldo/core';
import type { KvStore } from '../../db/kv';
import type { Repositories } from '../../db/repositories';
import type { RepositoryDatabase } from '../../db/repositories/support';
import { seedFromOnboarding } from '../../db/seed';
import { ACCOUNT_TYPE_ICONS } from '../accounts/accountTypeIcon';
import { seedFromImport } from './importOnboarding';
import type { OnboardingDraft } from './state';

export interface FinishInput {
  draft: OnboardingDraft;
  /** Resolves a `seed.*` key to the user's language. */
  translate: (key: string) => string;
  today: LocalDate;
  completedAt: string;
}

/**
 * «Inizia» on step 5 (§6.29): everything the steps collected, written in one go. Nothing before
 * this writes a row. The seeders return false when a sync delivered the account's own settings
 * meanwhile, and those rows win (§8.3); the app is ready either way, so the caller goes on.
 *
 * The lock flag is device state, not account data, so it is set whatever the seeders decided.
 */
export function finishOnboarding(
  db: RepositoryDatabase,
  repos: Repositories,
  kv: Pick<KvStore, 'set'>,
  { draft, translate, today, completedAt }: FinishInput,
): void {
  const { minorDigits } = getCurrency(draft.currency);
  const settings = {
    periodKind: draft.periodKind,
    cycleStartDay: draft.cycleStartDay,
    currency: draft.currency,
    language: 'system',
    theme: 'system',
    translate,
    completedAt,
  } as const;

  if (draft.path === 'import') {
    // Step 4 of the import path cannot continue without a plan, so this only guards the type.
    if (draft.importPlan !== null) {
      seedFromImport(db, repos, {
        ...settings,
        plan: draft.importPlan,
        today,
        currentBalances: new Map(
          Object.entries(draft.importBalanceBuffers).map(([name, buffer]) => [
            name,
            amountBufferToMinor(buffer, minorDigits),
          ]),
        ),
      });
    }
  } else {
    seedFromOnboarding(repos, {
      ...settings,
      account: {
        name: draft.accountName.length > 0 ? draft.accountName : translate('firstAccount'),
        type: draft.accountType,
        openingBalance: amountBufferToMinor(draft.balanceBuffer, minorDigits),
        icon: ACCOUNT_TYPE_ICONS[draft.accountType],
      },
      selectedCategoryKeys: draft.selectedCategoryKeys,
    });
  }

  if (draft.appLock) kv.set('appLockEnabled', 'true');
}
