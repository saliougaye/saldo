/**
 * The rules of the screens carousel (spec 0.8a §05), as pure functions. The script
 * `src/scripts/carousel.ts` reads the DOM and calls these; the tests call them directly.
 */

/** A stop closer than this to the end becomes the end, so «previous» from the end moves a whole card. */
export const END_MERGE_PX = 32;
/** A mouse press becomes a drag after this much horizontal movement. */
export const DRAG_START_PX = 5;
/** The release speed comes from the pointer samples of this last window. */
export const SAMPLE_WINDOW_MS = 100;
export const MAX_SPEED = 6000;
/** Apple's deceleration rate for paging: a flick carries about two cards, not the whole strip. */
export const PAGING_RATE = 0.99;
export const RUBBER_BAND = 0.55;
export const SPRING_RESPONSE_S = 0.42;
export const SETTLE_DISTANCE = 0.5;
export const SETTLE_SPEED = 12;

/** The resting positions: each card's left edge minus the scroll padding, clamped to 0…max. */
export function snapStops(offsets: readonly number[], padStart: number, max: number): number[] {
  const stops: number[] = [];
  for (const offset of offsets) {
    const clamped = Math.max(0, Math.min(max, offset - padStart));
    const stop = Math.round(clamped > max - END_MERGE_PX ? max : clamped);
    if (!stops.includes(stop)) stops.push(stop);
  }
  return stops.sort((a, b) => a - b);
}

export function nearestStop(stops: readonly number[], x: number): number {
  let best = stops[0] ?? 0;
  for (const stop of stops) if (Math.abs(stop - x) < Math.abs(best - x)) best = stop;
  return best;
}

/** The next stop in `direction` from `x`, or null at that end. */
export function adjacentStop(
  stops: readonly number[],
  x: number,
  direction: 1 | -1,
): number | null {
  if (direction > 0) return stops.find((stop) => stop > x + 2) ?? null;
  for (let index = stops.length - 1; index >= 0; index -= 1) {
    const stop = stops[index];
    if (stop !== undefined && stop < x - 2) return stop;
  }
  return null;
}

/** How far a release at `velocity` (px/s) carries: Apple's projection, at the paging rate. */
export function project(velocity: number): number {
  return (velocity / 1000) * (PAGING_RATE / (1 - PAGING_RATE));
}

/** Where a release comes to rest: the stop nearest the projected position. */
export function restingStop(stops: readonly number[], x: number, velocity: number): number {
  return nearestStop(stops, x + project(velocity));
}

/** Past an end, the track follows less and less: the further it goes, the harder it pulls. */
export function rubberBand(overshoot: number, dimension: number): number {
  if (overshoot === 0) return 0;
  const distance = Math.abs(overshoot);
  return (
    Math.sign(overshoot) *
    ((distance * dimension * RUBBER_BAND) / (dimension + RUBBER_BAND * distance))
  );
}

export interface PointerSample {
  /** clientX, px */
  x: number;
  /** event.timeStamp, ms */
  t: number;
}

/**
 * The scroll velocity at release, px/s: the pointer moving left scrolls right. From the samples of
 * the last `SAMPLE_WINDOW_MS`, clamped to ±`MAX_SPEED`.
 */
export function releaseVelocity(samples: readonly PointerSample[]): number {
  const last = samples[samples.length - 1];
  if (last === undefined) return 0;
  const first = samples.find((sample) => last.t - sample.t <= SAMPLE_WINDOW_MS) ?? last;
  const elapsed = Math.max(16, last.t - first.t);
  const velocity = (-(last.x - first.x) / elapsed) * 1000;
  return Math.max(-MAX_SPEED, Math.min(MAX_SPEED, velocity));
}

/** A critically damped spring from `from` to `to` with start velocity `velocity`, at `t` seconds. */
export function springAt(
  from: number,
  to: number,
  velocity: number,
  t: number,
): { x: number; v: number } {
  const omega = (2 * Math.PI) / SPRING_RESPONSE_S;
  const offset = from - to;
  const c = velocity + omega * offset;
  const decay = Math.exp(-omega * t);
  return { x: to + (offset + c * t) * decay, v: (c - omega * (offset + c * t)) * decay };
}

export function isSettled(x: number, to: number, v: number): boolean {
  return Math.abs(x - to) < SETTLE_DISTANCE && Math.abs(v) < SETTLE_SPEED;
}
