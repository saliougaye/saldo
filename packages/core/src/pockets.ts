import type { Account } from './entities';
import type { MinorUnits } from './money';

/** Where a pocket's money can sit (§5.14). Investments are out: their returns land on the parent. */
export const POCKET_PARENT_TYPES: readonly Account['type'][] = [
  'cash',
  'checking',
  'debit_card',
  'savings',
];

type PocketFields = Pick<Account, 'id' | 'type' | 'archivedAt'> & {
  parentAccountId?: string | null;
};

export function isPocket(account: Pick<Account, 'type'>): boolean {
  return account.type === 'pocket';
}

/** The live (open) pockets inside `parentId`, in the given order. */
export function pocketsOf<T extends PocketFields>(accounts: readonly T[], parentId: string): T[] {
  return accounts.filter(
    (account) =>
      isPocket(account) && account.archivedAt === null && account.parentAccountId === parentId,
  );
}

/** What the bank shows for an account: its own balance plus its open pockets' (§5.14). */
export function bankBalance(
  accounts: readonly PocketFields[],
  balances: ReadonlyMap<string, MinorUnits>,
  accountId: string,
): MinorUnits {
  let total = balances.get(accountId) ?? 0;
  for (const pocket of pocketsOf(accounts, accountId)) total += balances.get(pocket.id) ?? 0;
  return total;
}

/** Accounts a new goal may live in: live cash, current, debit and savings accounts. */
export function pocketParentCandidates<T extends PocketFields>(accounts: readonly T[]): T[] {
  return accounts.filter(
    (account) => account.archivedAt === null && POCKET_PARENT_TYPES.includes(account.type),
  );
}

/** An account holding open goals cannot be archived: their money would leave the totals. */
export function canArchiveAccount(accounts: readonly PocketFields[], accountId: string): boolean {
  return pocketsOf(accounts, accountId).length === 0;
}

/**
 * The account chips of the transaction form (§5.14): pockets only where money moves by transfer,
 * each right after its parent — plus a pocket already selected, as when closing a goal records
 * its expense from the pocket.
 */
export function accountChoices<T extends PocketFields>(
  accounts: readonly T[],
  options: { includePockets: boolean; keepId: string | null },
): T[] {
  const out: T[] = [];
  for (const account of accounts) {
    if (isPocket(account)) continue;
    out.push(account);
    for (const pocket of accounts) {
      if (!isPocket(pocket) || pocket.parentAccountId !== account.id) continue;
      if (options.includePockets || pocket.id === options.keepId) out.push(pocket);
    }
  }
  const kept = accounts.find(
    (account) => account.id === options.keepId && isPocket(account) && !out.includes(account),
  );
  if (kept !== undefined) out.push(kept);
  return out;
}
