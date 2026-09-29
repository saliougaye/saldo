import {
  type CreditSettlementDraft,
  emptyForm,
  isLocalDate,
  type LocalDate,
  type MinorDigits,
  minorToAmountBuffer,
  type TransactionFormValues,
} from '@saldo/core';

/**
 * "Salda carta" opens the ordinary new-transaction sheet (§6.16) already filled in. What it is
 * filled with travels as route params, which expo-router carries as strings only: this is the
 * one place that writes them and the one place that reads them back.
 */
export type SettlementParams = Record<string, string>;

/**
 * How far past today the screens that settle a card read transactions. A payment already scheduled
 * for the charge day settles the statement (`creditStatementDue`), and the charge day is at most a
 * month after the close, so two months is enough with room to spare.
 */
export const SETTLEMENT_LOOKAHEAD_DAYS = 62;

/** A one-tap amount next to the field: the closed statement, or the whole balance. */
export interface AmountShortcut {
  key: 'statement' | 'balance';
  minor: number;
}

export function settlementParams(
  draft: CreditSettlementDraft,
  description: string,
): SettlementParams {
  return {
    settleTo: draft.toAccountId,
    from: draft.fromAccountId ?? '',
    amount: String(draft.amount),
    date: draft.date,
    description,
    statement: draft.statementAmount === null ? '' : String(draft.statementAmount),
    balance: String(draft.balanceAmount),
  };
}

/** A positive integer of minor units, or 0 for anything else a link could carry. */
function minorParam(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

/**
 * The transfer form "Salda carta" opens on, or null for a plain new transaction. Nothing here is
 * written: every field stays editable and the row exists only once the user saves.
 */
export function settlementForm(
  params: Partial<Record<string, string | string[]>>,
  today: LocalDate,
  minorDigits: MinorDigits,
): { values: TransactionFormValues; shortcuts: AmountShortcut[] } | null {
  const read = (key: string): string | undefined => {
    const value = params[key];
    return typeof value === 'string' ? value : undefined;
  };
  const to = read('settleTo');
  if (to === undefined || to.length === 0) return null;
  const from = read('from');
  const date = read('date');
  const amount = minorParam(read('amount'));
  const statement = minorParam(read('statement'));
  const balance = minorParam(read('balance'));
  const base = emptyForm(
    date !== undefined && isLocalDate(date) ? date : today,
    from !== undefined && from.length > 0 ? from : null,
  );
  return {
    values: {
      ...base,
      kind: 'transfer',
      toAccountId: to,
      buffer: amount > 0 ? minorToAmountBuffer(amount, minorDigits) : '',
      description: read('description') ?? '',
    },
    // Two chips only when they differ: one option is not a choice.
    shortcuts:
      statement > 0 && balance > 0 && statement !== balance
        ? [
            { key: 'statement', minor: statement },
            { key: 'balance', minor: balance },
          ]
        : [],
  };
}
