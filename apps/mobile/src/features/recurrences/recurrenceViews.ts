import { type LocalDate, nextOccurrence, type Recurrence } from '@saldo/core';

export interface RecurrenceView {
  recurrence: Recurrence;
  /** Null once the series has ended. */
  next: LocalDate | null;
  /** The description, or the category's name when there is none, as a transaction row does. */
  title: string;
}

export function recurrenceViews(
  recurrences: readonly Recurrence[],
  today: LocalDate,
  categoryName: (id: string | null) => string,
  transferLabel: string,
): RecurrenceView[] {
  return recurrences.map((recurrence) => ({
    recurrence,
    next: nextOccurrence(recurrence, today),
    title:
      recurrence.template.description.length > 0
        ? recurrence.template.description
        : recurrence.template.kind === 'transfer'
          ? transferLabel
          : categoryName(recurrence.template.categoryId),
  }));
}

/** Live first, soonest first; ended series last, most recently ended first. */
export function byNext(a: RecurrenceView, b: RecurrenceView): number {
  if (a.next !== null && b.next !== null) return a.next < b.next ? -1 : a.next > b.next ? 1 : 0;
  if (a.next !== null) return -1;
  if (b.next !== null) return 1;
  const ea = a.recurrence.endDate ?? '';
  const eb = b.recurrence.endDate ?? '';
  return ea > eb ? -1 : ea < eb ? 1 : 0;
}
