import {
  type Cycle,
  canShiftPeriod,
  type DateRange,
  describePeriod,
  type LocalDate,
  type PeriodDef,
  periodContaining,
  shiftPeriod,
  todayLocal,
} from '@saldo/core';
import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';
import { useSettings } from '../../db/hooks';

export interface Period {
  range: DateRange;
  /** True for a whole period of the user's kind, false for an ad-hoc range (§6.15). */
  isPeriod: boolean;
  /** True when the range contains today. */
  isCurrent: boolean;
  length: number;
  elapsed: number;
}

export interface PeriodValue {
  today: LocalDate;
  /** How the user tracks spending (§5.2). Screens pass this to `@saldo/core`, not a start day. */
  def: PeriodDef;
  period: Period;
  /** Moves by whole periods. On a custom range it first returns to the period holding today. */
  shift: (delta: number) => void;
  /** False past the period after this one (§6.15); the header greys its › out rather than lying. */
  canShift: (delta: number) => boolean;
  setCustomRange: (range: DateRange) => void;
  goToPeriod: (period: Cycle) => void;
  /** Back to the period containing today — what a changed kind or start day has to fall back to. */
  resetToCurrent: () => void;
}

/**
 * The selection is stored as *the range itself*, not as an offset from today: jumping to an
 * arbitrary period from the sheet then needs no arithmetic on month lengths.
 */
type Selection = { kind: 'period'; range: Cycle } | { kind: 'custom'; range: DateRange };

const PeriodContext = createContext<PeriodValue | null>(null);

/** Defaults before settings exist: a calendar month, with the 27th remembered for the cycle kind. */
const FALLBACK: PeriodDef = { kind: 'month', startDay: 27 };

/**
 * The selected period, shared by Home, Transactions and Statistics (§6.15). `today` is captured
 * once per mount so every screen agrees, and `@saldo/core` receives it explicitly (§3.2).
 */
export function PeriodProvider({ children }: { children: ReactNode }) {
  const settings = useSettings();
  const [today] = useState(() => todayLocal());
  const [selection, setSelection] = useState<Selection | null>(null);

  const def = useMemo<PeriodDef>(
    () =>
      settings === null
        ? FALLBACK
        : { kind: settings.periodKind, startDay: settings.cycleStartDay },
    [settings],
  );

  const value = useMemo<PeriodValue>(() => {
    const current = periodContaining(def, today);
    // A null selection means "the period containing today", which follows a changed kind or day.
    const active: Selection = selection ?? { kind: 'period', range: current };
    const view = describePeriod(active.range, today);
    return {
      today,
      def,
      period: { ...view, isPeriod: active.kind === 'period' },
      shift: (delta) => {
        const from = active.kind === 'period' ? active.range : current;
        if (!canShiftPeriod(def, from, delta, today)) return;
        setSelection({ kind: 'period', range: shiftPeriod(def, from, delta) });
      },
      canShift: (delta) =>
        canShiftPeriod(def, active.kind === 'period' ? active.range : current, delta, today),
      setCustomRange: (range) => setSelection({ kind: 'custom', range }),
      goToPeriod: (range) => setSelection({ kind: 'period', range }),
      resetToCurrent: () => setSelection(null),
    };
  }, [def, selection, today]);

  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>;
}

export function usePeriod(): PeriodValue {
  const value = useContext(PeriodContext);
  if (value === null) throw new Error('usePeriod must be used inside a PeriodProvider');
  return value;
}
