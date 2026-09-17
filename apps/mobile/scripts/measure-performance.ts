/**
 * §19.4: how many transactions the in-memory aggregates can carry before a screen feels slow.
 *
 * Run with (esbuild bundles it because the workspace packages use extensionless imports, which
 * plain Node ESM cannot resolve):
 *
 *   pnpm --filter mobile measure:perf [rows]
 *
 * Pure `@saldo/core` over generated rows — no SQLite, no React. That is the point: if the numbers
 * here are fine and the app still stutters, the cost is in the query or the render, and pushing
 * aggregation into SQL would be the wrong fix.
 *
 * The numbers are a **floor**, not a prediction. This runs on whatever machine you are developing
 * on, under Node's JIT; the app runs on a phone under Hermes, which starts interpreted and warms
 * up more slowly. Read a result here as "it cannot be faster than this", and assume a phone is
 * several times slower — the honest thing is to measure on a device before quoting a device
 * number, not to multiply this one by a figure nobody checked.
 */
import {
  type Account,
  accountBalances,
  addDays,
  type Budget,
  budgetProgress,
  type Category,
  categorySpendHistory,
  type DateRange,
  dailyCumulative,
  type LedgerTx,
  monthEndBalances,
  type PeriodDef,
  periodContaining,
  periodHistory,
  periodLength,
  spendingByCategory,
  spendingByTag,
  summarizePeriod,
  type Transaction,
} from '@saldo/core';

const DEFAULT_ROWS = 20_000;
const SPAN_DAYS = 730;
const ACCOUNT_COUNT = 5;
const CATEGORY_COUNT = 40;
/** Categories are one level deep (§4); this many of them are parents. */
const PARENT_COUNT = 8;
const TAG_COUNT = 12;
const BUDGET_COUNT = 8;
/** `app/account/[id].tsx` draws this many points. */
const SPARK_MONTHS = 8;
/** The window the §5.5 baselines look back over, as `app/(tabs)/stats.tsx` uses it. */
const HISTORY_PERIODS = 6;

const parsed = Number.parseInt(process.argv[2] ?? '', 10);
const rowCount = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_ROWS;

const today = '2026-09-13';
const firstDay = addDays(today, -(SPAN_DAYS - 1));
const def: PeriodDef = { kind: 'month', startDay: 1 };
const range: DateRange = periodContaining(def, today);

const CREATED_AT = '2026-01-01T00:00:00.000Z';
const UPDATED_AT = '2026-01-01T00:00:00.000Z-0000-node';

/** Deterministic PRNG (mulberry32), so two runs measure the same data. */
function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = makeRandom(0x5a1d0);
const pick = <T>(values: readonly T[], fallback: T): T =>
  values[Math.floor(random() * values.length)] ?? fallback;

const ACCOUNT_TYPES = [
  'checking',
  'cash',
  'savings',
  'credit_card',
  'investment',
  'debit_card',
] as const;

const accounts: Account[] = Array.from({ length: ACCOUNT_COUNT }, (_, index) => ({
  id: `acc-${index}`,
  createdAt: CREATED_AT,
  updatedAt: UPDATED_AT,
  deletedAt: null,
  name: `Account ${index}`,
  type: ACCOUNT_TYPES[index % ACCOUNT_TYPES.length] ?? 'checking',
  institution: null,
  openingBalance: 100_000 + index * 25_000,
  includeInSpendable: index % 4 !== 3,
  colorIndex: index % 10,
  icon: 'landmark',
  creditCloseDay: null,
  creditChargeDay: null,
  creditPaymentAccountId: null,
  archivedAt: null,
  sortOrder: index,
}));

const categories: Category[] = Array.from({ length: CATEGORY_COUNT }, (_, index) => ({
  id: `cat-${index}`,
  createdAt: CREATED_AT,
  updatedAt: UPDATED_AT,
  deletedAt: null,
  name: `Category ${index}`,
  direction: index % 9 === 0 ? 'income' : 'expense',
  parentId: index < PARENT_COUNT ? null : `cat-${index % PARENT_COUNT}`,
  icon: 'tag',
  colorIndex: index % 10,
  archivedAt: null,
  sortOrder: index,
}));

const expenseCategoryIds = categories
  .filter((category) => category.direction === 'expense')
  .map((category) => category.id);
const incomeCategoryIds = categories
  .filter((category) => category.direction === 'income')
  .map((category) => category.id);
const tagIds = Array.from({ length: TAG_COUNT }, (_, index) => `tag-${index}`);

/**
 * A spread of rows that exercises every branch the folds take: three kinds, both directions, a few
 * excluded rows, a few future-dated ones, tags on a minority, and amounts that vary. A fixture
 * where every row shared one category and one day would measure a different (cheaper) code path.
 */
function makeTransaction(index: number): Transaction {
  const roll = random();
  const date = addDays(firstDay, Math.floor(random() * (SPAN_DAYS + 14)));
  const base = {
    id: `tx-${index}`,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    deletedAt: null,
    amount: 50 + Math.floor(random() * 250_000),
    date,
    description: `Transaction ${index}`,
    note: null,
    tagIds: random() < 0.2 ? [pick(tagIds, 'tag-0')] : [],
    excludeFromTotals: random() < 0.03,
    recurrenceId: random() < 0.08 ? `rec-${index % 20}` : null,
  };
  const accountIndex = Math.floor(random() * ACCOUNT_COUNT);
  const accountId = `acc-${accountIndex}`;

  if (roll < 0.08) {
    return {
      ...base,
      kind: 'transfer',
      accountId,
      toAccountId: `acc-${(accountIndex + 1) % ACCOUNT_COUNT}`,
      categoryId: null,
    };
  }
  if (roll < 0.2) {
    return {
      ...base,
      kind: 'income',
      accountId,
      toAccountId: null,
      categoryId: pick(incomeCategoryIds, 'cat-0'),
    };
  }
  return {
    ...base,
    kind: 'expense',
    accountId,
    toAccountId: null,
    categoryId: pick(expenseCategoryIds, 'cat-1'),
  };
}

/** Newest first, which is the order the repositories hand a screen. */
const transactions: Transaction[] = Array.from({ length: rowCount }, (_, index) =>
  makeTransaction(index),
).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

const rows: readonly LedgerTx[] = transactions;

const budgets: Budget[] = Array.from({ length: BUDGET_COUNT }, (_, index) => ({
  id: `bud-${index}`,
  createdAt: CREATED_AT,
  updatedAt: UPDATED_AT,
  deletedAt: null,
  name: `Budget ${index}`,
  categoryIds: [`cat-${index % PARENT_COUNT}`, `cat-${PARENT_COUNT + index}`],
  amount: 50_000 + index * 10_000,
  period: 'period',
  alertThreshold: 90,
  rollover: index % 2 === 0,
  icon: 'wallet',
  sortOrder: index,
}));

const firstAccount = accounts[0];
if (firstAccount === undefined) throw new Error('no account generated');

const pace = summarizePeriod(rows, range, today).pace;
const spending = spendingByCategory(rows, range, today);
const history = periodHistory(rows, def, range, HISTORY_PERIODS);

interface Measurement {
  label: string;
  note: string;
  median: number;
}

const measurements: Measurement[] = [];

/** Once to warm the JIT, then five runs: the median is what a screen actually waits for. */
function time(label: string, note: string, fn: () => unknown): void {
  fn();
  const runs = Array.from({ length: 5 }, () => {
    const startedAt = performance.now();
    fn();
    return performance.now() - startedAt;
  }).sort((a, b) => a - b);
  measurements.push({ label, note, median: runs[2] ?? 0 });
}

time('accountBalances', 'Accounts tab, account detail', () =>
  accountBalances(accounts, rows, today),
);
time('summarizePeriod', 'Home header, Statistics', () => summarizePeriod(rows, range, today));
time('spendingByCategory', 'Statistics, budgets', () => spendingByCategory(rows, range, today));
time('spendingByTag', 'Statistics tag ranking (§5.10)', () => spendingByTag(rows, range, today));
time('dailyCumulative', 'Home/Statistics chart series', () => dailyCumulative(rows, range, today));
time(`monthEndBalances x${SPARK_MONTHS}`, 'Account sparkline', () =>
  monthEndBalances({
    accountId: firstAccount.id,
    openingBalance: firstAccount.openingBalance,
    txs: rows,
    today,
    months: SPARK_MONTHS,
  }),
);
time(`periodHistory x${HISTORY_PERIODS}`, 'Statistics baselines (§5.5)', () =>
  periodHistory(rows, def, range, HISTORY_PERIODS),
);
time('categorySpendHistory', 'Statistics baselines (§5.5)', () =>
  categorySpendHistory(history, categories, today),
);
time(`budgetProgress x${BUDGET_COUNT}`, 'Budgets tab', () => {
  for (const budget of budgets) budgetProgress(budget, spending, categories, pace);
});
time('— Statistics screen total', 'every fold above that it runs', () => {
  summarizePeriod(rows, range, today);
  dailyCumulative(rows, range, today);
  const window = periodHistory(rows, def, range, HISTORY_PERIODS);
  for (const entry of window) dailyCumulative(entry.txs, entry.period, today);
  spendingByCategory(rows, range, today);
  spendingByTag(rows, range, today);
  categorySpendHistory(window, categories, today);
});

const labelWidth = Math.max(...measurements.map((m) => m.label.length));
const noteWidth = Math.max(...measurements.map((m) => m.note.length));

console.log(
  `${rowCount} transactions over ${SPAN_DAYS} days, ${accounts.length} accounts, ` +
    `${categories.length} categories, ${budgets.length} budgets`,
);
console.log(
  `period: ${range.start}..${range.end} (${periodLength(range)} days), today ${today}, ` +
    `node ${process.version} on ${process.platform}/${process.arch}\n`,
);
for (const { label, note, median } of measurements) {
  console.log(`${label.padEnd(labelWidth)}  ${note.padEnd(noteWidth)}  ${median.toFixed(1)}ms`);
}
