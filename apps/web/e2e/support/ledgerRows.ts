import type { Member } from './members';

/** The fields of a synced transaction that the specs add up. Amounts are minor units. */
export interface LedgerTransaction {
  id: string;
  kind: 'expense' | 'income' | 'transfer';
  amount: number;
  /** `YYYY-MM-DD`. */
  date: string;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  description: string;
  tagIds: string[];
  excludeFromTotals: boolean;
  recurrenceId: string | null;
}

export interface LedgerCategory {
  id: string;
  name: string;
  parentId: string | null;
  direction: 'expense' | 'income';
}

export interface LedgerTag {
  id: string;
  name: string;
}

export interface LedgerAccount {
  id: string;
  name: string;
  type: string;
  /** Set on a goal (a pocket). Minor units. */
  goalTarget?: number;
  parentAccountId?: string | null;
}

export interface LedgerBudget {
  id: string;
  name: string;
  categoryIds: string[];
  /** The limit, in minor units. */
  amount: number;
}

export interface Ledger {
  transactions: LedgerTransaction[];
  categories: LedgerCategory[];
  tags: LedgerTag[];
  accounts: LedgerAccount[];
  budgets: LedgerBudget[];
  currency: string;
  timeZone: string;
  /** The user's «today», as the server reads it. */
  today: string;
}

interface PulledChange {
  entity: string;
  id: string;
  deletedAt: string | null;
  data: Record<string, unknown>;
}

interface PullPage {
  changes: PulledChange[];
  nextSince: number;
  hasMore: boolean;
}

/**
 * What the account holds right now, read through the sync API with the member's own session. The
 * specs add these rows up themselves, so the totals they expect never come from the app's own code.
 */
export async function readLedger(member: Member): Promise<Ledger> {
  const changes: PulledChange[] = [];
  let since = 0;
  for (;;) {
    const response = await member.context.request.get(`/api/sync/pull?since=${since}`);
    if (!response.ok()) throw new Error(`pull refused: ${response.status()}`);
    const page = (await response.json()) as PullPage;
    changes.push(...page.changes);
    since = page.nextSince;
    if (!page.hasMore) break;
  }
  const live = <T>(entity: string): T[] =>
    changes
      .filter((change) => change.entity === entity && change.deletedAt === null)
      .map((change) => change.data as unknown as T);

  const settings = changes.find((change) => change.entity === 'settings')?.data;
  const timeZone = typeof settings?.timeZone === 'string' ? settings.timeZone : 'UTC';
  const currency = typeof settings?.currency === 'string' ? settings.currency : 'EUR';

  return {
    transactions: live<LedgerTransaction>('transaction'),
    categories: live<LedgerCategory>('category'),
    tags: live<LedgerTag>('tag'),
    accounts: live<LedgerAccount>('account'),
    budgets: live<LedgerBudget>('budget'),
    currency,
    timeZone,
    today: new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date()),
  };
}

export interface Range {
  start: string;
  end: string;
}

/** `YYYY-MM-DD` plus `days`, in plain UTC calendar arithmetic (no time zone is involved). */
export function shiftDate(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

/** The calendar month that contains `date`: the period the default onboarding picks. */
export function monthOf(date: string): Range {
  const [year, month] = date.split('-').map(Number) as [number, number];
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const prefix = date.slice(0, 7);
  return { start: `${prefix}-01`, end: `${prefix}-${String(last).padStart(2, '0')}` };
}

export function previousMonth(range: Range): Range {
  return monthOf(shiftDate(range.start, -1));
}

export function nextMonth(range: Range): Range {
  return monthOf(shiftDate(range.end, 1));
}

export function inRange(date: string, range: Range): boolean {
  return date >= range.start && date <= range.end;
}

/** What the totals of a period count: no transfer, no excluded row and nothing dated after today. */
export function counted(ledger: Ledger, range: Range): LedgerTransaction[] {
  return ledger.transactions.filter(
    (tx) =>
      tx.kind !== 'transfer' &&
      !tx.excludeFromTotals &&
      tx.date <= ledger.today &&
      inRange(tx.date, range),
  );
}

export function sum(rows: readonly { amount: number }[]): number {
  return rows.reduce((total, row) => total + row.amount, 0);
}

/** Income, spend and what is left of a period, added up from the rows. */
export function summary(ledger: Ledger, range: Range): { income: number; spent: number } {
  const rows = counted(ledger, range);
  return {
    income: sum(rows.filter((tx) => tx.kind === 'income')),
    spent: sum(rows.filter((tx) => tx.kind === 'expense')),
  };
}

/** A category's own id and the ids of its children: what a filter or a budget on it covers. */
export function categoryFamily(ledger: Ledger, categoryId: string): string[] {
  return [
    categoryId,
    ...ledger.categories
      .filter((category) => category.parentId === categoryId)
      .map((category) => category.id),
  ];
}
