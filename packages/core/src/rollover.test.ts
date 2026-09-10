import { describe, expect, it } from 'vitest';
import type { PeriodDef } from './period';
import { budgetCarry, effectiveLimit } from './rollover';

const START_DAY = 27;
/** The pay cycle these tests were written against (§5.2). */
const CYCLE_DEF: PeriodDef = { kind: 'cycle', startDay: START_DAY };
const APRIL = { start: '2026-03-27', end: '2026-04-26' };

/** Spend per cycle start, as the caller would load it. */
function spentBy(entries: Record<string, number>) {
  return (range: { start: string }) => entries[range.start] ?? 0;
}

describe('budgetCarry', () => {
  it('is zero in the cycle the budget was created in', () => {
    expect(
      budgetCarry({
        amount: 40000,
        createdAtPeriodStart: APRIL.start,
        period: APRIL,
        def: CYCLE_DEF,
        spentInPeriod: spentBy({}),
      }),
    ).toBe(0);
  });

  it('carries what the previous cycle left unspent', () => {
    const carry = budgetCarry({
      amount: 40000,
      createdAtPeriodStart: '2026-02-27',
      period: APRIL,
      def: CYCLE_DEF,
      spentInPeriod: spentBy({ '2026-02-27': 30000 }),
    });
    expect(carry).toBe(10000);
  });

  it('accumulates across cycles', () => {
    // The cycle starting 27 Mar is preceded by the ones starting 27 Feb, 27 Jan and 27 Dec, and a
    // cycle never contributes to its own carry.
    const carry = budgetCarry({
      amount: 40000,
      createdAtPeriodStart: '2025-12-27',
      period: APRIL,
      def: CYCLE_DEF,
      spentInPeriod: spentBy({ '2025-12-27': 40000, '2026-01-27': 30000, '2026-02-27': 20000 }),
    });
    // Dec: spent the lot → carry 0. Jan: limit 40000, spent 30000 → carry 10000.
    // Feb: limit 50000, spent 20000 → carry 30000.
    expect(carry).toBe(30000);
  });

  it('ignores what the selected cycle itself has spent', () => {
    const carry = budgetCarry({
      amount: 40000,
      createdAtPeriodStart: '2026-02-27',
      period: APRIL,
      def: CYCLE_DEF,
      spentInPeriod: spentBy({ '2026-02-27': 30000, '2026-03-27': 99999 }),
    });
    expect(carry).toBe(10000);
  });

  it('never carries a debt', () => {
    const carry = budgetCarry({
      amount: 40000,
      createdAtPeriodStart: '2026-02-27',
      period: APRIL,
      def: CYCLE_DEF,
      spentInPeriod: spentBy({ '2026-02-27': 90000 }),
    });
    expect(carry).toBe(0);
  });

  it('is zero for a cycle before the budget existed', () => {
    expect(
      budgetCarry({
        amount: 40000,
        createdAtPeriodStart: '2026-04-27',
        period: APRIL,
        def: CYCLE_DEF,
        spentInPeriod: spentBy({}),
      }),
    ).toBe(0);
  });
});

describe('effectiveLimit', () => {
  it('adds the carry only when rollover is on', () => {
    const input = {
      amount: 40000,
      createdAtPeriodStart: '2026-02-27',
      period: APRIL,
      def: CYCLE_DEF,
      spentInPeriod: spentBy({ '2026-02-27': 30000 }),
    };
    expect(effectiveLimit({ ...input, rollover: true })).toBe(50000);
    expect(effectiveLimit({ ...input, rollover: false })).toBe(40000);
  });
});
