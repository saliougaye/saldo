import { describe, expect, it } from 'vitest';
import { canDeletePasskey } from './list';

describe('canDeletePasskey', () => {
  it('refuses the last one (§17.1.7)', () => {
    expect(canDeletePasskey(1)).toBe(false);
    expect(canDeletePasskey(0)).toBe(false);
  });

  it('allows one of several', () => {
    expect(canDeletePasskey(2)).toBe(true);
  });
});
