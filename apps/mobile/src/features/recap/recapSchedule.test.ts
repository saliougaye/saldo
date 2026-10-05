import { isRecapDue, RECAP_REPLAY } from './recapSchedule';

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

  it('is due again on the dev replay, even for a user who set Saldo up this period', () => {
    const replay = { ...base, stored: RECAP_REPLAY };
    expect(isRecapDue({ ...replay, onboardingCompletedAt: '2026-10-01T07:00:00.000Z' })).toBe(true);
    // Nothing to recap before onboarding exists at all.
    expect(isRecapDue({ ...replay, onboardingCompletedAt: null })).toBe(false);
  });
});
