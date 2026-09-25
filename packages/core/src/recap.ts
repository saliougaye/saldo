import type { DateRange } from './cycle';
import type { LocalDate } from './dates';
import { type PeriodDef, periodContaining, shiftPeriod } from './period';

/**
 * The period a recap is about (§5.15): the one immediately before the period containing today,
 * under the kind in force. Only that one — after weeks away there is still a single recap.
 */
export function recapPeriod(def: PeriodDef, today: LocalDate): DateRange {
  return shiftPeriod(def, periodContaining(def, today), -1);
}
