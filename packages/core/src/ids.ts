import { uuidv7 } from 'uuidv7';
import type { LocalDate } from './dates';

/** Time-ordered unique id for new entities (UUIDv7). */
export function newId(): string {
  return uuidv7();
}

/** Deterministic id of a recurrence occurrence, so offline devices converge on one row. */
export function occurrenceId(recurrenceId: string, date: LocalDate): string {
  return `${recurrenceId}:${date}`;
}

export const SETTINGS_ID = 'settings';
