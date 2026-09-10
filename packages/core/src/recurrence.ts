import {
  addDays,
  addMonths,
  daysInMonth,
  type LocalDate,
  makeLocalDate,
  parseLocalDate,
} from './dates';
import type { Recurrence, Transaction } from './entities';
import { occurrenceId } from './ids';
import { type PeriodDef, periodContaining, shiftPeriod } from './period';

/**
 * Dates a monthly recurrence fires on, from `startDate` up to `min(endDate, horizonEnd)` (§5.9).
 *
 * The day of month comes from `startDate` and is clamped per month, so a recurrence on the 31st
 * fires on the 28th in February and returns to the 31st in March — it is never lost.
 */
export function occurrenceDates(
  startDate: LocalDate,
  endDate: LocalDate | null,
  horizonEnd: LocalDate,
): LocalDate[] {
  const { year, month, day } = parseLocalDate(startDate);
  const last = endDate === null || endDate > horizonEnd ? horizonEnd : endDate;
  const dates: LocalDate[] = [];
  for (let offset = 0; ; offset += 1) {
    const ym = addMonths({ year, month }, offset);
    const date = makeLocalDate(ym.year, ym.month, Math.min(day, daysInMonth(ym.year, ym.month)));
    if (date > last) break;
    if (date >= startDate) dates.push(date);
  }
  return dates;
}

/** How far ahead the materialiser goes: the end of the cycle after the current one (§5.9). */
export function recurrenceHorizonEnd(def: PeriodDef, today: LocalDate): LocalDate {
  return shiftPeriod(def, periodContaining(def, today), 1).end;
}

/** A scheduled occurrence, ready for the transactions repository. */
export type NewOccurrence = Omit<Transaction, 'createdAt' | 'updatedAt' | 'deletedAt'>;

/**
 * Occurrences that do not exist yet (§5.9). `existingIds` must include tombstones, otherwise a
 * deleted occurrence would come back on the next run.
 */
export function materializeOccurrences(
  recurrence: Recurrence,
  existingIds: ReadonlySet<string>,
  horizonEnd: LocalDate,
): NewOccurrence[] {
  if (recurrence.deletedAt !== null) return [];
  return occurrenceDates(recurrence.startDate, recurrence.endDate, horizonEnd)
    .map((date) => ({ date, id: occurrenceId(recurrence.id, date) }))
    .filter(({ id }) => !existingIds.has(id))
    .map(({ date, id }) => ({
      ...recurrence.template,
      id,
      date,
      note: null,
      recurrenceId: recurrence.id,
    }));
}

export type RecurrenceEditScope = 'only-this' | 'this-and-following' | 'all';

export interface RecurrenceEditInput {
  recurrence: Recurrence;
  /** Date of the occurrence the user is editing. */
  occurrenceDate: LocalDate;
  /** Every existing occurrence of this recurrence, tombstones excluded. */
  occurrences: readonly { id: string; date: LocalDate }[];
  today: LocalDate;
}

export interface RecurrenceEditPlan {
  scope: RecurrenceEditScope;
  /** Occurrences to rewrite with the edited values, keeping each one's own date. */
  updateOccurrenceIds: string[];
  /** Occurrences to tombstone so the new recurrence can replace them. */
  tombstoneOccurrenceIds: string[];
  /** New `endDate` for the recurrence being replaced. */
  endCurrentRecurrenceOn: LocalDate | null;
  /** `startDate` of the recurrence to create from the edited values. */
  startNewRecurrenceOn: LocalDate | null;
  updateTemplate: boolean;
  /** For the sheet's copy: how many occurrences the choice leaves alone (§5.9). */
  unchangedCount: number;
}

/**
 * Turns the scope the user picked in the sheet into the exact set of writes (§5.9). Pure, so the
 * three branches are unit-tested without a database; the repository applies the plan in one
 * transaction.
 */
export function planRecurrenceEdit(
  scope: RecurrenceEditScope,
  input: RecurrenceEditInput,
): RecurrenceEditPlan {
  const { occurrenceDate, occurrences, today } = input;

  if (scope === 'only-this') {
    const target = occurrences.filter((row) => row.date === occurrenceDate);
    return {
      scope,
      updateOccurrenceIds: target.map((row) => row.id),
      tombstoneOccurrenceIds: [],
      endCurrentRecurrenceOn: null,
      startNewRecurrenceOn: null,
      updateTemplate: false,
      unchangedCount: occurrences.length - target.length,
    };
  }

  if (scope === 'all') {
    return {
      scope,
      updateOccurrenceIds: occurrences.map((row) => row.id),
      tombstoneOccurrenceIds: [],
      endCurrentRecurrenceOn: null,
      startNewRecurrenceOn: null,
      updateTemplate: true,
      unchangedCount: 0,
    };
  }

  // "This and following": close the old series the day before, then start a new one here. Only the
  // edited occurrence and the *upcoming* ones are removed — a past occurrence records money that
  // actually moved, so it stays even if its date sorts after the edited one.
  const doomed = occurrences.filter(
    (row) => row.date >= occurrenceDate && (row.date === occurrenceDate || row.date > today),
  );
  return {
    scope,
    updateOccurrenceIds: [],
    tombstoneOccurrenceIds: doomed.map((row) => row.id),
    endCurrentRecurrenceOn: addDays(occurrenceDate, -1),
    startNewRecurrenceOn: occurrenceDate,
    updateTemplate: false,
    unchangedCount: occurrences.length - doomed.length,
  };
}
