import type { CurrencyCode, PeriodKind } from '@saldo/core';
import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';

/** What the three onboarding steps collect before anything is written (§6.29). */
export interface OnboardingDraft {
  /** How the user tracks spending (§5.2); asked in step 1. */
  periodKind: PeriodKind;
  /** Only meaningful when `periodKind === 'cycle'`, but remembered either way. */
  cycleStartDay: number;
  currency: CurrencyCode;
  accountName: string;
  accountType: 'cash' | 'checking' | 'credit_card' | 'savings' | 'investment';
  /** Keypad buffer, converted to minor units on save. */
  balanceBuffer: string;
  selectedCategoryKeys: string[];
}

export interface OnboardingValue {
  draft: OnboardingDraft;
  setDraft: (patch: Partial<OnboardingDraft>) => void;
}

const INITIAL: OnboardingDraft = {
  periodKind: 'month',
  cycleStartDay: 27,
  currency: 'EUR',
  accountName: '',
  accountType: 'checking',
  balanceBuffer: '',
  selectedCategoryKeys: [],
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
