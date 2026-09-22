import type { AccountType, CurrencyCode, ImportPlan, PeriodKind } from '@saldo/core';
import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';

/** Every numbered step on either path: period, two of the path's own, balance(s), permissions. */
export const ONBOARDING_STEPS = 5;

/** What the onboarding steps collect before anything is written (§6.29). */
export interface OnboardingDraft {
  /** Chosen on the first screen: today's four steps, or an import in their place (§6.29). */
  path: 'fresh' | 'import';
  /** The accepted import preview, written only by "Inizia". */
  importPlan: ImportPlan | null;
  /** How the user tracks spending (§5.2); asked in step 1. */
  periodKind: PeriodKind;
  /** Only meaningful when `periodKind === 'cycle'`, but remembered either way. */
  cycleStartDay: number;
  currency: CurrencyCode;
  accountName: string;
  accountType: AccountType;
  /** Keypad buffer, converted to minor units on save. */
  balanceBuffer: string;
  selectedCategoryKeys: string[];
  /** Import step 4: what each imported account holds now, as keypad buffers by account name. */
  importBalanceBuffers: Record<string, string>;
  /** Step 5: the biometric lock, turned on after a successful authentication. Device-only (kv). */
  appLock: boolean;
}

export interface OnboardingValue {
  draft: OnboardingDraft;
  setDraft: (patch: Partial<OnboardingDraft>) => void;
}

const INITIAL: OnboardingDraft = {
  path: 'fresh',
  importPlan: null,
  periodKind: 'month',
  cycleStartDay: 27,
  currency: 'EUR',
  accountName: '',
  accountType: 'checking',
  balanceBuffer: '',
  selectedCategoryKeys: [],
  importBalanceBuffers: {},
  appLock: false,
};

const OnboardingContext = createContext<OnboardingValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [draft, setState] = useState<OnboardingDraft>(INITIAL);
  const value = useMemo<OnboardingValue>(
    () => ({
      draft,
      setDraft: (patch) => setState((current) => ({ ...current, ...patch })),
    }),
    [draft],
  );
  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingValue {
  const value = useContext(OnboardingContext);
  if (value === null) throw new Error('useOnboarding must be used inside an OnboardingProvider');
  return value;
}
