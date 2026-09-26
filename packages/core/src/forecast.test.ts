import { describe, expect, it } from 'vitest';
import { tx } from './__tests__/fixtures';
import type { Recurrence } from './entities';
import {
  FORECAST_PERIODS,
  type ForecastInput,
  type ForecastRecurrence,
  forecastPeriods,
} from './forecast';
import type { LedgerTx } from './ledger';
import type { PeriodDef } from './period';

const MONTH: PeriodDef = { kind: 'month', startDay: 1 };
/** Day 26 of 30: the materialiser has written occurrences through 31 Oct (§5.9). */
const TODAY = '2026-09-26';
const SEPTEMBER = { start: '2026-09-01', end: '2026-09-30' };

const RENT = 85_000;
const SALARY = 265_000;

const TEMPLATE: Recurrence['template'] = {
  kind: 'expense',
  amount: RENT,
  accountId: 'acc-checking',
  toAccountId: null,
  categoryId: 'cat-rent',
  description: 'Affitto',
  tagIds: [],
  excludeFromTotals: false,
};

function recurrence(overrides: Partial<ForecastRecurrence> & Pick<ForecastRecurrence, 'id'>) {
  return {
    frequency: 'monthly',
    interval: 1,
    startDate: '2026-01-01',
    endDate: null,
    deletedAt: null,
    template: TEMPLATE,
    ...overrides,
  } satisfies ForecastRecurrence;
}

const RENT_REC = recurrence({ id: 'rec-rent' });
const SALARY_REC = recurrence({
  id: 'rec-salary',
  startDate: '2026-01-27',
  template: { ...TEMPLATE, kind: 'income', amount: SALARY, categoryId: 'cat-salary' },
});

/** One month of history: rent and salary from their recurrences, one discretionary expense. */
function month(mm: string, discretionary: number, oneOffIncome = 0): LedgerTx[] {
  const rows = [
    tx({ date: `2026-${mm}-01`, amount: RENT, recurrenceId: 'rec-rent', categoryId: 'cat-rent' }),
    tx({ date: `2026-${mm}-15`, amount: discretionary }),
    tx({
      date: `2026-${mm}-27`,
      amount: SALARY,
      kind: 'income',
      recurrenceId: 'rec-salary',
      categoryId: 'cat-salary',
    }),
  ];
  if (oneOffIncome > 0) {
    rows.push(tx({ date: `2026-${mm}-20`, amount: oneOffIncome, kind: 'income' }));
  }
  return rows;
}

/** Six closed months with discretionary 100/120/90/150/110/80 k: median 105k, min 80k, max 150k. */
function history(): LedgerTx[] {
  return [
    ...month('03', 100_000, 30_000),
    ...month('04', 120_000),
    ...month('05', 90_000),
    ...month('06', 150_000),
    ...month('07', 110_000),
    ...month('08', 80_000),
  ];
}

/** September so far, and the occurrences the materialiser already wrote for Sep 27 and October. */
function scheduledAhead(): LedgerTx[] {
  return [
    tx({ date: '2026-09-01', amount: RENT, recurrenceId: 'rec-rent', categoryId: 'cat-rent' }),
    tx({ date: '2026-09-10', amount: 60_000 }),
    tx({ date: '2026-09-27', amount: SALARY, kind: 'income', recurrenceId: 'rec-salary' }),
    tx({ id: 'rec-rent:2026-10-01', date: '2026-10-01', amount: RENT, recurrenceId: 'rec-rent' }),
    tx({ date: '2026-10-27', amount: SALARY, kind: 'income', recurrenceId: 'rec-salary' }),
  ];
}

function input(overrides: Partial<ForecastInput> = {}): ForecastInput {
  return {
    txs: [...history(), ...scheduledAhead()],
    recurrences: [RENT_REC, SALARY_REC],
    def: MONTH,
    period: SEPTEMBER,
    today: TODAY,
    balance: 1_000_000,
    ...overrides,
  };
}

function forecast(overrides: Partial<ForecastInput> = {}) {
  const result = forecastPeriods(input(overrides));
  if (result === null) throw new Error('expected a forecast');
  return result;
}

describe('forecastPeriods', () => {
  it('covers the three periods after the current one, in the user’s kind', () => {
    expect(FORECAST_PERIODS).toBe(3);
    expect(forecast().map((period) => period.range)).toEqual([
      { start: '2026-10-01', end: '2026-10-31' },
      { start: '2026-11-01', end: '2026-11-30' },
      { start: '2026-12-01', end: '2026-12-31' },
    ]);
  });

  it('follows a pay cycle as well as a calendar month', () => {
    const cycle = forecast({
      def: { kind: 'cycle', startDay: 27 },
      period: { start: '2026-08-27', end: '2026-09-26' },
    });
    expect(cycle.map((period) => period.range.start)).toEqual([
      '2026-09-27',
      '2026-10-27',
      '2026-11-27',
    ]);
  });

  it('is withheld with fewer than three used periods of history', () => {
    const short = [...month('07', 110_000), ...month('08', 80_000), ...scheduledAhead()];
    expect(forecastPeriods(input({ txs: short }))).toBeNull();
  });

  it('adds the usual discretionary spend, and its range, to what is scheduled', () => {
    const [october, november, december] = forecast();
    expect(october).toMatchObject({
      expenses: RENT + 105_000,
      expensesMin: RENT + 80_000,
      expensesMax: RENT + 150_000,
      income: SALARY,
    });
    // November and December come from the recurrences: the materialiser has not reached them.
    expect(november?.expenses).toBe(RENT + 105_000);
    expect(december?.income).toBe(SALARY);
  });

  it('adds the usual one-off income', () => {
    const txs = [
      ...month('03', 100_000, 40_000),
      ...month('04', 120_000, 40_000),
      ...month('05', 90_000, 40_000),
      ...month('06', 150_000),
      ...scheduledAhead(),
    ];
    expect(forecast({ txs })[0]?.income).toBe(SALARY + 40_000);
  });

  it('counts a materialised occurrence as the user edited it', () => {
    const txs = input().txs.map((row) =>
      row.id === 'rec-rent:2026-10-01' ? { ...row, amount: 90_000 } : row,
    );
    expect(forecast({ txs })[0]?.expenses).toBe(90_000 + 105_000);
  });

  it('leaves out an occurrence the user deleted before the horizon', () => {
    const txs = input().txs.filter((row) => row.id !== 'rec-rent:2026-10-01');
    expect(forecast({ txs })[0]?.expenses).toBe(105_000);
  });

  it('stops a recurrence where it ends', () => {
    const ending = { ...RENT_REC, endDate: '2026-11-15' };
    const [, november, december] = forecast({ recurrences: [ending, SALARY_REC] });
    expect(november?.expenses).toBe(RENT + 105_000);
    expect(december?.expenses).toBe(105_000);
  });

  it('ignores deleted, transfer and excluded recurrences', () => {
    const recurrences = [
      SALARY_REC,
      { ...RENT_REC, deletedAt: '2026-09-01T00:00:00.000Z' },
      recurrence({
        id: 'rec-save',
        template: { ...TEMPLATE, kind: 'transfer', toAccountId: 'acc-savings', categoryId: null },
      }),
      recurrence({ id: 'rec-out', template: { ...TEMPLATE, excludeFromTotals: true } }),
    ];
    expect(forecast({ recurrences })[1]?.expenses).toBe(105_000);
  });

  it('counts a one-off row dated ahead, but not an excluded one or a transfer', () => {
    const txs = [
      ...input().txs,
      tx({ date: '2026-11-10', amount: 20_000 }),
      tx({ date: '2026-11-11', amount: 50_000, excludeFromTotals: true }),
      tx({ date: '2026-11-12', amount: 70_000, kind: 'transfer', toAccountId: 'acc-savings' }),
    ];
    expect(forecast({ txs })[1]?.expenses).toBe(RENT + 20_000 + 105_000);
  });

  it('chains the balance from today through the rest of the current period', () => {
    // September: spent 145k, committed 85k, day 26 of 30 → 60k / 26 × 4 ≈ 9,231 more; salary on the 27th.
    const afterSeptember = 1_000_000 + SALARY - 9_231;
    const step = SALARY - (RENT + 105_000);
    expect(forecast().map((period) => period.balance)).toEqual([
      afterSeptember + step,
      afterSeptember + 2 * step,
      afterSeptember + 3 * step,
    ]);
  });

  it('rounds each median once', () => {
    const txs = [
      ...month('05', 100),
      ...month('06', 101),
      ...month('07', 200),
      ...month('08', 300),
      ...scheduledAhead(),
    ];
    // median(100, 101, 200, 300) = 150.5 → 151
    expect(forecast({ txs })[0]?.expenses).toBe(RENT + 151);
  });
});
