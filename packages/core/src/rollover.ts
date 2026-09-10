import type { Cycle } from './cycle';
import type { LocalDate } from './dates';
import type { MinorUnits } from './money';
import { type PeriodDef, shiftPeriod } from './period';

export interface RolloverInput {
  /** The budget's own limit, before any carry. */
  amount: MinorUnits;
  /** Start of the period the budget was created in; earlier periods carry nothing. */
  createdAtPeriodStart: LocalDate;
  period: Cycle;
  def: PeriodDef;
  /** Counted spend of the budget's categories in a period, loaded by the caller. */
  spentInPeriod: (period: Cycle) => MinorUnits;
}

/**
 * Unspent budget carried into `period` (§5.8): `carry = max(0, prevEffectiveLimit − prevSpent)`,
 * applied recursively back to the period the budget was created in.
 *
 * A period can never carry a debt forward — overspending is shown, not deducted from the next one —
 * hence the `max(0, …)` at every step.
 */
export function budgetCarry(input: RolloverInput): MinorUnits {
  const { amount, createdAtPeriodStart, period, def, spentInPeriod } = input;
  if (period.start <= createdAtPeriodStart) return 0;

  // Collect the periods from creation up to the one before `period`, oldest first, so each step
  // can use the carry the step before produced.
  const chain: Cycle[] = [];
  let previous = shiftPeriod(def, period, -1);
  while (previous.start >= createdAtPeriodStart) {
    chain.unshift(previous);
    if (previous.start === createdAtPeriodStart) break;
    previous = shiftPeriod(def, previous, -1);
  }

  let carry = 0;
  for (const previous of chain) {
    carry = Math.max(0, amount + carry - spentInPeriod(previous));
  }
  return carry;
}

/** The limit a period budget actually measures against (§5.8). */
export function effectiveLimit(input: RolloverInput & { rollover: boolean }): MinorUnits {
  return input.rollover ? input.amount + budgetCarry(input) : input.amount;
}
