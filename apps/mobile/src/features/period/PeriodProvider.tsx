import {
  type Cycle,
  cycleContaining,
  cycleLength,
  type DateRange,
  elapsedDays,
  isWithin,
  type LocalDate,
  shiftCycle,
  todayLocal,
} from '@saldo/core';
import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';
import { useSettings } from '../../db/hooks';

export interface Period {
  range: DateRange;
  /** True for a cycle range, false for a custom one (§6.15). */
  isCycle: boolean;
  /** True when the range contains today. */
  isCurrent: boolean;
  length: number;
  elapsed: number;
}

export interface PeriodValue {
  today: LocalDate;
  cycleStartDay: number;
  period: Period;
  /** Moves by whole cycles. On a custom range it first returns to the cycle holding today. */
  shift: (delta: number) => void;
  setCustomRange: (range: DateRange) => void;
  goToCycle: (cycle: Cycle) => void;
}

/**
 * The selection is stored as *the cycle itself*, not as an offset from today: jumping to an
 * arbitrary cycle from the period sheet then needs no arithmetic on month lengths.
 */
type Selection = { kind: 'cycle'; cycle: Cycle } | { kind: 'custom'; range: DateRange };

const PeriodContext = createContext<PeriodValue | null>(null);

function describe(range: DateRange, today: LocalDate, isCycle: boolean): Period {
  return {
    range,
    isCycle,
    isCurrent: isWithin(range, today),
    length: cycleLength(range),
    elapsed: elapsedDays(range, today),
  };
}

/**
 * The selected period, shared by Home, Transactions and Statistics (§6.15). `today` is captured
 * once per mount so every screen agrees, and `@saldo/core` receives it explicitly (§3.2).
 */
export function PeriodProvider({ children }: { children: ReactNode }) {
  const settings = useSettings();
  const cycleStartDay = settings?.cycleStartDay ?? 27;
  const [today] = useState(() => todayLocal());
  const [selection, setSelection] = useState<Selection | null>(null);

  const value = useMemo<PeriodValue>(() => {
    const current = cycleContaining(today, cycleStartDay);
    // A null selection means "the cycle containing today", which follows a changed start day.
    const active: Selection = selection ?? { kind: 'cycle', cycle: current };
    const period =
      active.kind === 'cycle'
        ? describe(active.cycle, today, true)
        : describe(active.range, today, false);
    return {
      today,
      cycleStartDay,
      period,
      shift: (delta) => {
        const from = active.kind === 'cycle' ? active.cycle : current;
        setSelection({ kind: 'cycle', cycle: shiftCycle(from, cycleStartDay, delta) });
      },
      setCustomRange: (range) => setSelection({ kind: 'custom', range }),
      goToCycle: (cycle) => setSelection({ kind: 'cycle', cycle }),
    };
  }, [cycleStartDay, selection, today]);

  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>;
}

export function usePeriod(): PeriodValue {
  const value = useContext(PeriodContext);
  if (value === null) throw new Error('usePeriod must be used inside a PeriodProvider');
  return value;
}
