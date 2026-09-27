export interface RingGeometry {
  centre: number;
  radius: number;
  stroke: number;
  circumference: number;
  /** Length of the filled arc. */
  dash: number;
  /** Icon size in the middle. */
  icon: number;
  /** The pace tick, across the stroke; null without a pace. */
  tick: { x1: number; y1: number; x2: number; y2: number } | null;
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/**
 * A target ring (§5.13) of `size` points. Angles start on the positive x axis: `TargetRing`
 * rotates the whole drawing by −90° so that 0 sits at 12 o'clock.
 */
export function ringGeometry(size: number, ratio: number, pace: number | null): RingGeometry {
  const large = size >= 36;
  const stroke = large ? 3 : 2.5;
  const centre = size / 2;
  const radius = centre - stroke / 2 - 1;
  const circumference = 2 * Math.PI * radius;
  let tick: RingGeometry['tick'] = null;
  if (pace !== null) {
    const angle = clamp(pace) * 2 * Math.PI;
    const inner = radius - stroke;
    const outer = centre - 0.5;
    tick = {
      x1: centre + inner * Math.cos(angle),
      y1: centre + inner * Math.sin(angle),
      x2: centre + outer * Math.cos(angle),
      y2: centre + outer * Math.sin(angle),
    };
  }
  return {
    centre,
    radius,
    stroke,
    circumference,
    dash: circumference * clamp(ratio),
    icon: large ? 14 : 12,
    tick,
  };
}
