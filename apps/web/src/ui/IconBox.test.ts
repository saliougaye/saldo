import { categoryColors } from '@saldo/ui';
import { describe, expect, it } from 'vitest';
import { paletteIndex } from './IconBox';

describe('paletteIndex', () => {
  it('keeps an index inside the palette as it is', () => {
    expect(paletteIndex(0)).toBe(0);
    expect(paletteIndex(categoryColors.length - 1)).toBe(categoryColors.length - 1);
  });

  it('wraps one past the end, and a negative one, back into the palette', () => {
    expect(paletteIndex(categoryColors.length)).toBe(0);
    expect(paletteIndex(categoryColors.length + 3)).toBe(3);
    expect(paletteIndex(-1)).toBe(categoryColors.length - 1);
  });
});
