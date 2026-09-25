/** The kit's states Saldo uses (§13 *Mascot*). */
export const MASCOT_STATES = ['idle', 'success', 'error', 'wave', 'loading', 'sleep'] as const;
export type MascotState = (typeof MASCOT_STATES)[number];

/**
 * The frame each state's still is cut from: the kit's `pose_time` (60% of the loop unless its spec
 * sets one) at 30 fps. A Rocky who stops is the kit's still.
 */
export const POSE_FRAME: Record<MascotState, number> = {
  idle: 86,
  success: 43,
  error: 43,
  wave: 45,
  loading: 86,
  sleep: 42,
};

/** Only the waits loop: a Rocky moving for ever beside an empty list is noise. */
const LOOPS: ReadonlySet<MascotState> = new Set(['loading', 'sleep']);

export type MascotPlayback =
  | { kind: 'loop' }
  | { kind: 'once'; endFrame: number }
  | { kind: 'still'; progress: number };

/** How `state` plays in an animation of `frames` frames. Reduce Motion plays nothing. */
export function mascotPlayback(
  state: MascotState,
  frames: number,
  reduced: boolean,
): MascotPlayback {
  if (reduced) return { kind: 'still', progress: POSE_FRAME[state] / frames };
  if (LOOPS.has(state)) return { kind: 'loop' };
  return { kind: 'once', endFrame: POSE_FRAME[state] };
}
