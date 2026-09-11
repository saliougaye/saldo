import type { LocalDate } from '../dates';
import type { TransactionKind } from '../entities';
// The same comparison form the transaction search uses: lowercase, unaccented, single-spaced.
import { normalizeText } from '../filters';
import type { MinorUnits } from '../money';

/**
 * §11.3: `date | amount | kind | description | account`. Importing the same file twice must change
 * nothing the second time, and this is what "the same transaction" means — no id is available,
 * since the other app's ids are not ours.
 */
export function transactionFingerprint(input: {
  date: LocalDate;
  amount: MinorUnits;
  kind: TransactionKind;
  description: string;
  accountName: string;
}): string {
  return [
    input.date,
    String(input.amount),
    input.kind,
    normalizeText(input.description),
    normalizeText(input.accountName),
  ].join('|');
}
