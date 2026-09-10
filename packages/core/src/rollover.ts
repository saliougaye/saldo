import { type Cycle, shiftCycle } from './cycle';
import type { LocalDate } from './dates';
import type { MinorUnits } from './money';

export interface RolloverInput {
  /** The budget's own limit, before any carry. */
  amount: MinorUnits;
  /** Start of the cycle the budget was created in; earlier cycles carry nothing. */
  createdAtCycleStart: LocalDate;
  cycle: Cycle;
  cycleStartDay: number;
  /** Counted spend of the budget's categories in a cycle, loaded by the caller. */
  spentInCycle: (cycle: Cycle) => MinorUnits;
}

/**
 * Unspent budget carried into `cycle` (§5.8): `carry = max(0, prevEffectiveLimit − prevSpent)`,
 * applied recursively back to the cycle the budget was created in.
 *
 * A cycle can never carry a debt forward — overspending is shown, not deducted from next month —
 * hence the `max(0, …)` at every step.
 */
export function budgetCarry(input: RolloverInput): MinorUnits {
  const { amount, createdAtCycleStart, cycle, cycleStartDay, spentInCycle } = input;
  if (cycle.start <= createdAtCycleStart) return 0;

  // Collect the cycles from creation up to the one before `cycle`, oldest first, so each step can
  // use the carry the step before produced.
  const chain: Cycle[] = [];
  let previous = shiftCycle(cycle, cycleStartDay, -1);
  while (previous.start >= createdAtCycleStart) {
    chain.unshift(previous);
    if (previous.start === createdAtCycleStart) break;
    previous = shiftCycle(previous, cycleStartDay, -1);
  }

  let carry = 0;
  for (const previous of chain) {
    carry = Math.max(0, amount + carry - spentInCycle(previous));
  }
  return carry;
}

/** The limit a cycle budget actually measures against (§5.8). */
export function effectiveLimit(input: RolloverInput & { rollover: boolean }): MinorUnits {
  return input.rollover ? input.amount + budgetCarry(input) : input.amount;
}
