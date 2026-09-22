import { type LocalDate, parseLocalDate } from '@saldo/core';

/**
 * The charge-day reminder of a credit card (§5.3): one local notification per card, under a fixed
 * identifier so that scheduling it again replaces it, and so that the gate can find and cancel
 * every one of its own without touching anything else the app schedules.
 */
const PREFIX = 'card-charge:';

export function reminderId(accountId: string): string {
  return `${PREFIX}${accountId}`;
}

export function isReminderId(identifier: string): boolean {
  return identifier.startsWith(PREFIX);
}

/**
 * `hour`:00 local time on `date`, or null once that moment has passed — a charge day opened at
 * 10:00 gets no reminder, the card box already says it.
 */
export function reminderTrigger(date: LocalDate, hour: number, now: Date): Date | null {
  const { year, month, day } = parseLocalDate(date);
  const at = new Date(year, month - 1, day, hour, 0, 0, 0);
  return at.getTime() > now.getTime() ? at : null;
}

/** What the notification carries, so a tap can open the card rather than anything pre-saved. */
export function reminderPayload(accountId: string): Record<string, string> {
  return { kind: 'cardCharge', accountId };
}

export function reminderAccountId(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const record = data as Record<string, unknown>;
  return record.kind === 'cardCharge' && typeof record.accountId === 'string'
    ? record.accountId
    : null;
}
