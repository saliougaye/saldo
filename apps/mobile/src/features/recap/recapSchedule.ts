import {
  type DateRange,
  type LocalDate,
  type PeriodDef,
  periodContaining,
  shiftPeriod,
} from '@saldo/core';
import { reminderTrigger } from '../accounts/cardReminders';

/** kv key holding the last period recapped on this device (§5.15). Never synced. */
export const RECAP_KEY = 'lastRecapPeriod';

/**
 * Written to `RECAP_KEY` by the dev «rivedi recap» button: shows the closed period's recap again
 * even to a user who set Saldo up during this period. Showing it stamps the period, which consumes
 * it.
 */
export const RECAP_REPLAY = 'replay';

/** The notification rings at this hour on the first day of a period (§5.15). */
export const RECAP_HOUR = 9;

const PREFIX = 'period-recap:';

/** `{kind}:{start}`: a change of kind or start day gives a new stamp (§5.15). */
export function recapStamp(def: PeriodDef, period: DateRange): string {
  return `${def.kind}:${period.start}`;
}

export interface RecapDueInput {
  stamp: string;
  stored: string | null;
  onboardingCompletedAt: string | null;
  /** Start of the period containing today. */
  currentStart: LocalDate;
}

/**
 * Whether the closed period still has to be recapped (§5.15): not yet stamped, and not for a user
 * who finished onboarding during the current period — an imported history must not greet a new
 * user with a recap of a period they never lived in Saldo. Whether the period has transactions is
 * the core's answer (`periodRecap` returns null), not this one.
 */
export function isRecapDue(input: RecapDueInput): boolean {
  if (input.stored === input.stamp) return false;
  if (input.onboardingCompletedAt === null) return false;
  if (input.stored === RECAP_REPLAY) return true;
  return input.onboardingCompletedAt.slice(0, 10) < input.currentStart;
}

export function recapNotificationId(start: LocalDate): string {
  return `${PREFIX}${start}`;
}

export function isRecapNotificationId(identifier: string): boolean {
  return identifier.startsWith(PREFIX);
}

/** What the notification carries; a tap only opens the app, which shows the sheet by itself. */
export function recapPayload(): Record<string, string> {
  return { kind: 'periodRecap' };
}

/** The next recap notification: 09:00 on the first day of the period after today's. */
export function nextRecapNotification(
  def: PeriodDef,
  today: LocalDate,
  now: Date,
): { identifier: string; at: Date } | null {
  const next = shiftPeriod(def, periodContaining(def, today), 1);
  const at = reminderTrigger(next.start, RECAP_HOUR, now);
  return at === null ? null : { identifier: recapNotificationId(next.start), at };
}
