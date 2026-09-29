import type { TransactionKind } from '../entities';
import { type LedgerTx, signedAmount } from '../ledger';

/** How an amount is signed when it is shown (`@saldo/i18n`'s `SignDisplay`, without the dependency). */
export type AmountSign = 'negative' | 'always' | 'never';

/** Last step of the category palette, the grey everything without a category of its own uses. */
export const NEUTRAL_COLOR_INDEX = 9;

export interface RowCategory {
  name: string;
  icon: string;
  colorIndex: number;
}

export interface TransactionRowDeps {
  /** The transaction's category, or `undefined` — a transfer has none by contract (§4). */
  category(categoryId: string): RowCategory | undefined;
  accountName(accountId: string): string;
  /** `t('kinds.<kind>')`, passed in so this stays a pure function. */
  kindLabel(kind: TransactionKind): string;
  /**
   * The account the list is read from: `filters.accountId` in the transactions list, the account
   * itself on its detail screen, `null` on Home and Tag where no account frames the rows. It is
   * what decides whether a transfer has a direction at all.
   */
  viewpointAccountId: string | null;
}

export interface TransactionRow {
  title: string;
  subtitle: string;
  icon: string;
  colorIndex: number;
  amount: {
    minor: number;
    signDisplay: AmountSign;
    /** A figure that moves no money: render it in `textMuted`, not as a gain or a loss. */
    muted: boolean;
  };
}

/**
 * How one transaction reads as a row, in one place for every screen that lists them.
 *
 * Each screen used to rebuild this from `categoryId`, which is `null` for a transfer by contract,
 * so a transfer came out as "—" on Home, as a duplicated "Trasferimento" in the list, and as an
 * expense everywhere (§4 asks for "A → B", §5.3 keeps transfers out of every total).
 */
export function transactionRow(tx: LedgerTx, deps: TransactionRowDeps): TransactionRow {
  const kindLabel = deps.kindLabel(tx.kind);

  if (tx.kind === 'transfer') {
    const route =
      tx.toAccountId === null
        ? kindLabel
        : `${deps.accountName(tx.accountId)} → ${deps.accountName(tx.toAccountId)}`;
    const signed = signedAmount(tx, deps.viewpointAccountId);
    return {
      title: tx.description.length > 0 ? tx.description : route,
      subtitle: kindLabel,
      icon: 'swap',
      colorIndex: NEUTRAL_COLOR_INDEX,
      amount:
        signed === null
          ? { minor: tx.amount, signDisplay: 'never', muted: true }
          : { minor: signed, signDisplay: 'always', muted: false },
    };
  }

  const category = tx.categoryId === null ? undefined : deps.category(tx.categoryId);
  const name = category?.name ?? kindLabel;
  return {
    title: tx.description.length > 0 ? tx.description : name,
    subtitle: name,
    icon: category?.icon ?? 'tag',
    colorIndex: category?.colorIndex ?? NEUTRAL_COLOR_INDEX,
    amount: {
      minor: signedAmount(tx, deps.viewpointAccountId) ?? 0,
      signDisplay: tx.kind === 'income' ? 'always' : 'negative',
      muted: false,
    },
  };
}
