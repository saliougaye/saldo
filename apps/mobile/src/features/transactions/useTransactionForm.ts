import type { TransactionFormValues } from '@saldo/core';

/**
 * What the form's "Dettagli" disclosure is holding (§6.16).
 *
 * Tags, attachments and exclude are the three fields that are rarely touched and that
 * together pushed the frequent ones off the screen. Collapsing them is only safe if a *set* value
 * stays readable without opening anything, which is what this counts.
 */
export interface DetailsSummary {
  tags: number;
  attachments: number;
  excludeFromTotals: boolean;
}

export function detailsSummary(
  values: Pick<TransactionFormValues, 'tagIds' | 'excludeFromTotals'>,
  attachments: number,
): DetailsSummary {
  return { tags: values.tagIds.length, attachments, excludeFromTotals: values.excludeFromTotals };
}

export function detailsAreEmpty(summary: DetailsSummary): boolean {
  return summary.tags === 0 && summary.attachments === 0 && !summary.excludeFromTotals;
}

/**
 * Closed on a new transaction — nothing is set, and the point of the disclosure is that the form
 * fits in one screen. Open on an edit that has something in it: edit is random access, and the
 * field you came back for is the one that is already filled.
 */
export function detailsOpenInitially(mode: 'new' | 'edit', summary: DetailsSummary): boolean {
  return mode === 'edit' && !detailsAreEmpty(summary);
}
