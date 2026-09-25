import { isIntroDue } from './introSchedule';

describe('isIntroDue', () => {
  const at = '2026-09-26T08:00:00.000Z';

  it('waits for onboarding to finish', () => {
    expect(isIntroDue({ onboardingCompletedAt: null, stored: null })).toBe(false);
  });

  it('is due once after onboarding', () => {
    expect(isIntroDue({ onboardingCompletedAt: at, stored: null })).toBe(true);
    expect(isIntroDue({ onboardingCompletedAt: at, stored: at })).toBe(false);
  });

  it('is due again after onboarding is finished again', () => {
    expect(isIntroDue({ onboardingCompletedAt: '2026-10-01T08:00:00.000Z', stored: at })).toBe(
      true,
    );
  });
});
