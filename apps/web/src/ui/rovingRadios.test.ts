import { describe, expect, it } from 'vitest';
import { rovingTabStop, rovingTarget } from './rovingRadios';

describe('rovingTarget', () => {
  it('steps forward and wraps', () => {
    expect(rovingTarget('ArrowRight', 0, 3)).toBe(1);
    expect(rovingTarget('ArrowDown', 2, 3)).toBe(0);
  });

  it('steps back and wraps', () => {
    expect(rovingTarget('ArrowLeft', 1, 3)).toBe(0);
    expect(rovingTarget('ArrowUp', 0, 3)).toBe(2);
  });

  it('jumps to the ends', () => {
    expect(rovingTarget('Home', 2, 5)).toBe(0);
    expect(rovingTarget('End', 0, 5)).toBe(4);
  });

  it('ignores other keys and empty groups', () => {
    expect(rovingTarget('a', 0, 3)).toBeNull();
    expect(rovingTarget('Tab', 0, 3)).toBeNull();
    expect(rovingTarget('ArrowRight', 0, 0)).toBeNull();
  });
});

describe('rovingTabStop', () => {
  it('is the selected option', () => {
    expect(rovingTabStop(2, 5)).toBe(2);
  });

  it('is the first option when nothing is selected or the selection is out of range', () => {
    expect(rovingTabStop(-1, 5)).toBe(0);
    expect(rovingTabStop(9, 5)).toBe(0);
  });
});
