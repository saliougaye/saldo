import { motion } from '@saldo/ui';
import { stepDelay } from './motion';

describe('stepDelay', () => {
  it('staggers chunks by the chunk step', () => {
    expect(stepDelay(0)).toBe(0);
    expect(stepDelay(2)).toBe(2 * motion.stepChunkStaggerMs);
  });

  it('staggers words inside a chunk by the word step, after the chunk delay', () => {
    expect(stepDelay(1, 0)).toBe(motion.stepChunkStaggerMs);
    expect(stepDelay(1, 3)).toBe(motion.stepChunkStaggerMs + 3 * motion.stepWordStaggerMs);
  });
});
