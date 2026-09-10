import { LOCK_AFTER_BACKGROUND_MS, shouldRelock } from './relock';

describe('shouldRelock', () => {
  const now = 1_775_000_060_000;

  it('never locks when the setting is off', () => {
    expect(shouldRelock(false, now - LOCK_AFTER_BACKGROUND_MS * 2, now)).toBe(false);
  });

  it('never locks when the app was not backgrounded', () => {
    expect(shouldRelock(true, null, now)).toBe(false);
  });

  it('locks only past the threshold', () => {
    expect(shouldRelock(true, now - LOCK_AFTER_BACKGROUND_MS + 1, now)).toBe(false);
    expect(shouldRelock(true, now - LOCK_AFTER_BACKGROUND_MS, now)).toBe(true);
    expect(shouldRelock(true, now - LOCK_AFTER_BACKGROUND_MS * 10, now)).toBe(true);
  });

  it('uses a minute by default', () => {
    expect(LOCK_AFTER_BACKGROUND_MS).toBe(60_000);
  });
});
