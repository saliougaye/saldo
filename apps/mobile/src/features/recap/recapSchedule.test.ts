import type { PeriodDef } from '@saldo/core';
import {
  isRecapDue,
  isRecapNotificationId,
  nextRecapNotification,
  recapNotificationId,
  recapStamp,
} from './recapSchedule';

const MONTH: PeriodDef = { kind: 'month', startDay: 1 };
const WEEK: PeriodDef = { kind: 'week', startDay: 1 };
const SEPTEMBER = { start: '2026-09-01', end: '2026-09-30' };

describe('recapStamp', () => {
  it('names the kind and the start, so a change of kind is a new period', () => {
    expect(recapStamp(MONTH, SEPTEMBER)).toBe('month:2026-09-01');
    expect(recapStamp(WEEK, { start: '2026-09-28', end: '2026-10-04' })).toBe('week:2026-09-28');
  });
});

describe('isRecapDue', () => {
  const base = {
    stamp: 'month:2026-09-01',
    stored: 'month:2026-08-01',
    onboardingCompletedAt: '2026-05-02T09:00:00.000Z',
    currentStart: '2026-10-01',
  };

  it('is due for a period not recapped yet', () => {
    expect(isRecapDue(base)).toBe(true);
    expect(isRecapDue({ ...base, stored: null })).toBe(true);
  });

  it('is shown once', () => {
    expect(isRecapDue({ ...base, stored: 'month:2026-09-01' })).toBe(false);
  });

  it('waits for onboarding, and skips a user who set Saldo up during this period', () => {
    expect(isRecapDue({ ...base, onboardingCompletedAt: null })).toBe(false);
    expect(isRecapDue({ ...base, onboardingCompletedAt: '2026-10-01T07:00:00.000Z' })).toBe(false);
    expect(isRecapDue({ ...base, onboardingCompletedAt: '2026-09-30T21:00:00.000Z' })).toBe(true);
  });
});

describe('nextRecapNotification', () => {
  it('rings at 09:00 on the first day of the next period', () => {
    const now = new Date(2026, 8, 25, 12, 0, 0, 0);
    expect(nextRecapNotification(MONTH, '2026-09-25', now)).toEqual({
      identifier: 'period-recap:2026-10-01',
      at: new Date(2026, 9, 1, 9, 0, 0, 0),
    });
    expect(nextRecapNotification(WEEK, '2026-09-25', now)).toEqual({
      identifier: 'period-recap:2026-09-28',
      at: new Date(2026, 8, 28, 9, 0, 0, 0),
    });
  });
});

describe('recapNotificationId', () => {
  it('is recognisable among the other scheduled notifications', () => {
    expect(isRecapNotificationId(recapNotificationId('2026-10-01'))).toBe(true);
    expect(isRecapNotificationId('card-charge:acc-1')).toBe(false);
  });
});
