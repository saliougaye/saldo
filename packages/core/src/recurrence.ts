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

/** The part of a recurrence that says *when* it fires. */
export type RecurrenceSchedule = Pick<
  Recurrence,
  'frequency' | 'interval' | 'startDate' | 'endDate'
>;

/**
 * The k-th date a schedule fires on, k = 0 being `startDate` (§5.9).
 *
 * `startDate` is the anchor: its day of month for monthly and yearly schedules — clamped per
 * month, so the 31st fires on the 28th in February and returns to the 31st in March, and 29 Feb
 * fires on the 28th in common years — and its weekday for weekly ones.
 */
export function nthOccurrence(
  schedule: Pick<RecurrenceSchedule, 'frequency' | 'interval' | 'startDate'>,
  k: number,
): LocalDate {
  const steps = k * schedule.interval;
  switch (schedule.frequency) {
    case 'daily':
      return addDays(schedule.startDate, steps);
    case 'weekly':
      return addDays(schedule.startDate, steps * 7);
    case 'monthly':
    case 'yearly': {
      const { year, month, day } = parseLocalDate(schedule.startDate);
      const ym = addMonths({ year, month }, schedule.frequency === 'monthly' ? steps : steps * 12);
      return makeLocalDate(ym.year, ym.month, Math.min(day, daysInMonth(ym.year, ym.month)));
    }
  }
}

/** Dates a schedule fires on, from `startDate` up to `min(endDate, horizonEnd)` inclusive (§5.9). */
export function occurrenceDates(schedule: RecurrenceSchedule, horizonEnd: LocalDate): LocalDate[] {
  const last =
    schedule.endDate === null || schedule.endDate > horizonEnd ? horizonEnd : schedule.endDate;
  const dates: LocalDate[] = [];
  for (let k = 0; ; k += 1) {
    const date = nthOccurrence(schedule, k);
    if (date > last) break;
    dates.push(date);
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
  return occurrenceDates(recurrence, horizonEnd)
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

/** The first date a schedule fires strictly after `after`, or null once it has ended. */
export function nextOccurrence(schedule: RecurrenceSchedule, after: LocalDate): LocalDate | null {
  for (let k = 0; ; k += 1) {
    const date = nthOccurrence(schedule, k);
    if (schedule.endDate !== null && date > schedule.endDate) return null;
    if (date > after) return date;
  }
}

/** The `endDate` that makes a schedule fire exactly `count` times ("dopo N volte", §5.9). */
export function endDateAfterCount(
  schedule: Pick<RecurrenceSchedule, 'frequency' | 'interval' | 'startDate'>,
  count: number,
): LocalDate {
  return nthOccurrence(schedule, Math.max(1, Math.floor(count)) - 1);
}

const FIRES_PER_YEAR: Record<Recurrence['frequency'], number> = {
  daily: 365,
  weekly: 52,
  monthly: 12,
  yearly: 1,
};

/** How many times a schedule fires in an average month. */
export function occurrencesPerMonth(
  schedule: Pick<RecurrenceSchedule, 'frequency' | 'interval'>,
): number {
  return FIRES_PER_YEAR[schedule.frequency] / 12 / schedule.interval;
}

export interface RecurringMonthlyTotals {
  /** Minor units a month, positive. */
  expense: number;
  income: number;
}

/**
 * What the live recurrences add up to in a month (§6.33). Transfers move money between two of the
 * user's own accounts, so they belong to neither side.
 */
export function recurringMonthlyTotals(recurrences: readonly Recurrence[]): RecurringMonthlyTotals {
  let expense = 0;
  let income = 0;
  for (const recurrence of recurrences) {
    const perMonth = Math.round(recurrence.template.amount * occurrencesPerMonth(recurrence));
    if (recurrence.template.kind === 'expense') expense += perMonth;
    else if (recurrence.template.kind === 'income') income += perMonth;
  }
  return { expense, income };
}

export interface StopRecurrencePlan {
  /** New `endDate`, or null when the recurrence goes away entirely. */
  endDate: LocalDate | null;
  deleteRecurrence: boolean;
  tombstoneOccurrenceIds: string[];
}

/**
 * "Smetti di ripetere" (§5.9): the past stays, the future goes. The series ends on `today`, so an
 * occurrence dated today is kept; a series that has not started yet has nothing to keep.
 */
export function planStopRecurrence(
  recurrence: Recurrence,
  occurrences: readonly { id: string; date: LocalDate }[],
  today: LocalDate,
): StopRecurrencePlan {
  const tombstoneOccurrenceIds = occurrences.filter((row) => row.date > today).map((row) => row.id);
  if (recurrence.startDate > today) {
    return { endDate: null, deleteRecurrence: true, tombstoneOccurrenceIds };
  }
  return { endDate: today, deleteRecurrence: false, tombstoneOccurrenceIds };
}
