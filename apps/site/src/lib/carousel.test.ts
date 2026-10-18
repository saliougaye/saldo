import { describe, expect, it } from 'vitest';
import {
  adjacentStop,
  isSettled,
  MAX_SPEED,
  nearestStop,
  project,
  releaseVelocity,
  restingStop,
  rubberBand,
  snapStops,
  springAt,
} from './carousel';

/** Ten 264px cards, 24px apart, behind a 160px track padding: the 1440px layout. */
const offsets = Array.from({ length: 10 }, (_, index) => 160 + index * 288);
const max = 1736;

describe('snapStops', () => {
  it('puts the first card on the page edge and clamps the last ones to the end', () => {
    expect(snapStops(offsets, 160, max)).toEqual([0, 288, 576, 864, 1152, 1440, 1736]);
  });

  it('merges a stop within 32px of the end into the end, so «previous» moves a whole card', () => {
    const near = [...offsets.slice(0, 6), 160 + 1728, 160 + 2016];
    expect(snapStops(near, 160, max)).toEqual([0, 288, 576, 864, 1152, 1440, 1736]);
  });
});

describe('nearestStop and adjacentStop', () => {
  const stops = [0, 288, 576, 864];

  it('picks the closest stop', () => {
    expect(nearestStop(stops, 400)).toBe(288);
    expect(nearestStop(stops, 440)).toBe(576);
  });

  it('moves one stop and answers null at the ends', () => {
    expect(adjacentStop(stops, 288, 1)).toBe(576);
    expect(adjacentStop(stops, 288, -1)).toBe(0);
    expect(adjacentStop(stops, 864, 1)).toBeNull();
    expect(adjacentStop(stops, 0, -1)).toBeNull();
  });

  it('treats a position 1px off a stop as that stop', () => {
    expect(adjacentStop(stops, 287, 1)).toBe(576);
  });
});

describe('momentum', () => {
  it('projects about a tenth of a second of travel at the paging rate', () => {
    expect(project(1400)).toBeCloseTo(138.6, 1);
    expect(project(-1400)).toBeCloseTo(-138.6, 1);
  });

  it('carries a fast flick two cards, a medium one one card, and a slow release nowhere', () => {
    const stops = snapStops(offsets, 160, max);
    expect(restingStop(stops, 288, 6000)).toBe(864);
    expect(restingStop(stops, 288, 2000)).toBe(576);
    expect(restingStop(stops, 300, 0)).toBe(288);
  });

  it('measures the release over the last 100ms only, and clamps it', () => {
    const samples = [
      { x: 900, t: 0 },
      { x: 800, t: 400 },
      { x: 700, t: 450 },
      { x: 600, t: 500 },
    ];
    // From the sample at 400ms: 200px left in 100ms.
    expect(releaseVelocity(samples)).toBeCloseTo(2000, 5);
    expect(
      releaseVelocity([
        { x: 900, t: 0 },
        { x: 0, t: 20 },
      ]),
    ).toBe(MAX_SPEED);
    expect(releaseVelocity([])).toBe(0);
  });
});

describe('rubberBand', () => {
  it('follows less than the pointer, keeps the sign, and grows with the overshoot', () => {
    const small = rubberBand(50, 1440);
    const large = rubberBand(500, 1440);
    expect(small).toBeGreaterThan(0);
    expect(small).toBeLessThan(50);
    expect(large).toBeGreaterThan(small);
    expect(large).toBeLessThan(500 * 0.55);
    expect(rubberBand(-50, 1440)).toBeCloseTo(-small, 10);
    expect(rubberBand(0, 1440)).toBe(0);
  });
});

describe('springAt', () => {
  it('starts at the live position with the release velocity', () => {
    const start = springAt(300, 576, 2000, 0);
    expect(start.x).toBeCloseTo(300, 10);
    expect(start.v).toBeCloseTo(2000, 10);
  });

  it('settles on the target within a second and does not overshoot from rest', () => {
    let crossed = false;
    for (let t = 0; t <= 1; t += 1 / 120) {
      if (springAt(0, 288, 0, t).x > 288 + 0.01) crossed = true;
    }
    const end = springAt(0, 288, 0, 1);
    expect(crossed).toBe(false);
    expect(isSettled(end.x, 288, end.v)).toBe(true);
  });
});
