import { describe, expect, it } from 'vitest';
import { ringGeometry } from './ring';

describe('ringGeometry', () => {
  it('fills the share of the circle the ratio asks for', () => {
    const ring = ringGeometry(36, 0.5, null);
    expect(ring.dash).toBeCloseTo(ring.circumference / 2, 10);
  });

  it('never fills past the whole circle, nor below nothing', () => {
    expect(ringGeometry(36, 1.4, null).dash).toBeCloseTo(
      ringGeometry(36, 1, null).circumference,
      10,
    );
    expect(ringGeometry(36, -0.2, null).dash).toBe(0);
  });

  it('draws no tick without a pace', () => {
    expect(ringGeometry(36, 0.5, null).tick).toBeNull();
  });

  it('puts the tick at the pace, before the −90° rotation the ring applies', () => {
    const ring = ringGeometry(36, 0.5, 0);
    // Angle 0 is the positive x axis; the ring's rotation turns it to 12 o'clock.
    expect(ring.tick?.y1).toBeCloseTo(ring.centre, 10);
    expect(ring.tick?.x1).toBeLessThan(ring.tick?.x2 ?? 0);
    expect(ring.tick?.x2).toBeLessThanOrEqual(36);
  });

  it('keeps a thinner stroke and a smaller icon on the preview ring', () => {
    expect(ringGeometry(28, 0, null).stroke).toBeLessThan(ringGeometry(36, 0, null).stroke);
    expect(ringGeometry(28, 0, null).icon).toBeLessThan(ringGeometry(36, 0, null).icon);
  });
});
