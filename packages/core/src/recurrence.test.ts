import { describe, expect, it } from 'vitest';
import type { Recurrence } from './entities';
import {
  materializeOccurrences,
  occurrenceDates,
  planRecurrenceEdit,
  recurrenceHorizonEnd,
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
  startDate: '2026-01-27',
  endDate: null,
  template: TEMPLATE,
};

describe('occurrenceDates', () => {
  it('repeats the start day every month', () => {
    expect(occurrenceDates('2026-01-27', null, '2026-04-30')).toEqual([
      '2026-01-27',
      '2026-02-27',
      '2026-03-27',
      '2026-04-27',
    ]);
  });

  it('clamps the day to short months, without losing it afterwards', () => {
    expect(occurrenceDates('2026-01-31', null, '2026-04-30')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
  });

  it('stops at the inclusive end date', () => {
    expect(occurrenceDates('2026-01-15', '2026-03-15', '2026-12-31')).toEqual([
      '2026-01-15',
      '2026-02-15',
      '2026-03-15',
    ]);
    expect(occurrenceDates('2026-01-15', '2026-03-14', '2026-12-31')).toEqual([
      '2026-01-15',
      '2026-02-15',
    ]);
  });

  it('returns nothing when the horizon is before the start', () => {
    expect(occurrenceDates('2026-05-01', null, '2026-04-30')).toEqual([]);
  });
});

describe('recurrenceHorizonEnd', () => {
  it('reaches the end of the cycle after the current one', () => {
    expect(recurrenceHorizonEnd('2026-04-18', 27)).toBe('2026-05-26');
    expect(recurrenceHorizonEnd('2026-04-27', 27)).toBe('2026-06-26');
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
