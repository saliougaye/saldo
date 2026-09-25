import { MASCOT_STATES, type MascotState, mascotPlayback, POSE_FRAME } from './mascotPlayback';

// The real files: a pose frame outside its animation would hold Rocky on nothing.
const FILES: Record<MascotState, { ip: number; op: number }> = {
  idle: require('../../assets/mascot/idle.json'),
  success: require('../../assets/mascot/success.json'),
  error: require('../../assets/mascot/error.json'),
  wave: require('../../assets/mascot/wave.json'),
  loading: require('../../assets/mascot/loading.json'),
  sleep: require('../../assets/mascot/sleep.json'),
};

describe('mascotPlayback', () => {
  it.each(['loading', 'sleep'] as const)('loops %s: those are waits', (state) => {
    expect(mascotPlayback(state, 144, false)).toEqual({ kind: 'loop' });
  });

  it.each(['idle', 'success', 'error', 'wave'] as const)(
    'plays %s once and stops on its pose',
    (state) => {
      expect(mascotPlayback(state, 144, false)).toEqual({
        kind: 'once',
        endFrame: POSE_FRAME[state],
      });
    },
  );

  it.each(MASCOT_STATES)('holds %s on its pose under Reduce Motion, loops included', (state) => {
    expect(mascotPlayback(state, 144, true)).toEqual({
      kind: 'still',
      progress: POSE_FRAME[state] / 144,
    });
  });

  it.each(MASCOT_STATES)('finds the pose of %s inside its animation', (state) => {
    const file = FILES[state];
    expect(POSE_FRAME[state]).toBeGreaterThan(0);
    expect(POSE_FRAME[state]).toBeLessThan(file.op - file.ip);
  });
});
