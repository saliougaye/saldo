import { describe, expect, it } from 'vitest';
import type { Recurrence } from './entities';
import {
  endDateAfterCount,
  materializeOccurrences,
  nextOccurrence,
  nthOccurrence,
  occurrenceDates,
  occurrencesPerMonth,
  planRecurrenceEdit,
  planStopRecurrence,
  recurrenceHorizonEnd,
  recurringMonthlyTotals,
} from './recurrence';

const TEMPLATE: Recurrence['template'] = {
  kind: 'expense',
  amount: 78000,
  accountId: 'acc-checking',
  toAccountId: null,
  categoryId: 'cat-rent',
  description: 'Affitto',
  tagIds: [],
  excludeFromTotals: false,
};

const RECURRENCE: Recurrence = {
  id: 'rec-rent',
  createdAt: '2026-01-27T10:00:00.000Z',
  updatedAt: '001775000000000-0000-dev',
  deletedAt: null,
  frequency: 'monthly',
  interval: 1,
  startDate: '2026-01-27',
  endDate: null,
  template: TEMPLATE,
};

const MONTHLY = {
  frequency: 'monthly',
  interval: 1,
  startDate: '2026-01-27',
  endDate: null,
} as const;

describe('nthOccurrence', () => {
  it('counts from the start date', () => {
    expect(nthOccurrence(MONTHLY, 0)).toBe('2026-01-27');
    expect(nthOccurrence(MONTHLY, 2)).toBe('2026-03-27');
    expect(nthOccurrence({ ...MONTHLY, interval: 3 }, 2)).toBe('2026-07-27');
  });

  it('steps days and weeks by the interval', () => {
    expect(nthOccurrence({ ...MONTHLY, frequency: 'daily', interval: 2 }, 3)).toBe('2026-02-02');
    expect(nthOccurrence({ ...MONTHLY, frequency: 'weekly', interval: 2 }, 1)).toBe('2026-02-10');
  });

  it('keeps a yearly date on its month and day, clamping 29 February', () => {
    const leap = { frequency: 'yearly', interval: 1, startDate: '2024-02-29' } as const;
    expect(nthOccurrence(leap, 1)).toBe('2025-02-28');
    expect(nthOccurrence(leap, 4)).toBe('2028-02-29');
  });
});

describe('occurrenceDates', () => {
  it('repeats the start day every month', () => {
    expect(occurrenceDates(MONTHLY, '2026-04-30')).toEqual([
      '2026-01-27',
      '2026-02-27',
      '2026-03-27',
      '2026-04-27',
    ]);
  });

  it('clamps the day to short months, without losing it afterwards', () => {
    expect(occurrenceDates({ ...MONTHLY, startDate: '2026-01-31' }, '2026-04-30')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
  });

  it('stops at the inclusive end date', () => {
    expect(
      occurrenceDates({ ...MONTHLY, startDate: '2026-01-15', endDate: '2026-03-15' }, '2026-12-31'),
    ).toEqual(['2026-01-15', '2026-02-15', '2026-03-15']);
    expect(
      occurrenceDates({ ...MONTHLY, startDate: '2026-01-15', endDate: '2026-03-14' }, '2026-12-31'),
    ).toEqual(['2026-01-15', '2026-02-15']);
  });

  it('returns nothing when the start is past the horizon', () => {
    expect(occurrenceDates({ ...MONTHLY, startDate: '2027-01-01' }, '2026-12-31')).toEqual([]);
  });

  it('fires every second week on the same weekday', () => {
    expect(
      occurrenceDates(
        { frequency: 'weekly', interval: 2, startDate: '2026-09-18', endDate: null },
        '2026-10-31',
      ),
    ).toEqual(['2026-09-18', '2026-10-02', '2026-10-16', '2026-10-30']);
  });

  it('fires every day, every three days, and once a year', () => {
    expect(
      occurrenceDates(
        { frequency: 'daily', interval: 3, startDate: '2026-09-28', endDate: null },
        '2026-10-05',
      ),
    ).toEqual(['2026-09-28', '2026-10-01', '2026-10-04']);
    expect(
      occurrenceDates(
        { frequency: 'yearly', interval: 1, startDate: '2025-03-12', endDate: null },
        '2027-12-31',
      ),
    ).toEqual(['2025-03-12', '2026-03-12', '2027-03-12']);
  });
});

describe('recurrenceHorizonEnd', () => {
  it('reaches the end of the period after the current one', () => {
    expect(recurrenceHorizonEnd({ kind: 'cycle', startDay: 27 }, '2026-04-18')).toBe('2026-05-26');
    expect(recurrenceHorizonEnd({ kind: 'cycle', startDay: 27 }, '2026-04-27')).toBe('2026-06-26');
  });

  it('follows whatever kind the user tracks by', () => {
    // A month period reaches the end of next month, a week period the end of next week.
    expect(recurrenceHorizonEnd({ kind: 'month', startDay: 1 }, '2026-09-10')).toBe('2026-10-31');
    expect(recurrenceHorizonEnd({ kind: 'week', startDay: 1 }, '2026-09-10')).toBe('2026-09-20');
  });
});

describe('materializeOccurrences', () => {
  it('creates one transaction per date, with the deterministic id', () => {
    const created = materializeOccurrences(RECURRENCE, new Set(), '2026-03-31');
    expect(created.map((tx) => tx.id)).toEqual([
      'rec-rent:2026-01-27',
      'rec-rent:2026-02-27',
      'rec-rent:2026-03-27',
    ]);
    expect(created[0]).toMatchObject({
      ...TEMPLATE,
      date: '2026-01-27',
      recurrenceId: 'rec-rent',
      note: null,
    });
  });

  it('skips ids that already exist, tombstones included', () => {
    const existing = new Set(['rec-rent:2026-02-27']);
    const created = materializeOccurrences(RECURRENCE, existing, '2026-03-31');
    expect(created.map((tx) => tx.date)).toEqual(['2026-01-27', '2026-03-27']);
  });

  it('creates nothing for a tombstoned recurrence', () => {
    const deleted = { ...RECURRENCE, deletedAt: '2026-02-01T00:00:00.000Z' };
    expect(materializeOccurrences(deleted, new Set(), '2026-12-31')).toEqual([]);
  });

  it('is idempotent: running it twice adds nothing', () => {
    const first = materializeOccurrences(RECURRENCE, new Set(), '2026-03-31');
    const ids = new Set(first.map((tx) => tx.id));
    expect(materializeOccurrences(RECURRENCE, ids, '2026-03-31')).toEqual([]);
  });
});

describe('planRecurrenceEdit', () => {
  const occurrences = [
    { id: 'rec-rent:2026-02-27', date: '2026-02-27' },
    { id: 'rec-rent:2026-03-27', date: '2026-03-27' },
    { id: 'rec-rent:2026-04-27', date: '2026-04-27' },
    { id: 'rec-rent:2026-05-27', date: '2026-05-27' },
  ];

  it('"only this" touches a single row', () => {
    const plan = planRecurrenceEdit('only-this', {
      recurrence: RECURRENCE,
      occurrenceDate: '2026-04-27',
      occurrences,
      today: '2026-04-18',
    });
    expect(plan).toEqual({
      scope: 'only-this',
      updateOccurrenceIds: ['rec-rent:2026-04-27'],
      tombstoneOccurrenceIds: [],
      endCurrentRecurrenceOn: null,
      startNewRecurrenceOn: null,
      updateTemplate: false,
      unchangedCount: 3,
    });
  });

  it('"this and following" ends the old recurrence the day before and restarts', () => {
    const plan = planRecurrenceEdit('this-and-following', {
      recurrence: RECURRENCE,
      occurrenceDate: '2026-04-27',
      occurrences,
      today: '2026-04-18',
    });
    expect(plan.endCurrentRecurrenceOn).toBe('2026-04-26');
    expect(plan.startNewRecurrenceOn).toBe('2026-04-27');
    // The edited occurrence and every later one are upcoming, so they go.
    expect(plan.tombstoneOccurrenceIds).toEqual(['rec-rent:2026-04-27', 'rec-rent:2026-05-27']);
    expect(plan.updateTemplate).toBe(false);
  });

  it('"this and following" keeps past occurrences even when they sit after the edited date', () => {
    const plan = planRecurrenceEdit('this-and-following', {
      recurrence: RECURRENCE,
      occurrenceDate: '2026-03-27',
      occurrences,
      today: '2026-04-18',
    });
    // 2026-04-27 and 2026-05-27 are upcoming; 2026-03-27 is the edited one.
    expect(plan.tombstoneOccurrenceIds).toEqual([
      'rec-rent:2026-03-27',
      'rec-rent:2026-04-27',
      'rec-rent:2026-05-27',
    ]);
    expect(plan.unchangedCount).toBe(1);
  });

  it('"all" rewrites the template and every existing occurrence', () => {
    const plan = planRecurrenceEdit('all', {
      recurrence: RECURRENCE,
      occurrenceDate: '2026-04-27',
      occurrences,
      today: '2026-04-18',
    });
    expect(plan.updateTemplate).toBe(true);
    expect(plan.updateOccurrenceIds).toEqual(occurrences.map((row) => row.id));
    expect(plan.tombstoneOccurrenceIds).toEqual([]);
    expect(plan.unchangedCount).toBe(0);
  });
});

describe('nextOccurrence', () => {
  it('is the first date strictly after the given one', () => {
    expect(nextOccurrence(MONTHLY, '2026-03-27')).toBe('2026-04-27');
    expect(nextOccurrence(MONTHLY, '2026-03-26')).toBe('2026-03-27');
    expect(nextOccurrence(MONTHLY, '2025-12-01')).toBe('2026-01-27');
  });

  it('is null once the schedule has ended', () => {
    expect(nextOccurrence({ ...MONTHLY, endDate: '2026-03-27' }, '2026-03-27')).toBeNull();
    expect(nextOccurrence({ ...MONTHLY, endDate: '2026-03-27' }, '2026-03-26')).toBe('2026-03-27');
  });
});

describe('endDateAfterCount', () => {
  it('is the date of the N-th occurrence', () => {
    expect(endDateAfterCount(MONTHLY, 1)).toBe('2026-01-27');
    expect(endDateAfterCount(MONTHLY, 12)).toBe('2026-12-27');
    expect(endDateAfterCount({ ...MONTHLY, frequency: 'weekly', interval: 2 }, 3)).toBe(
      '2026-02-24',
    );
  });

  it('treats anything below one as one', () => {
    expect(endDateAfterCount(MONTHLY, 0)).toBe('2026-01-27');
  });
});

describe('recurringMonthlyTotals', () => {
  const template = (kind: Recurrence['template']['kind'], amount: number) => ({
    ...TEMPLATE,
    kind,
    amount,
    categoryId: kind === 'transfer' ? null : TEMPLATE.categoryId,
    toAccountId: kind === 'transfer' ? 'acc-savings' : null,
  });
  const rec = (
    frequency: Recurrence['frequency'],
    interval: number,
    kind: Recurrence['template']['kind'],
    amount: number,
  ): Recurrence => ({
    ...RECURRENCE,
    id: `${frequency}-${interval}-${kind}`,
    frequency,
    interval,
    template: template(kind, amount),
  });

  it('brings every cadence back to a month', () => {
    expect(occurrencesPerMonth({ frequency: 'monthly', interval: 1 })).toBe(1);
    expect(occurrencesPerMonth({ frequency: 'monthly', interval: 3 })).toBeCloseTo(1 / 3);
    expect(occurrencesPerMonth({ frequency: 'weekly', interval: 2 })).toBeCloseTo(52 / 24);
    expect(occurrencesPerMonth({ frequency: 'yearly', interval: 1 })).toBeCloseTo(1 / 12);
    expect(occurrencesPerMonth({ frequency: 'daily', interval: 1 })).toBeCloseTo(365 / 12);
  });

  it('sums expenses and income apart and ignores transfers', () => {
    const totals = recurringMonthlyTotals([
      rec('monthly', 1, 'expense', 85000),
      rec('weekly', 2, 'expense', 6000), // 6000 × 52 / 24 = 13000
      rec('yearly', 1, 'expense', 48000), // 4000
      rec('monthly', 1, 'income', 215000),
      rec('monthly', 1, 'transfer', 50000),
    ]);
    expect(totals).toEqual({ expense: 102000, income: 215000 });
  });
});

describe('planStopRecurrence', () => {
  const occurrences = [
    { id: 'rec-rent:2026-03-27', date: '2026-03-27' },
    { id: 'rec-rent:2026-04-27', date: '2026-04-27' },
    { id: 'rec-rent:2026-05-27', date: '2026-05-27' },
  ] as const;

  it('ends today and removes only what is still to come', () => {
    expect(planStopRecurrence(RECURRENCE, occurrences, '2026-04-27')).toEqual({
      endDate: '2026-04-27',
      deleteRecurrence: false,
      tombstoneOccurrenceIds: ['rec-rent:2026-05-27'],
    });
  });

  it('removes a series that has not started yet', () => {
    const future = { ...RECURRENCE, startDate: '2026-05-27' };
    expect(planStopRecurrence(future, [occurrences[2]], '2026-04-18')).toEqual({
      endDate: null,
      deleteRecurrence: true,
      tombstoneOccurrenceIds: ['rec-rent:2026-05-27'],
    });
  });
});
