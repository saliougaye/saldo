import { countUpValue } from './countUp';

describe('countUpValue', () => {
  it('starts where it was and ends exactly where it is going', () => {
    expect(countUpValue(1000, 2500, 0)).toBe(1000);
    expect(countUpValue(1000, 2500, 1)).toBe(2500);
  });

  it('lands on the target even if a frame arrives late', () => {
    // requestAnimationFrame can fire after the duration has passed; the amount must not overshoot.
    expect(countUpValue(1000, 2500, 1.4)).toBe(2500);
    expect(countUpValue(1000, 2500, -0.2)).toBe(1000);
  });

  it('moves most of the way early: the curve is an ease-out', () => {
    const half = countUpValue(0, 1000, 0.5);
    expect(half).toBeGreaterThan(500);
    expect(half).toBeLessThan(1000);
  });

  it('counts down as readily as up', () => {
    expect(countUpValue(2500, 1000, 1)).toBe(1000);
    expect(countUpValue(2500, 1000, 0.5)).toBeLessThan(2500);
  });

  it('returns whole minor units, never a fraction of a cent', () => {
    expect(Number.isInteger(countUpValue(0, 333, 0.37))).toBe(true);
  });
});
